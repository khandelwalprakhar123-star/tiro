"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { ImageToolbar } from "./image-toolbar";
import { VideoToolbar } from "./video-toolbar";
import { useVideoInsert, VIDEO_BUCKET, VIDEO_ACCEPT } from "@/lib/use-video-insert";
import { useAudioInsert, AUDIO_BUCKET, AUDIO_ACCEPT } from "@/lib/use-audio-insert";
import { useLinkPreview } from "@/lib/use-link-preview";
import { useSmoothCaret } from "@/lib/use-smooth-caret";
import { exportDocumentToPdf } from "@/lib/export-pdf";
import { exportDocumentToMarkdown } from "@/lib/export-markdown";
import { PublishDialog } from "./publish-panel";
import type { PublishState } from "@/lib/publish-actions";
import {
  FONTS,
  applyFontFamily,
  startFontRun,
  applyFontSize,
  applyFontColor,
  startColorRun,
  currentFontId,
  currentSize,
  currentColor,
  DEFAULT_SIZE,
} from "@/lib/inline-style";
import { FontColorControl } from "./font-color-control";
import { MarcoShorthandsPanel } from "./marco-shorthands-panel";
import {
  AudioFrameIcon,
  ChecklistIcon,
  GoMarcoIcon,
  ShipIcon,
  ImageFrameIcon,
  ListIcon,
  PlusIcon,
  TextAlignIcon,
  VideoFrameIcon,
} from "@/components/icons";

const IMAGE_BUCKET = "doc-images";

type Props = {
  docId: string;
  userId: string; // owner uid — first path segment of every uploaded image
  initialTitle: string;
  initialHtml: string;
  initialPublish: PublishState | null; // existing published page for this doc, if any
};

// Collect the storage paths of every media item currently in the editor DOM,
// split by bucket. Images carry data-path on the <img>; videos carry data-path
// (the mp4) + data-poster-path (the thumbnail) on the <video> — both live in the
// doc-videos bucket. This query is the basis for orphan cleanup: compare against
// what we knew at the last save to find what the user deleted.
function mediaPathsIn(root: HTMLElement | null): {
  images: Set<string>;
  videos: Set<string>;
  audios: Set<string>;
} {
  const images = new Set<string>();
  const videos = new Set<string>();
  const audios = new Set<string>();
  root?.querySelectorAll<HTMLImageElement>("img[data-path]").forEach((img) => {
    const p = img.getAttribute("data-path");
    if (p) images.add(p);
  });
  root?.querySelectorAll<HTMLVideoElement>("video[data-path]").forEach((v) => {
    const p = v.getAttribute("data-path");
    const poster = v.getAttribute("data-poster-path");
    if (p) videos.add(p);
    if (poster) videos.add(poster);
  });
  root?.querySelectorAll<HTMLAudioElement>("audio[data-path]").forEach((a) => {
    const p = a.getAttribute("data-path");
    if (p) audios.add(p);
  });
  return { images, videos, audios };
}

type SaveState = "idle" | "saving" | "saved" | "error";

type Align = "left" | "center" | "right";

type ActiveMarks = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bullet: boolean;
  ordered: boolean;
  align: Align;
  heading: number | null; // 1–5, or null for normal paragraph
  fontId: string; // catalogue id of the selection's font, or "default"/"custom"
  fontSize: number; // size label at the caret (Word-style scale; body = 11)
  color: string; // inline colour at the caret as #rrggbb, or "" for default
};

const EMPTY_ACTIVE: ActiveMarks = {
  bold: false,
  italic: false,
  underline: false,
  bullet: false,
  ordered: false,
  align: "left",
  heading: null,
  fontId: "default",
  fontSize: DEFAULT_SIZE,
  color: "",
};

// Shared toolbar button styling (used by plain buttons and the dropdown triggers).
function toolbarBtnClass(active: boolean) {
  return `flex h-11 min-w-11 items-center justify-center gap-0.5 rounded-lg px-3 text-lg transition-colors ${
    active ? "bg-ink text-paper" : "text-ink hover:bg-paper-deep"
  }`;
}

// A self-contained toolbar dropdown: a trigger button + a centered menu that
// closes on outside click. `children` receives a `close` fn for menu items.
function ToolbarMenu({
  title,
  active,
  trigger,
  children,
}: {
  title: string;
  active?: boolean;
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={toolbarBtnClass(!!active || open)}
      >
        {trigger}
        <span className="text-[8px] leading-none opacity-70">▾</span>
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-20 mt-1 w-max min-w-[9rem] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-paper py-1 shadow-[0_12px_30px_-12px_rgba(33,28,20,0.55)]">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-paper-deep"
    >
      <span className="w-3 text-yolk-deep">{active ? "✓" : ""}</span>
      {children}
    </button>
  );
}

// ── "Go marco" shorthand helpers ──────────────────────────────────────────
// Match a typed font name ("times", "mono", "jet") to a catalogue entry, case-
// and punctuation-insensitively: exact id → label/​id prefix → substring.
function matchMarcoFont(query: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const q = norm(query);
  if (!q) return null;
  return (
    FONTS.find((f) => norm(f.id) === q) ??
    FONTS.find((f) => norm(f.label).startsWith(q)) ??
    FONTS.find((f) => norm(f.id).startsWith(q)) ??
    FONTS.find((f) => norm(f.label).includes(q)) ??
    null
  );
}

// Resolve a typed colour to something CSS accepts: #rgb / #rrggbb / bare hex, or
// any named CSS colour ("red", "rebeccapurple"). Returns null if unrecognised.
function normalizeMarcoColor(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const hex = v.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex) || /^[0-9a-f]{6}$/i.test(hex)) {
    const full =
      hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    return "#" + full.toLowerCase();
  }
  if (typeof CSS !== "undefined" && CSS.supports?.("color", v))
    return v.toLowerCase();
  return null;
}

