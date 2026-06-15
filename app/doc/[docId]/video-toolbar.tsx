"use client";

// Floating toolbar for a selected video <figure data-video>. Like the image
// toolbar it imperatively edits the contenteditable nodes it's handed and syncs
// its position from their DOM rects, so we opt out of the two React-Compiler
// rules that don't model that imperative work.
/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlignIcon, TrashIcon } from "@/components/icons";

type Props = {
  figure: HTMLElement; // the selected <figure data-video>
  editorRef: React.RefObject<HTMLDivElement | null>;
  onChange: () => void; // schedule a save after a mutation
  onClose: () => void; // deselect
};

type Rect = { left: number; top: number; right: number; bottom: number; width: number };

export function VideoToolbar({ figure, editorRef, onChange, onClose }: Props) {
  const media = figure.querySelector("video") as HTMLVideoElement | null;
  const [rect, setRect] = useState<Rect | null>(null);
  const [alignOpen, setAlignOpen] = useState(false);
  const alignRef = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);
  const bump = useCallback(() => force((n) => n + 1), []);

  useEffect(() => {
    if (!alignOpen) return;
    function onDown(e: MouseEvent) {
      if (!alignRef.current?.contains(e.target as Node)) setAlignOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [alignOpen]);

  // Glue the overlay to the video as the page scrolls / resizes / edits.
  const measure = useCallback(() => {
    if (!media) return;
    const r = media.getBoundingClientRect();
    setRect({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width });
  }, [media]);

  useEffect(() => {
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const changed = useCallback(() => {
    measure();
    bump();
    onChange();
  }, [measure, bump, onChange]);

  const setAlign = useCallback(
    (align: "left" | "center" | "right") => {
      figure.dataset.align = align;
      changed();
    },
    [figure, changed],
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

  // Resize: drag the bottom-right handle to set the figure width as a % of the
  // editor column (same model as images).
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
        const pct = Math.min(100, Math.max(20, (next / editorWidth) * 100));
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

  if (!media || !rect) return null;

  const align = figure.dataset.align || "center";
  const hasCaption = !!figure.querySelector("figcaption");

  return (
    <div data-video-overlay>
      {/* Resize handle at the video's bottom-right corner */}
      <div
        onPointerDown={onResizeDown}
        style={{ position: "fixed", left: rect.right - 7, top: rect.bottom - 7, zIndex: 50 }}
        className="h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-paper bg-yolk-deep shadow"
        aria-label="Resize video"
      />

      {/* Toolbar centered above the video */}
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
        <div ref={alignRef} style={{ position: "relative" }}>
          <Btn active={alignOpen} label={<AlignIcon />} title="Align" onClick={() => setAlignOpen((o) => !o)} />
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
                  <span className="w-3 text-yolk-deep">{align === a ? "✓" : ""}</span>
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
        <Divider />
        <Btn active={hasCaption} label="Caption" title="Toggle caption" onClick={toggleCaption} />
        <Divider />
        <Btn label={<TrashIcon />} title="Delete video" onClick={remove} danger />
      </div>
    </div>
  );
}

function Btn({
  label,
  title,
  onClick,
  active,
  danger,
}: {
  label: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs transition-colors ${
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
