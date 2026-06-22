"use client";

// Read-only renderer for a published document. It paints the saved HTML inside
// `.doc-content` (the exact same styles the editor uses) and re-creates ONLY the
// interactivity that the embeds need — there is no editing, toolbar, or saving:
//   * the custom audio player (play/pause + click-to-seek + the yolk "played"
//     fill), driven by one set of capture-phase media listeners, exactly like the
//     editor does;
//   * link-preview cards (click to open in a new tab, or play a YouTube/Vimeo
//     embed inline).
// Images and <video controls> need no JS. Checklists render their saved state via
// CSS and are intentionally not toggleable here (a public reader can't persist).

import { useEffect, useRef } from "react";

export function PublishedDocument({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  // Audio players: one set of capture-phase listeners on the container drives
  // every <audio> inside it (media events don't bubble, but capture still reaches
  // the parent). Mirrors the editor's player wiring.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const fmt = (s: number) => {
      if (!isFinite(s) || s < 0) s = 0;
      return `${Math.floor(s / 60)}:${Math.floor(s % 60)
        .toString()
        .padStart(2, "0")}`;
    };
    const figOf = (e: Event): HTMLElement | null => {
      const a = e.target as HTMLElement;
      if (!a || a.tagName !== "AUDIO") return null;
      return a.closest("figure[data-audio]") as HTMLElement | null;
    };
    const setLabel = (fig: HTMLElement, cur: number, dur: number) => {
      const label = fig.querySelector("[data-audio-time]");
      if (label) label.textContent = `${fmt(cur)} / ${fmt(dur)}`;
    };
    const onTime = (e: Event) => {
      const fig = figOf(e);
      if (!fig) return;
      const a = e.target as HTMLAudioElement;
      const d = a.duration || 0;
      fig.style.setProperty("--played", d ? String(a.currentTime / d) : "0");
      setLabel(fig, a.currentTime, d);
    };
    const onMeta = (e: Event) => {
      const fig = figOf(e);
      if (fig) setLabel(fig, 0, (e.target as HTMLAudioElement).duration || 0);
    };
    const onPlay = (e: Event) => figOf(e)?.setAttribute("data-playing", "");
    const onStop = (e: Event) => figOf(e)?.removeAttribute("data-playing");
    root.addEventListener("timeupdate", onTime, true);
    root.addEventListener("loadedmetadata", onMeta, true);
    root.addEventListener("play", onPlay, true);
    root.addEventListener("pause", onStop, true);
    root.addEventListener("ended", onStop, true);
    return () => {
      root.removeEventListener("timeupdate", onTime, true);
      root.removeEventListener("loadedmetadata", onMeta, true);
      root.removeEventListener("play", onPlay, true);
      root.removeEventListener("pause", onStop, true);
      root.removeEventListener("ended", onStop, true);
    };
  }, []);

  // Click handling: audio play/seek, and link-card open/play. (Same behaviour as
  // the editor's onEditorClick, minus everything to do with editing/selection.)
  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Audio: play/pause button, or click-to-seek on the waveform.
    const audioFig = target.closest<HTMLElement>("figure[data-audio]");
    if (audioFig) {
      const audioEl = audioFig.querySelector("audio");
      if (audioEl) {
        if (target.closest("[data-audio-play]")) {
          // Catch a rejected play() (unplayable/missing source) so it doesn't
          // bubble up as an unhandled rejection on the public page.
          if (audioEl.paused) void audioEl.play().catch(() => {});
          else audioEl.pause();
        } else {
          const wave = target.closest<HTMLElement>("[data-waveform]");
          if (wave && isFinite(audioEl.duration)) {
            const rect = wave.getBoundingClientRect();
            const frac = Math.min(
              1,
              Math.max(0, (e.clientX - rect.left) / rect.width),
            );
            audioEl.currentTime = frac * audioEl.duration;
          }
        }
      }
      return;
    }

    // Link-preview cards: play a video embed inline, else open the link.
    const card = target.closest<HTMLElement>("figure[data-link-card]");
    if (card) {
      const play = target.closest("[data-yt-play]");
      const embed = card.getAttribute("data-embed");
      if (play && embed && !card.querySelector("iframe")) {
        const media = card.querySelector("[data-card-media]");
        if (media) {
          const frame = document.createElement("iframe");
          frame.src = embed.includes("?")
            ? `${embed}&autoplay=1`
            : `${embed}?autoplay=1`;
          frame.setAttribute(
            "allow",
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          );
          frame.setAttribute("allowfullscreen", "");
          frame.setAttribute("frameborder", "0");
          media.replaceWith(frame);
        }
        e.preventDefault();
        return;
      }
      const href = card.getAttribute("data-href");
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
        e.preventDefault();
      }
    }
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      className="doc-content mt-8 w-full text-ink"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
