"use client";

// Client orchestration for inserting audio. Much simpler than video — there's no
// server action, because prepareAudio() does everything (decode, waveform, ≤60s
// cap) in the browser. Steps:
//   1. drop an optimistic "Preparing…" placeholder at the caret
//   2. prepareAudio(file) → { blob, peaks, duration, … }
//   3. upload the blob straight to the doc-audio bucket
//   4. swap the placeholder for the real custom player (waveform + controls)
// On any failure we remove the placeholder and surface the error.

import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareAudio, WAVE_BARS } from "@/lib/audio-prepare";

export const AUDIO_BUCKET = "doc-audio";
export const AUDIO_ACCEPT = "audio/*";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — matches the bucket cap.

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Build the bar <span>s for one waveform row from the peaks (heights in %).
// A small floor keeps near-silent bars visible.
function barsHtml(peaks: number[]): string {
  return peaks
    .map((p) => `<span style="height:${Math.max(10, p)}%"></span>`)
    .join("");
}

// Build the full player figure. The markup is fully static/serializable — on
// reload it's restored from saved HTML and the editor's delegated listeners
// re-attach behaviour (play/pause, seek, played-fill) with no rebuild.
//   data-peaks   : the bar heights (kept for reference / future re-render)
//   --played     : 0..1 fill fraction, driven on timeupdate by the editor
// Two identical bar rows are layered: the base (muted) and a yolk copy clipped
// to --played, giving the WhatsApp-style progress fill in pure CSS.
export function buildAudioFigure(opts: {
  src: string;
  path: string;
  peaks: number[];
  duration: number;
}): HTMLElement {
  const { src, path, peaks, duration } = opts;
  const figure = document.createElement("figure");
  figure.setAttribute("data-audio", "");
  figure.setAttribute("data-peaks", peaks.join(","));
  figure.contentEditable = "false";

  const bars = barsHtml(peaks);
  figure.innerHTML = `
    <audio data-path="${path}" src="${src}" preload="metadata"></audio>
    <button data-audio-play type="button" aria-label="Play"></button>
    <div data-waveform>
      <div data-bars>${bars}</div>
      <div data-bars-played>${bars}</div>
    </div>
    <span data-audio-time>${fmtTime(0)} / ${fmtTime(duration)}</span>
  `;
  return figure;
}

type Options = {
  supabase: SupabaseClient;
  userId: string;
  docId: string;
  insertNodeAtCaret: (node: Node) => void;
  scheduleSave: () => void;
  knownAudioPaths: RefObject<Set<string>>;
  onError: (err: unknown) => void;
};

export function useAudioInsert({
  supabase,
  userId,
  docId,
  insertNodeAtCaret,
  scheduleSave,
  knownAudioPaths,
  onError,
}: Options) {
  const [pending, setPending] = useState(0);
  const pendingRef = useRef(0);
  const bump = (n: number) => {
    pendingRef.current += n;
    setPending(pendingRef.current);
  };

  const insertAudio = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("audio/")) return;
      if (file.size > MAX_BYTES) {
        onError(new Error("Audio is larger than the 50 MB limit"));
        return;
      }

      const id = newId();

      // 1) Optimistic placeholder, followed by a landing paragraph.
      const placeholder = document.createElement("figure");
      placeholder.setAttribute("data-audio", "");
      placeholder.setAttribute("data-status", "preparing");
      placeholder.contentEditable = "false";
      placeholder.innerHTML = `<div data-audio-loading><span data-spinner></span><span data-audio-label></span></div>`;
      placeholder.querySelector("[data-audio-label]")!.textContent =
        `Preparing “${file.name}”…`;

      const trailing = document.createElement("p");
      trailing.appendChild(document.createElement("br"));
      const frag = document.createDocumentFragment();
      frag.appendChild(placeholder);
      frag.appendChild(trailing);
      insertNodeAtCaret(frag);

      bump(1);
      try {
        // 2) Decode + waveform + ≤60s cap, all in the browser.
        const prepared = await prepareAudio(file);

        // 3) Upload the (possibly trimmed) blob.
        const path = `${userId}/${docId}/${id}.${prepared.ext}`;
        const { error: upErr } = await supabase.storage
          .from(AUDIO_BUCKET)
          .upload(path, prepared.blob, {
            contentType: prepared.contentType,
            upsert: false,
          });
        if (upErr) throw upErr;

        // 4) Swap in the real player. If the placeholder was deleted mid-flight,
        // remove the just-uploaded file instead of orphaning it.
        if (!placeholder.isConnected) {
          await supabase.storage.from(AUDIO_BUCKET).remove([path]);
          return;
        }

        const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path);
        const figure = buildAudioFigure({
          src: data.publicUrl,
          path,
          peaks: prepared.peaks,
          duration: prepared.duration,
        });
        placeholder.replaceWith(figure);
        knownAudioPaths.current.add(path);
        scheduleSave();
      } catch (err) {
        placeholder.remove();
        console.error("Audio insert failed", err);
        onError(err);
      } finally {
        bump(-1);
      }
    },
    [supabase, userId, docId, insertNodeAtCaret, scheduleSave, knownAudioPaths, onError],
  );

  return { insertAudio, uploadingAudio: pending > 0 };
}

// Keep WAVE_BARS referenced so a future re-render path can rebuild bars if needed.
export { WAVE_BARS };
