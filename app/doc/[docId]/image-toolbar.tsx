"use client";

// This overlay imperatively edits the contenteditable <figure>/<img> nodes it
// is handed (that's the whole point of an image-editing toolbar), and syncs an
// overlay position from those DOM rects. The React-Compiler immutability /
// set-state-in-effect rules don't model that imperative DOM work, so we opt out
// of those two here only.
/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compressImage } from "@/lib/compress-image";
import { AlignIcon, TrashIcon } from "@/components/icons";

// Slider 0–100 → border-radius 0%–40%. Capped below 50% so the corners get very
// round but the image never collapses into a circle/ellipse.
const RADIUS_MAX_PCT = 40;
const DEFAULT_RADIUS = 12; // slider position for a freshly-inserted image

type Props = {
  figure: HTMLElement; // the selected <figure data-img>
  editorRef: React.RefObject<HTMLDivElement | null>;
  supabase: SupabaseClient;
  bucket: string;
  userId: string;
  docId: string;
  onChange: () => void; // schedule a save after a mutation
  onClose: () => void; // deselect
};

type Rect = { left: number; top: number; right: number; bottom: number; width: number };

const FILTERS = ["grayscale", "sepia", "contrast"] as const;

export function ImageToolbar({
  figure,
  editorRef,
  supabase,
  bucket,
  userId,
  docId,
  onChange,
  onClose,
}: Props) {
  const img = figure.querySelector("img") as HTMLImageElement | null;
  const [rect, setRect] = useState<Rect | null>(null);
  const [cropping, setCropping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [roundOpen, setRoundOpen] = useState(false);
  const alignRef = useRef<HTMLDivElement>(null);
  // Forces a re-read of figure attributes so active states on the buttons update.
  const [, force] = useState(0);
  const bump = useCallback(() => force((n) => n + 1), []);

  // Close the align dropdown on an outside click.
  useEffect(() => {
    if (!alignOpen) return;
    function onDown(e: MouseEvent) {
      if (!alignRef.current?.contains(e.target as Node)) setAlignOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [alignOpen]);

  // Keep the overlay glued to the image as the page scrolls / resizes / edits.
  const measure = useCallback(() => {
    if (!img) return;
    const r = img.getBoundingClientRect();
    setRect({
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
    });
  }, [img]);

  useEffect(() => {
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // After a mutation: re-measure, refresh button states, and schedule a save.
  const changed = useCallback(() => {
    measure();
    bump();
    onChange();
  }, [measure, bump, onChange]);

  // ── Non-destructive edits (attributes / inline style on figure & img) ──────
  const setAlign = useCallback(
    (align: "left" | "center" | "right") => {
      figure.dataset.align = align;
      changed();
    },
    [figure, changed],
  );

  const toggleFlip = useCallback(
    (axis: "h" | "v") => {
      if (!img) return;
      const key = axis === "h" ? "flipH" : "flipV";
      if (img.dataset[key] === "1") delete img.dataset[key];
      else img.dataset[key] = "1";
      changed();
    },
    [img, changed],
  );

  const toggleFilter = useCallback(
    (filter: (typeof FILTERS)[number]) => {
      if (!img) return;
      if (img.dataset.filter === filter) delete img.dataset.filter;
      else img.dataset.filter = filter;
      changed();
    },
    [img, changed],
  );

  // Slider 0–100 → inline border-radius (capped via RADIUS_MAX_PCT so it never
  // reaches a circle/ellipse). Stored as data-radius so the slider can restore.
  const setRadius = useCallback(
    (value: number) => {
      if (!img) return;
      img.dataset.radius = String(value);
      img.style.borderRadius = `${((value / 100) * RADIUS_MAX_PCT).toFixed(1)}%`;
      changed();
    },
    [img, changed],
  );

  const toggleCaption = useCallback(() => {
    let cap = figure.querySelector("figcaption");
    if (cap) {
      cap.remove();
    } else {
      cap = document.createElement("figcaption");
      cap.setAttribute("contenteditable", "true");
      cap.setAttribute("data-caption", "");
      figure.appendChild(cap);
      (cap as HTMLElement).focus();
    }
    changed();
  }, [figure, changed]);

  const remove = useCallback(() => {
    figure.remove();
    onChange();
    onClose();
  }, [figure, onChange, onClose]);

  // ── Resize (drag the bottom-right handle) ──────────────────────────────────
  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const editor = editorRef.current;
      if (!editor) return;
      const startX = e.clientX;
      const startWidth = figure.getBoundingClientRect().width;
      const editorWidth = editor.clientWidth;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const next = startWidth + (ev.clientX - startX);
        const pct = Math.min(100, Math.max(10, (next / editorWidth) * 100));
        figure.style.width = `${pct.toFixed(1)}%`;
        measure();
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        changed();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [figure, editorRef, measure, changed],
  );

  if (!img || !rect) return null;

  const flipH = img.dataset.flipH === "1";
  const flipV = img.dataset.flipV === "1";
  const filter = img.dataset.filter;
  const radius =
    img.dataset.radius != null ? Number(img.dataset.radius) : DEFAULT_RADIUS;
  const align = figure.dataset.align || "center";
  const hasCaption = !!figure.querySelector("figcaption");

  return (
    <div data-image-overlay>
      {/* Resize handle at the image's bottom-right corner */}
      <div
        onPointerDown={onResizeDown}
        style={{
          position: "fixed",
          left: rect.right - 7,
          top: rect.bottom - 7,
          zIndex: 50,
        }}
        className="h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-paper bg-yolk-deep shadow"
        aria-label="Resize image"
      />

      {/* The toolbar, centered above the image */}
      <div
        style={{
          position: "fixed",
          left: rect.left + rect.width / 2,
          top: Math.max(8, rect.top - 46),
          transform: "translateX(-50%)",
          zIndex: 50,
        }}
        className="flex items-center gap-0.5 rounded-xl border border-line bg-paper/95 p-1 text-ink shadow-[0_12px_30px_-12px_rgba(33,28,20,0.55)] backdrop-blur"
      >
        {/* Align dropdown (1-D horizontal placement) */}
        <div ref={alignRef} style={{ position: "relative" }}>
          <Btn
            active={alignOpen}
            label={<AlignIcon />}
            title="Align"
            onClick={() => setAlignOpen((o) => !o)}
          />
          {alignOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 w-28 overflow-hidden rounded-lg border border-line bg-paper py-1 shadow-[0_12px_30px_-12px_rgba(33,28,20,0.55)]">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setAlign(a);
                    setAlignOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs capitalize text-ink transition-colors hover:bg-paper-deep"
                >
                  <span className="w-3 text-yolk-deep">
                    {align === a ? "✓" : ""}
                  </span>
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
        <Divider />
        <Btn active={flipH} label="⇋" title="Flip horizontal" onClick={() => toggleFlip("h")} />
        <Btn active={flipV} label="⇅" title="Flip vertical" onClick={() => toggleFlip("v")} />
        <Divider />
        {FILTERS.map((f) => (
          <Btn
            key={f}
            active={filter === f}
            label={f === "grayscale" ? "B&W" : f === "sepia" ? "Sepia" : "Contrast"}
            title={f}
            onClick={() => toggleFilter(f)}
          />
        ))}
        <Divider />
        {/* Corner rounding: a "Round" button that fades into a slider on click.
            0 = sharp, 100 = very round (capped below a circle/ellipse). */}
        {roundOpen ? (
          <label
            title="Corner rounding"
            className="tool-fade-in flex items-center px-1.5"
          >
            <input
              type="range"
              min={0}
              max={100}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="h-1 w-20 cursor-pointer"
              style={{ accentColor: "var(--yolk-deep)" }}
              autoFocus
            />
          </label>
        ) : (
          <Btn
            active={radius > 0}
            label="Round"
            title="Round corners"
            onClick={() => setRoundOpen(true)}
          />
        )}
        <Divider />
        <Btn label="Crop" title="Crop (destructive)" onClick={() => setCropping(true)} disabled={busy} />
        <Btn active={hasCaption} label="Caption" title="Toggle caption" onClick={toggleCaption} />
        <Divider />
        <Btn label={<TrashIcon />} title="Delete image" onClick={remove} danger />
      </div>

      {cropping && (
        <CropOverlay
          img={img}
          figure={figure}
          rect={rect}
          supabase={supabase}
          bucket={bucket}
          userId={userId}
          docId={docId}
          setBusy={setBusy}
          onDone={() => {
            setCropping(false);
            changed();
          }}
          onCancel={() => setCropping(false)}
        />
      )}
    </div>
  );
}

function Btn({
  label,
  title,
  onClick,
  active,
  danger,
  disabled,
}: {
  label: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs transition-colors disabled:opacity-40 ${
        danger
          ? "text-red-700 hover:bg-red-50"
          : active
            ? "bg-ink text-paper"
            : "text-ink hover:bg-paper-deep"
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-line" />;
}

// ── Destructive crop ─────────────────────────────────────────────────────────
// User drags a rectangle over the image; on Apply we fetch the source bytes
// (avoids canvas cross-origin tainting), crop on a canvas, re-encode WebP,
// upload as a NEW file, and swap the <img> src + data-path. The old file is no
// longer referenced, so the editor's reconcile-on-save sweeps it from storage.
function CropOverlay({
  img,
  figure,
  rect,
  supabase,
  bucket,
  userId,
  docId,
  setBusy,
  onDone,
  onCancel,
}: {
  img: HTMLImageElement;
  figure: HTMLElement;
  rect: Rect;
  supabase: SupabaseClient;
  bucket: string;
  userId: string;
  docId: string;
  setBusy: (b: boolean) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  // Crop selection in viewport coordinates.
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const imgRect = img.getBoundingClientRect();

  const clampToImage = (x: number, y: number) => ({
    x: Math.min(Math.max(x, imgRect.left), imgRect.right),
    y: Math.min(Math.max(y, imgRect.top), imgRect.bottom),
  });

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const p = clampToImage(e.clientX, e.clientY);
    dragStart.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const p = clampToImage(e.clientX, e.clientY);
    const s = dragStart.current;
    setSel({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };
  const onUp = () => {
    dragStart.current = null;
  };

  async function apply() {
    if (!sel || sel.w < 8 || sel.h < 8) {
      onCancel();
      return;
    }
    setBusy(true);
    try {
      // Map the on-screen selection to natural pixel coordinates.
      const scaleX = img.naturalWidth / imgRect.width;
      const scaleY = img.naturalHeight / imgRect.height;
      const cropX = Math.round((sel.x - imgRect.left) * scaleX);
      const cropY = Math.round((sel.y - imgRect.top) * scaleY);
      const cropW = Math.round(sel.w * scaleX);
      const cropH = Math.round(sel.h * scaleY);

      // Fetch the bytes (not the tainted <img>) so the canvas stays readable.
      const resp = await fetch(img.src);
      const srcBlob = await resp.blob();
      const bitmap = await createImageBitmap(srcBlob);

      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      bitmap.close();

      const croppedBlob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/webp", 0.85),
      );
      if (!croppedBlob) throw new Error("crop encode failed");

      // Compress the cropped result through the same pipeline, then upload anew.
      const file = new File([croppedBlob], "crop.webp", { type: "image/webp" });
      const { blob, width, height } = await compressImage(file);
      const imageId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const path = `${userId}/${docId}/${imageId}.webp`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (error) throw error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      img.src = data.publicUrl;
      img.setAttribute("data-path", path); // old path now unreferenced → swept on save
      img.width = width;
      img.height = height;
      // Reset width to natural so the crop isn't stretched by an old figure width.
      figure.style.removeProperty("width");
      onDone();
    } catch (err) {
      console.error("Crop failed", err);
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-image-overlay
      onMouseDown={(e) => e.preventDefault()}
      style={{ position: "fixed", inset: 0, zIndex: 60 }}
    >
      {/* Dimmed catch-all; drawing happens over the image area. */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        style={{
          position: "fixed",
          left: imgRect.left,
          top: imgRect.top,
          width: imgRect.width,
          height: imgRect.height,
          cursor: "crosshair",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        {sel && (
          <div
            style={{
              position: "fixed",
              left: sel.x,
              top: sel.y,
              width: sel.w,
              height: sel.h,
              border: "2px solid var(--yolk-deep, #c98a00)",
              background: "rgba(255,255,255,0.12)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Apply / Cancel */}
      <div
        style={{
          position: "fixed",
          left: rect.left + rect.width / 2,
          top: Math.min(window.innerHeight - 44, imgRect.bottom + 8),
          transform: "translateX(-50%)",
          zIndex: 61,
        }}
        className="flex items-center gap-1 rounded-xl border border-line bg-paper p-1 shadow"
      >
        <Btn label="Apply crop" title="Apply crop" onClick={apply} />
        <Btn label="Cancel" title="Cancel" onClick={onCancel} />
      </div>
    </div>
  );
}
