"use client";

// Client orchestration for inserting a video. Mirrors the audio flow: ALL work
// happens in the browser — there is no server action and no ffmpeg. Steps:
//   1. drop an optimistic "Adding…" placeholder at the caret
//   2. prepare in-browser: validate size/duration, grab a poster frame, flag HEVC
//   3. upload the ORIGINAL file (as-is) + the poster straight to storage
//   4. swap the placeholder for a real <video>
// On any failure we remove the placeholder and surface the reason.

import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareVideo } from "@/lib/video-prepare";

export const VIDEO_BUCKET = "doc-videos";
export const VIDEO_ACCEPT = "video/*";

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

// File extension for the stored upload, sniffed from the name or MIME type.
function fileExt(file: File) {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "";
  if (fromName && fromName.length <= 5) return fromName;
  const sub = file.type.split("/")[1] || "bin";
  return sub === "quicktime" ? "mov" : sub;
}

type Options = {
  supabase: SupabaseClient;
  userId: string;
  docId: string;
  insertNodeAtCaret: (node: Node) => void;
  scheduleSave: () => void;
  // Storage paths the editor already knows about (so the next save's orphan
  // sweep doesn't mistake a just-added video for a deleted one).
  knownVideoPaths: RefObject<Set<string>>;
  onError: (err: unknown) => void;
  // Non-blocking notice (e.g. the HEVC cross-browser caveat).
  onWarn?: (text: string) => void;
};

export function useVideoInsert({
  supabase,
  userId,
  docId,
  insertNodeAtCaret,
  scheduleSave,
  knownVideoPaths,
  onError,
  onWarn,
}: Options) {
  // Count in-flight inserts so the toolbar button can show a busy state even
  // with several drops at once.
  const [pending, setPending] = useState(0);
  const pendingRef = useRef(0);
  const bump = (n: number) => {
    pendingRef.current += n;
    setPending(pendingRef.current);
  };

  const insertVideo = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) return;

      const id = newId();

      // 1) Optimistic placeholder at the caret, followed by a landing paragraph.
      const placeholder = document.createElement("figure");
      placeholder.setAttribute("data-video", "");
      placeholder.setAttribute("data-status", "uploading");
      placeholder.contentEditable = "false";
      placeholder.innerHTML = `<div data-video-loading><span data-spinner></span><span data-video-label></span></div>`;
      const label = placeholder.querySelector("[data-video-label]")!;
      label.textContent = `Adding “${file.name}”…`;

      const trailing = document.createElement("p");
      trailing.appendChild(document.createElement("br"));
      const frag = document.createDocumentFragment();
      frag.appendChild(placeholder);
      frag.appendChild(trailing);
      insertNodeAtCaret(frag);

      bump(1);
      try {
        // 2) Prepare in-browser (validates size + 60s cap, grabs a poster).
        const prepared = await prepareVideo(file);
        if (prepared.warning) onWarn?.(prepared.warning);

        // 3) Upload the original file as-is, plus the poster (if we got one).
        const ext = fileExt(file);
        const path = `${userId}/${docId}/${id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(VIDEO_BUCKET)
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) throw upErr;

        let posterPath: string | null = null;
        let posterUrl: string | null = null;
        if (prepared.poster) {
          posterPath = `${userId}/${docId}/${id}.jpg`;
          const { error: pErr } = await supabase.storage
            .from(VIDEO_BUCKET)
            .upload(posterPath, prepared.poster, {
              contentType: "image/jpeg",
              upsert: true,
            });
          if (pErr) {
            posterPath = null; // poster is optional — don't fail the insert
          } else {
            posterUrl = supabase.storage
              .from(VIDEO_BUCKET)
              .getPublicUrl(posterPath).data.publicUrl;
          }
        }
        const url = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path).data
          .publicUrl;

        // 4) Swap in the real <video>. If the placeholder was deleted while we
        // worked, clean up the just-uploaded files instead of orphaning them.
        if (!placeholder.isConnected) {
          const toRemove = [path];
          if (posterPath) toRemove.push(posterPath);
          await supabase.storage.from(VIDEO_BUCKET).remove(toRemove);
          return;
        }

        const figure = document.createElement("figure");
        figure.setAttribute("data-video", "");
        figure.setAttribute("data-align", "center");
        figure.contentEditable = "false";

        const video = document.createElement("video");
        video.setAttribute("controls", "");
        video.setAttribute("preload", "metadata");
        video.setAttribute("playsinline", "");
        if (posterUrl) video.poster = posterUrl;
        video.src = url;
        video.setAttribute("data-path", path);
        if (posterPath) video.setAttribute("data-poster-path", posterPath);
        if (prepared.width) video.width = prepared.width;
        if (prepared.height) video.height = prepared.height;
        figure.appendChild(video);

        placeholder.replaceWith(figure);
        knownVideoPaths.current.add(path);
        if (posterPath) knownVideoPaths.current.add(posterPath);
        scheduleSave();
      } catch (err) {
        placeholder.remove();
        console.error("Video insert failed", err);
        onError(err);
      } finally {
        bump(-1);
      }
    },
    [
      supabase,
      userId,
      docId,
      insertNodeAtCaret,
      scheduleSave,
      knownVideoPaths,
      onError,
      onWarn,
    ],
  );

  return { insertVideo, uploadingVideo: pending > 0 };
}
