"use client";

// Client-side video preparation — NO server, NO ffmpeg.
//
// This mirrors the audio model (lib/audio-prepare.ts): the uploader's browser
// does the only cheap work — read the duration/dimensions and grab a poster
// frame — and we then store the ORIGINAL file as-is. We deliberately do NOT
// transcode. Server-side ffmpeg on Vercel was a serverless liability: a long
// `preset slow` encode runs past the function's execution limit and gets killed
// mid-flight, so the upload would silently vanish. By doing zero server compute
// there is nothing to time out.
//
// The trade-off we accept (and guard): the file is stored in whatever codec the
// user uploaded. The one real risk is HEVC (typical of iPhone `.mov` clips),
// which Safari plays but Chrome/Firefox usually don't — so a clip that looks
// fine to the uploader could be a black box for other viewers. We detect that
// case and surface a non-blocking warning rather than silently shipping it.

// Constraints (chosen to bound browser memory + storage, mirroring audio's cap):
export const MAX_VIDEO_SECONDS = 60; // same 60s cap as audio
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB — raw, uncompressed

export type PreparedVideo = {
  poster: Blob | null; // JPEG poster frame, or null if we couldn't capture one
  width: number;
  height: number;
  duration: number; // seconds
  warning: string | null; // e.g. the HEVC cross-browser caveat
};

// Load a file into a detached <video> and resolve once metadata (duration +
// dimensions) is known. Rejects if the browser can't decode it at all.
function loadMetadata(
  file: File,
): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error("Couldn't read this video. Try an MP4 (H.264) instead."),
      );
    };
    video.src = url;
  });
}

// Seek a little way in (dodging a black first frame) and draw that frame to a
// JPEG. Best-effort: returns null if the frame can't be captured, and the embed
// just renders without a poster.
function grabPoster(video: HTMLVideoElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (b: Blob | null) => {
      if (!settled) {
        settled = true;
        resolve(b);
      }
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => finish(b), "image/jpeg", 0.82);
      } catch {
        finish(null); // undrawable frame — degrade to no poster
      }
    };
    video.onerror = () => finish(null);
    try {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    } catch {
      finish(null);
    }
  });
}

// Best-effort HEVC detection. HEVC-capable browsers (Safari) report support for
// the "hvc1" codec string; H.264-only browsers (Chrome/Firefox) return "". If we
// CAN play hvc1 here AND the file is a QuickTime/.mov, it's very likely an HEVC
// clip that won't play for non-Safari viewers — warn, don't block.
function hevcWarning(file: File): string | null {
  const probe = document.createElement("video");
  const playsHevc = probe.canPlayType('video/mp4; codecs="hvc1"') !== "";
  const isMov = file.type === "video/quicktime" || /\.mov$/i.test(file.name);
  return playsHevc && isMov
    ? "This looks like an HEVC video — it may not play in Chrome or Firefox. For the widest compatibility, use an H.264 MP4."
    : null;
}

export async function prepareVideo(file: File): Promise<PreparedVideo> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video is larger than the ${Math.round(
        MAX_VIDEO_BYTES / (1024 * 1024),
      )} MB limit.`,
    );
  }

  const { video, url } = await loadMetadata(file);
  try {
    const duration = video.duration || 0;
    if (duration > MAX_VIDEO_SECONDS + 0.5) {
      throw new Error(
        `Video is longer than ${MAX_VIDEO_SECONDS}s. Trim it and try again.`,
      );
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    const poster = await grabPoster(video);
    return { poster, width, height, duration, warning: hevcWarning(file) };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load(); // release the decoder
  }
}
