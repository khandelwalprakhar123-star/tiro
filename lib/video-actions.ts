"use server";

// Server-side video compression.
//
// WHY server-side: transcoding video in the browser (ffmpeg.wasm) is slow and
// memory-hungry on the user's machine. We do it on the server with a native
// ffmpeg binary (shipped by `ffmpeg-static`) instead.
//
// WHY we pass a storage PATH, not the bytes: a Server Action's request body is
// capped at 1 MB by default (Next `serverActions.bodySizeLimit`). Videos are
// far larger, so the CLIENT uploads the raw file straight to Supabase storage
// (no body limit, and it can show progress), then calls this action with just
// the path. We download it here, transcode, upload the result, and delete the
// raw original.
//
// Quality approach (chosen with the user): H.264 (plays everywhere) encoded
// with CRF 20 — a *quality* target, not a fixed bitrate, so each scene gets
// exactly the bits it needs and the result looks near-identical to the source.
// We also cap the long edge at 1080p (downscale only) and add +faststart so
// playback can begin before the whole file downloads.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { createClient } from "@/lib/supabase/server";

const execFileAsync = promisify(execFile);

const VIDEO_BUCKET = "doc-videos";

// Encode knobs. CRF 20 ≈ visually near-lossless; lower = better/bigger.
// Preset trades encode TIME for file SIZE at the SAME quality — "slow" yields
// the smallest file. Switch to "medium" if encodes feel sluggish on your machine.
const CRF = "20";
const PRESET = "slow";
const MAX_EDGE = 1920; // cap the long edge (1080p); never upscales.

export type CompressedVideo = {
  path: string; // ‹uid›/‹docId›/‹id›.mp4 in doc-videos
  posterPath: string; // ‹uid›/‹docId›/‹id›.jpg
  url: string; // public URL of the mp4
  posterUrl: string; // public URL of the poster frame
  width: number;
  height: number;
  duration: number; // seconds
};

// Run a binary, rejecting on non-zero exit with a trimmed stderr tail so the
// error message is useful but not enormous.
async function run(bin: string, args: string[]) {
  try {
    return await execFileAsync(bin, args, { maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    const tail = (e.stderr || e.message || "").split("\n").slice(-8).join("\n");
    throw new Error(`ffmpeg failed: ${tail}`);
  }
}

// Probe a file for its video stream dimensions + container duration.
async function probe(ffprobe: string, file: string) {
  const { stdout } = await execFileAsync(ffprobe, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const info = JSON.parse(stdout) as {
    streams?: { codec_type?: string; width?: number; height?: number }[];
    format?: { duration?: string };
  };
  const v = info.streams?.find((s) => s.codec_type === "video");
  return {
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    duration: Number(info.format?.duration ?? 0),
  };
}

export async function compressVideo(input: {
  rawPath: string;
  docId: string;
  id: string;
}): Promise<CompressedVideo> {
  const { rawPath, docId, id } = input;

  // Server Actions are reachable by direct POST — always re-check auth and that
  // the caller actually owns the path they handed us.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const prefix = `${user.id}/${docId}/`;
  if (!rawPath.startsWith(prefix) || rawPath.includes("..")) {
    throw new Error("Invalid video path");
  }

  if (!ffmpegPath) throw new Error("ffmpeg binary not found");
  const ffprobePath = ffprobeStatic.path;

  // Download the raw upload into a private temp dir.
  const { data: blob, error: dlErr } = await supabase.storage
    .from(VIDEO_BUCKET)
    .download(rawPath);
  if (dlErr || !blob) throw new Error(`Could not read raw video: ${dlErr?.message}`);

  const dir = await mkdtemp(join(tmpdir(), "deescribe-vid-"));
  const rawFile = join(dir, "raw");
  const outFile = join(dir, "out.mp4");
  const posterFile = join(dir, "poster.jpg");

  try {
    await writeFile(rawFile, Buffer.from(await blob.arrayBuffer()));

    // Transcode → H.264/AAC MP4. The scale filter fits the frame inside a
    // MAX_EDGE×MAX_EDGE box (decrease-only, so small videos pass through) and
    // forces even dimensions, which libx264 requires.
    await run(ffmpegPath, [
      "-nostdin",
      "-y",
      "-i",
      rawFile,
      "-vf",
      `scale='min(${MAX_EDGE},iw)':'min(${MAX_EDGE},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
      "-c:v",
      "libx264",
      "-crf",
      CRF,
      "-preset",
      PRESET,
      "-pix_fmt",
      "yuv420p", // broadest player compatibility
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outFile,
    ]);

    const { width, height, duration } = await probe(ffprobePath, outFile);

    // Grab a poster frame from a little way in (avoids a black first frame),
    // clamped for very short clips.
    const posterTs = duration > 0 ? Math.min(1, duration / 2) : 0;
    await run(ffmpegPath, [
      "-nostdin",
      "-y",
      "-ss",
      String(posterTs),
      "-i",
      outFile,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      posterFile,
    ]);

    const path = `${prefix}${id}.mp4`;
    const posterPath = `${prefix}${id}.jpg`;

    const [mp4, poster] = await Promise.all([
      readFile(outFile),
      readFile(posterFile),
    ]);

    const up1 = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(path, mp4, { contentType: "video/mp4", upsert: true });
    if (up1.error) throw up1.error;

    const up2 = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(posterPath, poster, { contentType: "image/jpeg", upsert: true });
    if (up2.error) throw up2.error;

    // The raw original has served its purpose — delete it so we don't pay to
    // store it. Best-effort; an orphaned raw is also swept on document purge.
    await supabase.storage.from(VIDEO_BUCKET).remove([rawPath]);

    const url = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path)
      .data.publicUrl;
    const posterUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(posterPath)
      .data.publicUrl;

    return { path, posterPath, url, posterUrl, width, height, duration };
  } finally {
    // Always clean the temp dir, even if encoding threw.
    await rm(dir, { recursive: true, force: true });
  }
}