export function DocumentEditor({
  docId,
  userId,
  initialTitle,
  initialHtml,
  initialPublish,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef(initialTitle); // latest title for save (avoids stale closure)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  // Storage paths referenced as of the last save. Diffing these against the live
  // DOM on each save tells us which media the user deleted → delete from storage.
  // Split by bucket because images and videos live in different buckets.
  const knownImagePaths = useRef<Set<string>>(new Set());
  const knownVideoPaths = useRef<Set<string>>(new Set());
  const knownAudioPaths = useRef<Set<string>>(new Set());
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialTitle);
  const [save, setSave] = useState<SaveState>("idle");
  // Transient banner for media notices — a validation error (e.g. video too
  // long) or a non-blocking warning (e.g. an HEVC clip may not play elsewhere).
  const [notice, setNotice] = useState<{
    kind: "error" | "warn";
    text: string;
  } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((kind: "error" | "warn", text: string) => {
    setNotice({ kind, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  }, []);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Gliding smooth caret — always on (see lib/use-smooth-caret.ts). Falls back
  // to the native caret on touch devices and under prefers-reduced-motion.
  useSmoothCaret(editorRef);
  // Publish-to-Web: current published page for this doc (drives the "live" dot
  // on the toolbar ship menu) + whether the publish dialog is open.
  const [publishState, setPublishState] = useState<PublishState | null>(
    initialPublish,
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [active, setActive] = useState<ActiveMarks>(EMPTY_ACTIVE);
  const [selectedFigure, setSelectedFigure] = useState<HTMLElement | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<HTMLElement | null>(null);

  // ── "Go marco" shorthand mode ─────────────────────────────────────────────
  // A modal formatter: toggle on, select text, type a short code, press Enter.
  // While on, keystrokes build a command buffer (shown in the HUD) instead of
  // being typed into the doc — Enter applies, Esc clears (or exits when empty).
  const [marco, setMarco] = useState(false);
  // Whether the right-gutter "Marco Shorthands" reference panel is expanded.
  const [marcoPanelOpen, setMarcoPanelOpen] = useState(false);
  const [marcoBuf, setMarcoBuf] = useState("");
  const [marcoFlash, setMarcoFlash] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const marcoBufRef = useRef(""); // logic source of truth (no stale closure on Enter)
  const marcoFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Save (debounced ~1s) ──────────────────────────────────────────────
  // Reads the LATEST title (ref) + body HTML at fire time, so it never saves
  // stale values. The saved HTML is our source of truth.
  const scheduleSave = useCallback(() => {
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const editor = editorRef.current;

      // Serialize from a clone so we can strip transient UI without touching the
      // live editor: the selection ring, and any in-progress placeholders (a
      // video still uploading/compressing, or a link card still loading) — those
      // get persisted only once they resolve to a real <video>/finished card.
      let html = "";
      if (editor) {
        const clone = editor.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll(".is-selected")
          .forEach((n) => n.classList.remove("is-selected"));
        // Drag handles are runtime-only UI (re-added on load by the observer
        // below) — never persist them into the saved HTML.
        clone
          .querySelectorAll("[data-drag-handle]")
          .forEach((n) => n.remove());
        clone
          .querySelectorAll(
            'figure[data-video][data-status], figure[data-audio][data-status], figure[data-link-card][data-status="loading"]',
          )
          .forEach((n) => n.remove());
        // Reset transient audio playback state so a half-played clip doesn't
        // persist a stale fill/“playing” flag into the saved HTML.
        clone.querySelectorAll("figure[data-audio]").forEach((f) => {
          (f as HTMLElement).style.removeProperty("--played");
          f.removeAttribute("data-playing");
        });
        // Strip the zero-width spaces that anchor "type-ahead" font runs (see
        // startFontRun) — they're a live-editing aid, not content.
        html = clone.innerHTML.replace(/\u200B/g, "");
      }

      // Orphan cleanup: any media we knew about that's no longer in the doc was
      // deleted by the user → remove it from its bucket. RLS lets us delete only
      // our own ‹uid›/… files. Best-effort (don't block or fail the save on it).
      const current = mediaPathsIn(editor);
      const removedImages = [...knownImagePaths.current].filter(
        (p) => !current.images.has(p),
      );
      const removedVideos = [...knownVideoPaths.current].filter(
        (p) => !current.videos.has(p),
      );
      const removedAudios = [...knownAudioPaths.current].filter(
        (p) => !current.audios.has(p),
      );
      if (removedImages.length) {
        supabase.storage.from(IMAGE_BUCKET).remove(removedImages);
      }
      if (removedVideos.length) {
        supabase.storage.from(VIDEO_BUCKET).remove(removedVideos);
      }
      if (removedAudios.length) {
        supabase.storage.from(AUDIO_BUCKET).remove(removedAudios);
      }
      knownImagePaths.current = current.images;
      knownVideoPaths.current = current.videos;
      knownAudioPaths.current = current.audios;

      const { error } = await supabase
        .from("documents")
        .update({
          title: titleRef.current.trim() || "Untitled",
          content: { version: 2, html },
          updated_at: new Date().toISOString(),
        })
        .eq("id", docId);
      setSave(error ? "error" : "saved");
    }, 1000);
  }, [docId, supabase]);

  // ── Toolbar state reflection ──────────────────────────────────────────
  // After any selection change, ask the browser which marks are active and
  // which heading (if any) the cursor sits in, to light up the toolbar.
  const refreshActive = useCallback(() => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || !sel.anchorNode || !editor.contains(sel.anchorNode)) {
      return;
    }
    let heading: number | null = null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editor) {
      if (node.nodeType === 1) {
        const m = /^H([1-5])$/.exec((node as HTMLElement).tagName);
        if (m) {
          heading = Number(m[1]);
          break;
        }
      }
      node = node.parentNode;
    }
    const align: Align = document.queryCommandState("justifyCenter")
      ? "center"
      : document.queryCommandState("justifyRight")
        ? "right"
        : "left";
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      bullet: document.queryCommandState("insertUnorderedList"),
      ordered: document.queryCommandState("insertOrderedList"),
      align,
      heading,
      fontId: currentFontId(editor),
      fontSize: currentSize(editor),
      color: currentColor(editor),
    });
  }, []);

  // Mount: seed the editor HTML once, and prefer <p> for new paragraphs.
  useEffect(() => {
    if (editorRef.current) {
      // Seed a brand-new (empty) doc with one real paragraph rather than "".
      // Typing into a truly empty contenteditable drops the first line in as a
      // bare text node (no <p>), so it misses the .doc-content p margin and hugs
      // the next line. Starting with <p><br></p> makes the first line a proper
      // paragraph like every line after it. The placeholder CSS still fires for
      // this single-empty-paragraph case (see .doc-content :has() rule).
      editorRef.current.innerHTML = initialHtml || "<p><br></p>";
      // Seed the known-media sets from what the doc opened with, so later
      // deletions can be detected and cleaned out of storage.
      const seed = mediaPathsIn(editorRef.current);
      knownImagePaths.current = seed.images;
      knownVideoPaths.current = seed.videos;
      knownAudioPaths.current = seed.audios;
      try {
        document.execCommand("defaultParagraphSeparator", false, "p");
      } catch {
        // not supported everywhere — harmless
      }
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Media drag handles ────────────────────────────────────────────────
  // Video/audio/link-card embeds carry interactive controls, so (unlike images)
  // they aren't dragged by grabbing their body — they get a small hover handle
  // that initiates the horizontal drag (see onEditorPointerDown). The handle is
  // runtime-only chrome: this observer adds one to every such figure as it
  // appears (insert / paste / drop / undo), and the save clone strips them so
  // they never land in the stored HTML.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const SELECTOR =
      "figure[data-video], figure[data-audio], figure[data-link-card]";
    const ensure = (fig: Element) => {
      if (fig.querySelector(":scope > [data-drag-handle]")) return;
      const handle = document.createElement("span");
      handle.setAttribute("data-drag-handle", "");
      handle.setAttribute("aria-hidden", "true");
      handle.title = "Drag to move";
      fig.appendChild(handle);
    };
    const sweep = (root: ParentNode) =>
      root.querySelectorAll(SELECTOR).forEach(ensure);
    sweep(editor);
    const obs = new MutationObserver((records) => {
      for (const rec of records) {
        rec.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          const el = n as HTMLElement;
          if (el.matches(SELECTOR)) ensure(el);
          sweep(el);
        });
      }
    });
    obs.observe(editor, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  // Track selection changes only while interacting with our editor.
  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  // ── Audio players ─────────────────────────────────────────────────────
  // Drive every custom audio player with ONE set of capture-phase listeners on
  // the editor. Media events (timeupdate/play/pause/…) don't bubble, but the
  // capture phase still reaches a parent — so this catches events from every
  // <audio>, including players restored from saved HTML, with no per-element
  // wiring and no re-hydration after insert. timeupdate drives the --played fill.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
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
    editor.addEventListener("timeupdate", onTime, true);
    editor.addEventListener("loadedmetadata", onMeta, true);
    editor.addEventListener("play", onPlay, true);
    editor.addEventListener("pause", onStop, true);
    editor.addEventListener("ended", onStop, true);
    return () => {
      editor.removeEventListener("timeupdate", onTime, true);
      editor.removeEventListener("loadedmetadata", onMeta, true);
      editor.removeEventListener("play", onPlay, true);
      editor.removeEventListener("pause", onStop, true);
      editor.removeEventListener("ended", onStop, true);
    };
  }, []);

  // ── Image selection ───────────────────────────────────────────────────
  // Keep the selection ring on exactly the chosen figure.
  useEffect(() => {
    editorRef.current
      ?.querySelectorAll("figure[data-img].is-selected")
      .forEach((f) => {
        if (f !== selectedFigure) f.classList.remove("is-selected");
      });
    selectedFigure?.classList.add("is-selected");
  }, [selectedFigure]);

  // Insert a node at the current caret inside the editor; if the caret isn't in
  // the editor (e.g. focus went to the file dialog), append at the end instead.
  const insertNodeAtCaret = useCallback((node: Node) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    let range: Range;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
      range.deleteContents();
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false); // end of document
    }
    // Never insert *inside* a non-editable block (an image/video/audio figure).
    // If the caret resolved into one, hop out to just after the outermost such
    // block so media always lands at the top level — otherwise figures nest
    // inside each other (e.g. a new player landing inside a previous player's
    // caption/time label), producing invalid HTML that breaks layout.
    let probe: Node | null = range.startContainer;
    let nonEditable: HTMLElement | null = null;
    while (probe && probe !== editor) {
      if (probe.nodeType === 1 && !(probe as HTMLElement).isContentEditable) {
        nonEditable = probe as HTMLElement;
      }
      probe = probe.parentNode;
    }
    if (nonEditable && nonEditable.parentNode) {
      range = document.createRange();
      range.setStartAfter(nonEditable);
      range.collapse(true);
    }
    // Remember the last node so we can drop the caret after it.
    const last = node.nodeType === 11 ? node.lastChild : node;
    range.insertNode(node);
    if (last) {
      const after = document.createRange();
      after.setStartAfter(last);
      after.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(after);
    }
  }, []);

  // ── Video + link-preview features ─────────────────────────────────────
  // Each lives in its own module and plugs in through these hooks; the editor
  // only delegates to them from the paste/drop/click handlers below.
  const { insertVideo, uploadingVideo } = useVideoInsert({
    supabase,
    userId,
    docId,
    insertNodeAtCaret,
    scheduleSave,
    knownVideoPaths,
    onError: (err) =>
      showNotice(
        "error",
        err instanceof Error ? err.message : "Couldn't add that video.",
      ),
    onWarn: (text) => showNotice("warn", text),
  });
  const { insertAudio, uploadingAudio } = useAudioInsert({
    supabase,
    userId,
    docId,
    insertNodeAtCaret,
    scheduleSave,
    knownAudioPaths,
    onError: (err) =>
      showNotice(
        "error",
        err instanceof Error ? err.message : "Couldn't add that audio.",
      ),
  });
  const { tryInsertLinkPreview, handlePreviewClick } = useLinkPreview({
    insertNodeAtCaret,
    scheduleSave,
  });

  // Click inside the editor selects an image's figure; clicking a caption keeps
  // the selection (so it stays editable); clicking elsewhere clears it.
  const onEditorClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // A click that lands on a drag handle is purely a (no-move) drag attempt —
      // never a play/seek/open/select. Swallow it so it doesn't fall through to
      // the link-card open or audio handlers below.
      if (target.closest("[data-drag-handle]")) return;
      // Toggle a checklist box.
      const box = target.closest("[data-check]");
      if (box) {
        box.closest("li")?.toggleAttribute("data-checked");
        scheduleSave();
        return;
      }
      // Audio player: play/pause button, or click-to-seek on the waveform.
      const audioFig = target.closest<HTMLElement>("figure[data-audio]");
      if (audioFig) {
        const audioEl = audioFig.querySelector("audio");
        if (audioEl) {
          if (target.closest("[data-audio-play]")) {
            if (audioEl.paused) {
              // play() rejects if the source can't be loaded/decoded (e.g. a
              // wrong content-type or a missing file). Catch it so it doesn't
              // surface as an unhandled "NotSupportedError" runtime overlay, and
              // tell the user what went wrong instead of failing silently.
              audioEl.play().catch((err) => {
                showNotice(
                  "error",
                  err instanceof Error && err.name === "NotSupportedError"
                    ? "This audio can’t be played — its file may be missing or in an unsupported format."
                    : "Couldn’t play this audio.",
                );
              });
            } else audioEl.pause();
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
        return; // don't fall through to figure selection
      }
      // Link-preview cards: play (inline embed) or open in a new tab.
      if (handlePreviewClick(e)) {
        e.preventDefault();
        return;
      }
      if (target.closest("figcaption")) return;
      // Select an image or a video figure (clears the other). Clicking the video
      // itself still drives its native controls — we don't preventDefault.
      setSelectedFigure(target.closest("figure[data-img]") as HTMLElement | null);
      setSelectedVideo(target.closest("figure[data-video]") as HTMLElement | null);
    },
    [scheduleSave, handlePreviewClick, showNotice],
  );

  // Outside mousedown clears the selection — unless it lands on the floating
  // image toolbar (data-image-overlay) or the selected figure itself.
  useEffect(() => {
    if (!selectedFigure) return;
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (selectedFigure?.contains(t)) return;
      if (t.closest("[data-image-overlay]")) return;
      setSelectedFigure(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selectedFigure]);

  // Same selection-ring + outside-click handling for the selected video figure.
  useEffect(() => {
    editorRef.current
      ?.querySelectorAll("figure[data-video].is-selected")
      .forEach((f) => {
        if (f !== selectedVideo) f.classList.remove("is-selected");
      });
    selectedVideo?.classList.add("is-selected");
  }, [selectedVideo]);

  useEffect(() => {
    if (!selectedVideo) return;
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (selectedVideo?.contains(t)) return;
      if (t.closest("[data-video-overlay]")) return;
      setSelectedVideo(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selectedVideo]);

  // ── Formatting commands ───────────────────────────────────────────────
  // execCommand mutates the DOM (handling all the Selection/Range edge cases);
  // we then re-read the HTML on save. Not the source of truth — just the tool.
  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      refreshActive();
      scheduleSave();
    },
    [refreshActive, scheduleSave],
  );

  const toggleHeading = useCallback(
    (level: number) => {
      // Clicking the current heading level again returns to a normal paragraph.
      const tag = active.heading === level ? "p" : `h${level}`;
      exec("formatBlock", `<${tag}>`);
    },
    [active.heading, exec],
  );

  // ── Font family + size (Word-style) ───────────────────────────────────────
  // With a selection: style it via lib/inline-style. With just a caret: start a
  // "type-ahead" run so whatever you type next (and following lines) comes out
  // in the chosen font — pick the font first, then write. refreshActive re-reads
  // the caret for the UI afterwards.
  const setFont = useCallback(
    (value: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      const changed =
        sel && !sel.isCollapsed
          ? applyFontFamily(editor, value)
          : startFontRun(editor, value);
      if (changed) {
        refreshActive();
        scheduleSave();
      }
    },
    [refreshActive, scheduleSave],
  );

  const nudgeSize = useCallback(
    (delta: number) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      if (applyFontSize(editor, currentSize(editor) + delta)) {
        refreshActive();
        scheduleSave();
      }
    },
    [refreshActive, scheduleSave],
  );

  // Font colour — same selection-vs-caret split as setFont. "" clears it.
  const setColor = useCallback(
    (color: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const sel = window.getSelection();
      const changed =
        sel && !sel.isCollapsed
          ? applyFontColor(editor, color)
          : startColorRun(editor, color);
      if (changed) {
        refreshActive();
        scheduleSave();
      }
    },
    [refreshActive, scheduleSave],
  );

  // The single funnel for every insert path (button / paste / drop): compress
  // in the browser, upload to ‹uid›/‹docId›/‹id›.webp, then drop a block figure.
  const insertImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setUploading(true);
      try {
        const { blob, width, height } = await compressImage(file);
        const imageId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const path = `${userId}/${docId}/${imageId}.webp`;

        const { error: upErr } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(path, blob, { contentType: "image/webp", upsert: false });
        if (upErr) throw upErr;

        const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);

        // Block figure (contenteditable=false so the image isn't editable),
        // followed by an empty paragraph so the caret has somewhere to land.
        const figure = document.createElement("figure");
        figure.setAttribute("data-img", "");
        figure.contentEditable = "false";
        const img = document.createElement("img");
        img.src = data.publicUrl;
        img.setAttribute("data-path", path); // for orphan cleanup
        img.width = width;
        img.height = height;
        img.alt = "";
        img.draggable = false;
        figure.appendChild(img);

        const trailing = document.createElement("p");
        trailing.appendChild(document.createElement("br"));

        const frag = document.createDocumentFragment();
        frag.appendChild(figure);
        frag.appendChild(trailing);
        insertNodeAtCaret(frag);

        knownImagePaths.current.add(path);
        scheduleSave();
      } catch (err) {
        console.error("Image insert failed", err);
        setSave("error");
      } finally {
        setUploading(false);
      }
    },
    [userId, docId, supabase, insertNodeAtCaret, scheduleSave],
  );

  // Paste: an image on the clipboard becomes an inserted picture; otherwise we
  // keep the existing plain-text-only paste behaviour (no raw HTML).
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = e.clipboardData?.files;
      const image =
        files && Array.from(files).find((f) => f.type.startsWith("image/"));
      if (image) {
        e.preventDefault();
        void insertImage(image);
        return;
      }
      const audio =
        files && Array.from(files).find((f) => f.type.startsWith("audio/"));
      if (audio) {
        e.preventDefault();
        void insertAudio(audio);
        return;
      }
      const text = e.clipboardData.getData("text/plain");
      // A lone URL becomes a rich preview card; anything else pastes as plain text.
      if (tryInsertLinkPreview(text)) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      document.execCommand("insertText", false, text);
      scheduleSave();
    },
    [insertImage, insertAudio, tryInsertLinkPreview, scheduleSave],
  );

  // Caret range at a screen point, but only if it lands inside the editor.
  const dropRangeAt = useCallback((x: number, y: number): Range | null => {
    const range = document.caretRangeFromPoint?.(x, y) ?? null;
    return range && editorRef.current?.contains(range.startContainer)
      ? range
      : null;
  }, []);

  // Drag a media figure left/right to set its horizontal position: a translateX
  // on the figure, clamped so it stays inside the editor column (text still flows
  // above and below — this only moves it on the x-axis). Pointer-based so it's
  // fluid and actually places, unlike native HTML5 drag inside contenteditable.
  //
  // Images are grabbed directly (the whole image is the drag surface). Video,
  // audio, and link-card embeds carry interactive controls, so grabbing their
  // body would hijack playback/seek/open — they're dragged by their small hover
  // handle instead (added by the observer above). A plain click with no movement
  // falls through to onEditorClick (image → select; others → their own handler).
  const onEditorPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      const editor = editorRef.current;
      if (!editor) return;

      let figure: HTMLElement | null = null;
      const handle = target.closest<HTMLElement>("[data-drag-handle]");
      if (handle) {
        figure = handle.closest<HTMLElement>(
          "figure[data-video], figure[data-audio], figure[data-link-card]",
        );
        // Don't let the handle drop a caret or start a text selection.
        if (figure) e.preventDefault();
      } else if (target.tagName === "IMG") {
        figure = target.closest<HTMLElement>("figure[data-img]");
      }
      if (!figure) return;

      // Re-select the figure after a move so its floating toolbar re-measures at
      // the new spot. Audio / link-card have no toolbar — nothing to re-measure.
      const reselect = (fig: HTMLElement) => {
        if (fig.matches("figure[data-img]")) setSelectedFigure(fig);
        else if (fig.matches("figure[data-video]")) setSelectedVideo(fig);
      };

      const edRect = editor.getBoundingClientRect();
      const figRect = figure.getBoundingClientRect();
      const startTx = parseFloat(figure.dataset.x || "0") || 0;
      const baseLeft = figRect.left - startTx; // figure's left without the transform
      const width = figRect.width;
      const startClientX = e.clientX;
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startClientX;
        if (!moved && Math.abs(dx) < 4) return; // ignore micro-jitter so clicks still select
        if (!moved) {
          moved = true;
          figure!.classList.add("is-dragging");
          // Hide any (now-stale) floating toolbar while dragging.
          setSelectedFigure(null);
          setSelectedVideo(null);
        }
        let tx = startTx + dx;
        const left = baseLeft + tx;
        if (left < edRect.left) tx += edRect.left - left;
        else if (left > edRect.right - width) tx -= left - (edRect.right - width);
        figure!.style.transform = `translateX(${tx.toFixed(1)}px)`;
        figure!.dataset.x = tx.toFixed(1);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (moved) {
          figure!.classList.remove("is-dragging");
          reselect(figure!);
          scheduleSave();
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [scheduleSave],
  );

  // External image files dropped from the desktop (internal moves use the
  // pointer drag above, not HTML5 drag).
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const all = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
      const images = all.filter((f) => f.type.startsWith("image/"));
      const videos = all.filter((f) => f.type.startsWith("video/"));
      const audios = all.filter((f) => f.type.startsWith("audio/"));
      if (images.length === 0 && videos.length === 0 && audios.length === 0) {
        return; // let the browser handle other drops
      }
      e.preventDefault();
      const r = dropRangeAt(e.clientX, e.clientY);
      if (r) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
      images.forEach((f) => void insertImage(f));
      videos.forEach((f) => void insertVideo(f));
      audios.forEach((f) => void insertAudio(f));
    },
    [dropRangeAt, insertImage, insertVideo, insertAudio],
  );

  // ── Checklist ─────────────────────────────────────────────────────────
  // A ul[data-checklist] whose <li>s carry a non-editable [data-check] box;
  // clicking the box toggles li[data-checked] (see onEditorClick), and Enter
  // inside one adds a new item / exits when empty (see onEditorKeyDown).
  const insertChecklist = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    // Find the <ul> the caret/selection currently sits in (if any).
    const closestUl = (): HTMLElement | null => {
      const a = window.getSelection()?.anchorNode ?? null;
      const el = a && (a.nodeType === 1 ? (a as HTMLElement) : a.parentElement);
      const ul = el?.closest("ul") ?? null;
      return ul && editor.contains(ul) ? (ul as HTMLElement) : null;
    };

    // Chromium's insertUnorderedList can leave the new <ul> wrapped in a <p>
    // (invalid: <ul> inside <p> → the browser splits it on reload, leaving a
    // stray empty line above the list). Hoist the list out so it's a direct
    // child of the editor.
    const unwrap = (ul: HTMLElement) => {
      let p = ul.parentElement;
      while (p && p !== editor && p.tagName !== "LI") {
        p.querySelectorAll(":scope > br").forEach((br) => br.remove());
        if (p.childNodes.length === 1) p.replaceWith(ul);
        else p.after(ul);
        p = ul.parentElement;
      }
    };

    // Give every <li> in a list a non-editable check box (idempotent).
    const decorate = (ul: HTMLElement) => {
      ul.setAttribute("data-checklist", "");
      ul.querySelectorAll<HTMLLIElement>(":scope > li").forEach((li) => {
        if (!li.querySelector(":scope > [data-check]")) {
          const box = document.createElement("span");
          box.setAttribute("data-check", "");
          box.setAttribute("contenteditable", "false");
          li.insertBefore(box, li.firstChild);
        }
      });
    };

    // Strip the checklist decoration so the list can toggle back to paragraphs.
    const undecorate = (ul: HTMLElement) => {
      ul.removeAttribute("data-checklist");
      ul.querySelectorAll("[data-check]").forEach((b) => b.remove());
      ul.querySelectorAll("li[data-checked]").forEach((li) =>
        li.removeAttribute("data-checked"),
      );
    };

    const existing = closestUl();
    if (existing?.hasAttribute("data-checklist")) {
      // Already a checklist → toggle OFF (back to plain paragraphs).
      undecorate(existing);
      document.execCommand("insertUnorderedList");
    } else if (existing) {
      // A plain bullet list → convert it into a checklist (don't un-list).
      decorate(existing);
    } else {
      // Plain paragraph(s) → let the browser turn the selected block(s) into a
      // <ul><li>…</li></ul> (it handles multi-line selections, splitting, and
      // caret placement), then decorate the new list as a checklist.
      document.execCommand("insertUnorderedList");
      const ul = closestUl();
      if (ul) {
        unwrap(ul);
        decorate(ul);
      }
    }
    scheduleSave();
  }, [scheduleSave]);

  // ── Export to PDF ─────────────────────────────────────────────────────
  // Build a PDF from the document and open it in a NEW TAB for viewing (never a
  // download — the user saves it from the browser's PDF viewer if they want).
  // The tab is opened synchronously inside the click gesture so the popup
  // blocker allows it; we then navigate it to the generated PDF's object URL.
  const handleExportPdf = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || exporting) return;
    const tab = window.open("", "_blank");
    if (tab) {
      tab.document.write(
        "<!doctype html><meta charset=utf-8><title>Preparing PDF…</title>" +
          '<body style="margin:0;display:grid;place-items:center;height:100vh;' +
          "background:#faf4e8;color:#6b6051;font:15px/1.5 ui-sans-serif,system-ui," +
          'sans-serif">Generating your PDF…</body>',
      );
    }
    setExporting(true);
    exportDocumentToPdf({ title: titleRef.current, editor, tab })
      .catch((err) => {
        console.error("PDF export failed", err);
        tab?.close();
        setSave("error");
      })
      .finally(() => setExporting(false));
  }, [exporting]);

  // ── Export to Markdown ────────────────────────────────────────────────
  // Build a .md file from the document and download it. Markdown isn't a
  // viewable format, so a download (not a new tab) is the natural fit — and
  // downloads aren't subject to the popup blocker, so this stays synchronous.
  const handleExportMarkdown = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      exportDocumentToMarkdown({ title: titleRef.current, editor });
    } catch (err) {
      console.error("Markdown export failed", err);
      setSave("error");
    }
  }, []);

  async function handleDelete() {
    if (!confirm("Move this document to trash?")) return;
    setDeleting(true);
    const { error } = await supabase
      .from("documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", docId);
    if (error) {
      setDeleting(false);
      setSave("error");
      return;
    }
    router.push("/workspace");
    router.refresh();
  }

  // ── "Go marco" shorthand: size setter, flash, dispatcher, key handler ─────
  // Set an absolute font size (the Word-style label the stepper shows; body=11).
  const setSize = useCallback(
    (n: number) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      if (applyFontSize(editor, Math.max(1, Math.min(400, n)))) {
        refreshActive();
        scheduleSave();
      }
    },
    [refreshActive, scheduleSave],
  );

  // Brief HUD confirmation: "polo" on success (Marco → Polo), else a miss note.
  const flashMarco = useCallback((text: string, ok: boolean) => {
    setMarcoFlash({ text, ok });
    if (marcoFlashTimer.current) clearTimeout(marcoFlashTimer.current);
    marcoFlashTimer.current = setTimeout(() => setMarcoFlash(null), 1100);
  }, []);

  // Map a committed code to the existing formatting actions. Case-insensitive;
  // matches the whole code (so `b`/`bd`, `e`/`eweb` never collide).
  const runMarco = useCallback(
    (raw: string): { ok: boolean; label: string } => {
      const trimmed = raw.trim();
      const lower = trimmed.toLowerCase();
      const sp = trimmed.indexOf(" ");
      const head = sp === -1 ? lower : lower.slice(0, sp);
      const value = sp === -1 ? "" : trimmed.slice(sp + 1).trim();

      switch (head) {
        case "b": exec("bold"); return { ok: true, label: "Bold" };
        case "i": exec("italic"); return { ok: true, label: "Italic" };
        case "u": exec("underline"); return { ok: true, label: "Underline" };
        case "l": exec("justifyLeft"); return { ok: true, label: "Left" };
        case "e": exec("justifyCenter"); return { ok: true, label: "Center" };
        case "r": exec("justifyRight"); return { ok: true, label: "Right" };
        case "p": exec("formatBlock", "<p>"); return { ok: true, label: "Normal text" };
        case "bd": exec("insertUnorderedList"); return { ok: true, label: "Bullets" };
        case "bn": exec("insertOrderedList"); return { ok: true, label: "Numbered" };
        case "bc": insertChecklist(); return { ok: true, label: "Checklist" };
        case "+": case "fs+": nudgeSize(1); return { ok: true, label: "Bigger" };
        case "-": case "fs-": nudgeSize(-1); return { ok: true, label: "Smaller" };
        case "ii": fileInputRef.current?.click(); return { ok: true, label: "Insert image" };
        case "iv": videoInputRef.current?.click(); return { ok: true, label: "Insert video" };
        case "ia": audioInputRef.current?.click(); return { ok: true, label: "Insert audio" };
        case "eweb": setPublishOpen(true); return { ok: true, label: "Publish" };
        case "epdf": handleExportPdf(); return { ok: true, label: "Export PDF" };
        case "emd": handleExportMarkdown(); return { ok: true, label: "Export Markdown" };
      }

      const h = head.match(/^h([1-5])$/);
      if (h) {
        exec("formatBlock", `<h${h[1]}>`);
        return { ok: true, label: `Heading ${h[1]}` };
      }

      const fs = lower.match(/^fs\s*(\d{1,3})$/);
      if (fs) {
        setSize(parseInt(fs[1], 10));
        return { ok: true, label: `Size ${fs[1]}` };
      }

      if (head === "fc") {
        if (!value) {
          setColor("");
          return { ok: true, label: "Default colour" };
        }
        const c = normalizeMarcoColor(value);
        if (!c) return { ok: false, label: trimmed };
        setColor(c);
        return { ok: true, label: `Colour ${c}` };
      }

      if (head === "f") {
        const font = matchMarcoFont(value);
        if (!font) return { ok: false, label: trimmed };
        setFont(font.value);
        return { ok: true, label: font.label };
      }

      return { ok: false, label: trimmed };
    },
    [
      exec,
      nudgeSize,
      setSize,
      setColor,
      setFont,
      insertChecklist,
      handleExportPdf,
      handleExportMarkdown,
    ],
  );

  // Keystroke capture while marco is on: build the buffer; Enter applies, Esc
  // clears (or exits when already empty), Backspace edits. Modifier combos and
  // navigation keys pass through (so arrow-selection still works).
  const handleMarcoKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "Enter") {
        e.preventDefault();
        const code = marcoBufRef.current.trim();
        if (!code) return;
        const res = runMarco(code);
        marcoBufRef.current = "";
        setMarcoBuf("");
        flashMarco(
          res.ok ? `polo — ${res.label}` : `no match: ${res.label}`,
          res.ok,
        );
        return;
      }
      if (k === "Escape") {
        e.preventDefault();
        if (marcoBufRef.current) {
          marcoBufRef.current = "";
          setMarcoBuf("");
        } else {
          setMarco(false);
        }
        return;
      }
      if (k === "Backspace") {
        e.preventDefault();
        marcoBufRef.current = marcoBufRef.current.slice(0, -1);
        setMarcoBuf(marcoBufRef.current);
        return;
      }
      if (k.length === 1) {
        e.preventDefault();
        marcoBufRef.current = (marcoBufRef.current + k).slice(0, 40);
        setMarcoBuf(marcoBufRef.current);
      }
      // other keys (arrows, Home/End, …) fall through untouched
    },
    [runMarco, flashMarco],
  );

  // ── Toolbar button helper ─────────────────────────────────────────────
  const btn = toolbarBtnClass;
  const activeFont = FONTS.find((f) => f.id === active.fontId) ?? null;

  // Keyboard: ⌘/Ctrl + E / L / R align shortcuts, and Enter behaviour inside a
  // checklist (new item, or exit the list when the current item is empty).
  const onEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Shorthand mode swallows typing and turns it into a command buffer.
      if (marco) {
        handleMarcoKey(e);
        return;
      }

      // Backspace at the very start of a block deletes a media embed sitting
      // just before it. Audio/video/image figures are atomic, non-editable
      // blocks, so this is the keyboard way to remove them; the next save's
      // orphan sweep then deletes the underlying file from storage.
      if (e.key === "Backspace" && !e.shiftKey) {
        const editor = editorRef.current;
        const sel = window.getSelection();
        if (editor && sel && sel.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const { startContainer, startOffset } = range;
          let atStart = false;
          let prev: Node | null = null;
          if (startContainer === editor) {
            atStart = true;
            prev = editor.childNodes[startOffset - 1] ?? null;
          } else {
            // Climb to the block that is a direct child of the editor.
            let block: Node = startContainer;
            while (block.parentNode && block.parentNode !== editor) {
              block = block.parentNode;
            }
            if (block.parentNode === editor) {
              const probe = document.createRange();
              probe.selectNodeContents(block);
              probe.setEnd(startContainer, startOffset);
              atStart = probe.toString().length === 0; // no text before caret
              prev = (block as ChildNode).previousSibling;
            }
          }
          // Skip blank whitespace text nodes between the block and the figure.
          while (prev && prev.nodeType === 3 && !prev.textContent?.trim()) {
            prev = prev.previousSibling;
          }
          if (
            atStart &&
            prev &&
            prev.nodeType === 1 &&
            (prev as HTMLElement).matches(
              "figure[data-audio], figure[data-video], figure[data-img]",
            )
          ) {
            e.preventDefault();
            // Delete through the editing pipeline (select the figure, then
            // execCommand) instead of a raw .remove(), so the deletion is
            // recorded on the browser's native undo stack and Cmd/Ctrl+Z
            // restores it — matching how video/link inserts undo.
            const del = document.createRange();
            del.selectNode(prev);
            sel.removeAllRanges();
            sel.addRange(del);
            document.execCommand("delete");
            setSelectedFigure(null);
            setSelectedVideo(null);
            scheduleSave();
            return;
          }
        }
      }

      // All formatting lives on Ctrl, never Cmd — that keeps Cmd+R/L/E free for
      // the browser (reload, address bar, …) and keeps one consistent modifier.
      // Alignment: Ctrl+L/R/E. Inline marks: Ctrl+B/U/I.
      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        const cmd =
          k === "l"
            ? "justifyLeft"
            : k === "r"
              ? "justifyRight"
              : k === "e"
                ? "justifyCenter"
                : k === "b"
                  ? "bold"
                  : k === "u"
                    ? "underline"
                    : k === "i"
                      ? "italic"
                      : null;
        if (cmd) {
          e.preventDefault();
          exec(cmd);
          return;
        }
      }

      // Suppress the browser's native Cmd+B/I/U so inline formatting only
      // happens via Ctrl; Cmd is reserved for browser shortcuts.
      if (e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "b" || k === "i" || k === "u") {
          e.preventDefault();
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        const sel = window.getSelection();
        const a = sel?.anchorNode ?? null;
        const el = a && (a.nodeType === 1 ? (a as HTMLElement) : a.parentElement);
        const li = el?.closest("li") ?? null;
        const ul = li?.parentElement ?? null;
        if (li && ul?.hasAttribute("data-checklist")) {
          e.preventDefault();
          const hasText = (li.textContent ?? "").replace(/ /g, "").trim().length > 0;
          if (!hasText) {
            // Empty item → leave the checklist.
            const p = document.createElement("p");
            p.appendChild(document.createElement("br"));
            ul.after(p);
            li.remove();
            if (!ul.querySelector("li")) ul.remove();
            const r = document.createRange();
            r.setStart(p, 0);
            r.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(r);
          } else {
            // New checklist item with its own box.
            const newLi = document.createElement("li");
            const box = document.createElement("span");
            box.setAttribute("data-check", "");
            box.setAttribute("contenteditable", "false");
            newLi.appendChild(box);
            li.after(newLi);
            const r = document.createRange();
            r.setStartAfter(box);
            r.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(r);
          }
          scheduleSave();
        }
      }
    },
    [exec, scheduleSave, marco, handleMarcoKey],
  );

  return (
    <main className="grain relative min-h-screen bg-paper text-ink">
      <div className="relative z-10 mx-auto max-w-5xl px-8 py-10">
        {/* Top bar — Back to desk (left), save status + Delete (right). */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            ← Back to desk
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-soft">
              {save === "saving" && "Saving…"}
              {save === "saved" && "Saved ✓"}
              {save === "error" && (
                <span className="text-red-700">Save failed</span>
              )}
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </header>

        {/* Transient media notice (validation error / HEVC warning). */}
        {notice && (
          <div
            role="status"
            className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
              notice.kind === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <span aria-hidden>{notice.kind === "error" ? "⚠" : "ⓘ"}</span>
            <span className="flex-1">{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-current/60 transition-opacity hover:opacity-70"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            titleRef.current = e.target.value;
            scheduleSave();
          }}
          placeholder="Untitled"
          maxLength={200}
          className="mt-10 w-full bg-transparent font-display text-4xl leading-tight tracking-tight text-ink outline-none placeholder:text-ink/25 sm:text-5xl"
          style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
        />

        {/* Formatting toolbar (sticky so it stays reachable while scrolling) */}
        <div className="sticky top-3 z-10 mt-6 flex flex-wrap items-center justify-center gap-1 rounded-[0.9rem] border border-line bg-paper/90 p-2 backdrop-blur">
          {/* Font family — applies to the selected text. Each item previews its
              own typeface; the trigger shows the current selection's font. */}
          <ToolbarMenu
            title="Font"
            active={active.fontId !== "default"}
            trigger={
              <span
                className="max-w-[7ch] truncate text-base"
                style={{ fontFamily: activeFont?.value || "inherit" }}
              >
                {activeFont ? activeFont.label : "Font"}
              </span>
            }
          >
            {(close) => (
              <>
                {FONTS.map((f) => (
                  <MenuItem
                    key={f.id}
                    active={active.fontId === f.id}
                    onClick={() => {
                      setFont(f.value);
                      close();
                    }}
                  >
                    <span style={{ fontFamily: f.value || "inherit" }}>
                      {f.label}
                    </span>
                  </MenuItem>
                ))}
              </>
            )}
          </ToolbarMenu>

          {/* Font size — two steppers (±1) around the current size. Selection-
              based; the number reflects the size at the caret (body = 11). */}
          <div className="flex items-center" title="Font size">
            <button
              type="button"
              aria-label="Decrease font size"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => nudgeSize(-1)}
              className="flex h-11 w-8 items-center justify-center rounded-lg text-xl text-ink transition-colors hover:bg-paper-deep"
            >
              −
            </button>
            <span className="min-w-[2ch] text-center text-sm tabular-nums text-ink">
              {active.fontSize}
            </span>
            <button
              type="button"
              aria-label="Increase font size"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => nudgeSize(1)}
              className="flex h-11 w-8 items-center justify-center rounded-lg text-xl text-ink transition-colors hover:bg-paper-deep"
            >
              +
            </button>
          </div>

          {/* Font colour — selection-based, mirrors the font controls. */}
          <FontColorControl
            currentColor={active.color}
            onPick={setColor}
            getEditor={() => editorRef.current}
          />

          <span className="mx-1 h-6 w-px bg-line" />

          <button
            type="button"
            aria-label="Bold"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("bold")}
            className={btn(active.bold)}
          >
            <span className="font-bold">B</span>
          </button>
          <button
            type="button"
            aria-label="Italic"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("italic")}
            className={btn(active.italic)}
          >
            <span className="italic">I</span>
          </button>
          <button
            type="button"
            aria-label="Underline"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("underline")}
            className={btn(active.underline)}
          >
            <span className="underline">U</span>
          </button>

          <span className="mx-1 h-6 w-px bg-line" />

          {/* Headings dropdown (trigger: a simple H) */}
          <ToolbarMenu
            title="Heading"
            active={active.heading !== null}
            trigger={<span className="font-display text-xl font-semibold">H</span>}
          >
            {(close) => (
              <>
                <MenuItem
                  active={active.heading === null}
                  onClick={() => {
                    exec("formatBlock", "<p>");
                    close();
                  }}
                >
                  Normal text
                </MenuItem>
                {[1, 2, 3, 4, 5].map((level) => (
                  <MenuItem
                    key={level}
                    active={active.heading === level}
                    onClick={() => {
                      toggleHeading(level);
                      close();
                    }}
                  >
                    Heading {level}
                  </MenuItem>
                ))}
              </>
            )}
          </ToolbarMenu>

          {/* Text-align dropdown (before List, per request) */}
          <ToolbarMenu
            title="Text align"
            active={active.align !== "left"}
            trigger={<TextAlignIcon className="h-6 w-6" />}
          >
            {(close) => (
              <>
                <MenuItem
                  active={active.align === "left"}
                  onClick={() => {
                    exec("justifyLeft");
                    close();
                  }}
                >
                  Left
                  <span className="ml-auto text-xs text-ink-soft">⌘L</span>
                </MenuItem>
                <MenuItem
                  active={active.align === "center"}
                  onClick={() => {
                    exec("justifyCenter");
                    close();
                  }}
                >
                  Center
                  <span className="ml-auto text-xs text-ink-soft">⌘E</span>
                </MenuItem>
                <MenuItem
                  active={active.align === "right"}
                  onClick={() => {
                    exec("justifyRight");
                    close();
                  }}
                >
                  Right
                  <span className="ml-auto text-xs text-ink-soft">⌘R</span>
                </MenuItem>
              </>
            )}
          </ToolbarMenu>

          {/* Lists dropdown */}
          <ToolbarMenu
            title="List"
            active={active.bullet || active.ordered}
            trigger={<ListIcon className="h-6 w-6" />}
          >
            {(close) => (
              <>
                <MenuItem
                  active={active.bullet}
                  onClick={() => {
                    exec("insertUnorderedList");
                    close();
                  }}
                >
                  • Bulleted
                </MenuItem>
                <MenuItem
                  active={active.ordered}
                  onClick={() => {
                    exec("insertOrderedList");
                    close();
                  }}
                >
                  1. Numbered
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    insertChecklist();
                    close();
                  }}
                >
                  <ChecklistIcon className="h-4 w-4" /> Checklist
                </MenuItem>
              </>
            )}
          </ToolbarMenu>

          <span className="mx-1 h-6 w-px bg-line" />

          {/* Insert dropdown — one trigger for Image / Video / Audio. Each item
              opens the matching hidden file input; the trigger lights up while
              any insert is in flight, and a busy item shows "Adding…". */}
          <ToolbarMenu
            title="Insert media"
            active={uploading || uploadingVideo || uploadingAudio}
            trigger={<PlusIcon className="h-6 w-6" />}
          >
            {(close) => (
              <>
                <MenuItem
                  onClick={() => {
                    fileInputRef.current?.click();
                    close();
                  }}
                >
                  <ImageFrameIcon className="h-4 w-4" />
                  {uploading ? "Adding…" : "Image"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    videoInputRef.current?.click();
                    close();
                  }}
                >
                  <VideoFrameIcon className="h-4 w-4" />
                  {uploadingVideo ? "Adding…" : "Video"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    audioInputRef.current?.click();
                    close();
                  }}
                >
                  <AudioFrameIcon className="h-4 w-4" />
                  {uploadingAudio ? "Adding…" : "Audio"}
                </MenuItem>
              </>
            )}
          </ToolbarMenu>

          {/* Hidden pickers; reset value so the same file can be re-chosen. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void insertImage(f);
              e.target.value = "";
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept={VIDEO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void insertVideo(f);
              e.target.value = "";
            }}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void insertAudio(f);
              e.target.value = "";
            }}
          />

          <span className="mx-1 h-6 w-px bg-line" />

          {/* Share menu — set the document out into the world. A ship icon opens
              a dropdown: Publish (a public <slug>.tiro.works page) or Export to
              PDF (opens the rendered doc in a new tab). A yolk dot marks the ship
              when the doc is currently published. */}
          <ToolbarMenu
            title="Publish or export"
            active={exporting}
            trigger={
              <span className="relative inline-flex">
                <ShipIcon className="h-6 w-6" />
                {publishState && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-yolk ring-2 ring-paper" />
                )}
              </span>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  onClick={() => {
                    close();
                    setPublishOpen(true);
                  }}
                >
                  {publishState ? "Manage published page" : "Publish to web"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close();
                    handleExportPdf();
                  }}
                >
                  Export to PDF
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close();
                    handleExportMarkdown();
                  }}
                >
                  Export to Markdown
                </MenuItem>
              </>
            )}
          </ToolbarMenu>

          <span className="mx-1 h-6 w-px bg-line" />

          {/* "Go marco" — shorthand formatting mode. Toggle on, select text, type
              a code (h1, b, fc red…) and press Enter. The zigzag glyph nods to
              Tiro, inventor of shorthand. */}
          <button
            type="button"
            title={
              marco
                ? "Exit shorthand mode (Esc)"
                : "Go marco — shorthand formatting"
            }
            aria-label="Shorthand formatting mode"
            aria-pressed={marco}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              marcoBufRef.current = "";
              setMarcoBuf("");
              setMarcoFlash(null);
              setMarcoPanelOpen(false); // panel starts collapsed each time
              setMarco((m) => !m);
              editorRef.current?.focus();
            }}
            className={btn(marco)}
          >
            <GoMarcoIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Body — contenteditable rich text. Wrapped in a relative container.
            While marco is on (desktop), reserve a right gutter so the writing box
            narrows and the Marco Shorthands panel docks OUTSIDE it, to its right
            (also tightens the line measure to ~74ch — better for reading). */}
        <div
          className={`relative transition-[padding] duration-200 ease-out motion-reduce:transition-none ${
            marco ? "lg:pr-[18rem]" : ""
          }`}
        >
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            data-placeholder="Start writing…"
            onInput={scheduleSave}
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onPointerDown={onEditorPointerDown}
            onClick={onEditorClick}
            onKeyDown={onEditorKeyDown}
            onKeyUp={refreshActive}
            onMouseUp={refreshActive}
            className={`doc-content mt-6 min-h-[55vh] w-full rounded-lg text-ink transition-shadow ${
              marco ? "shadow-[0_0_0_2px_var(--yolk)]" : ""
            }`}
          />

          {/* Shorthand reference — only while marco is on; gutter-anchored. */}
          {marco && (
            <MarcoShorthandsPanel
              open={marcoPanelOpen}
              onToggle={() => setMarcoPanelOpen((o) => !o)}
            />
          )}
        </div>

        {/* Contextual image-editing toolbar (floats over the selected image). */}
        {selectedFigure && (
          <ImageToolbar
            figure={selectedFigure}
            editorRef={editorRef}
            supabase={supabase}
            bucket={IMAGE_BUCKET}
            userId={userId}
            docId={docId}
            onChange={scheduleSave}
            onClose={() => setSelectedFigure(null)}
          />
        )}

        {/* Contextual video toolbar (floats over the selected video). */}
        {selectedVideo && (
          <VideoToolbar
            figure={selectedVideo}
            editorRef={editorRef}
            onChange={scheduleSave}
            onClose={() => setSelectedVideo(null)}
          />
        )}

        {/* "Go marco" HUD — a floating status pill while shorthand mode is on:
            the code you're typing, a hint, and a transient "polo" confirmation.
            pointer-events-none so it never intercepts clicks or selection. */}
        {marco && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center">
            {marcoFlash && (
              <div
                className={`mb-2 rounded-full px-3 py-1 text-sm font-medium shadow-[0_8px_20px_-8px_rgba(33,28,20,0.55)] ${
                  marcoFlash.ok ? "bg-yolk text-ink" : "bg-red-600 text-white"
                }`}
              >
                {marcoFlash.text}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full border border-line bg-paper/95 px-3 py-2 shadow-[0_12px_30px_-12px_rgba(33,28,20,0.55)] backdrop-blur">
              <GoMarcoIcon className="h-4 w-4 text-yolk-deep" />
              <span className="text-xs font-semibold uppercase tracking-wide text-yolk-deep">
                marco
              </span>
              <code className="min-w-[3ch] rounded bg-paper-deep px-1.5 py-0.5 font-mono text-sm text-ink">
                {marcoBuf || <span className="text-ink/40">type a code…</span>}
              </code>
              <span className="text-xs text-ink-soft">
                Enter to apply · Esc to exit
              </span>
            </div>
          </div>
        )}

        {/* Publish-to-Web dialog (opened from the ship menu). */}
        <PublishDialog
          docId={docId}
          state={publishState}
          setState={setPublishState}
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
        />
      </div>
    </main>
  );
}
