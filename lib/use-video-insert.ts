"use client";

// Client orchestration for inserting a video. Mirrors the image flow's shape
// (one funnel for button/drop) but the heavy lifting — compression — happens in
// a server action. Steps:
//   1. drop an optimistic "Uploading…/Compressing…" placeholder at the caret
//   2. upload the RAW file straight to storage (no server-action body limit)
//   3. call compressVideo(path) → server transcodes, returns the mp4 + poster
//   4. swap the placeholder for a real <video>
// On any failure we remove the placeholder and surface the error.

import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compressVideo } from "@/lib/video-actions";

export const VIDEO_BUCKET = "doc-videos";
export const VIDEO_ACCEPT = "video/*";
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB — matches the bucket's cap.

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

// Best-effort file extension for the raw upload (helps ffmpeg sniff the format).
function rawExt(file: File) {
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
};

export function useVideoInsert({
  supabase,
  userId,
  docId,
  insertNodeAtCaret,
  scheduleSave,
  knownVideoPaths,
  onError,
}: Options) {
  // Count in-flight uploads so the toolbar button can show a busy state even
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
      if (file.size > MAX_BYTES) {
        onError(new Error("Video is larger than the 500 MB limit"));
        return;
      }

      const id = newId();

      // 1) Optimistic placeholder at the caret, followed by a landing paragraph.
      const placeholder = document.createElement("figure");
      placeholder.setAttribute("data-video", "");
      placeholder.setAttribute("data-status", "uploading");
      placeholder.contentEditable = "false";
      placeholder.innerHTML = `<div data-video-loading><span data-spinner></span><span data-video-label></span></div>`;
      const label = placeholder.querySelector("[data-video-label]")!;
      label.textContent = `Uploading “${file.name}”…`;

      const trailing = document.createElement("p");
      trailing.appendChild(document.createElement("br"));
      const frag = document.createDocumentFragment();
      frag.appendChild(placeholder);
      frag.appendChild(trailing);
      insertNodeAtCaret(frag);

      bump(1);
      try {
        // 2) Upload the raw original straight to storage.
        const rawPath = `${userId}/${docId}/${id}-raw.${rawExt(file)}`;
        const { error: upErr } = await supabase.storage
          .from(VIDEO_BUCKET)
          .upload(rawPath, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) throw upErr;

        // 3) Server-side transcode.
        label.textContent = "Compressing… this can take a moment";
        placeholder.setAttribute("data-status", "processing");
        const result = await compressVideo({ rawPath, docId, id });

        // 4) Swap in the real <video>. If the placeholder was deleted while we
        // worked, clean up the just-uploaded files instead of orphaning them.
        if (!placeholder.isConnected) {
          await supabase.storage
            .from(VIDEO_BUCKET)
            .remove([result.path, result.posterPath]);
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
        video.poster = result.posterUrl;
        video.src = result.url;
        video.setAttribute("data-path", result.path);
        video.setAttribute("data-poster-path", result.posterPath);
        if (result.width) video.width = result.width;
        if (result.height) video.height = result.height;
        figure.appendChild(video);

        placeholder.replaceWith(figure);
        knownVideoPaths.current.add(result.path);
        knownVideoPaths.current.add(result.posterPath);
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
    ],
  );

  return { insertVideo, uploadingVideo: pending > 0 };
}
