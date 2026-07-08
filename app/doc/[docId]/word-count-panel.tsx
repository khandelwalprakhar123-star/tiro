"use client";

import { useEffect, useRef, useState } from "react";

// Count words the way Google Docs does: any run of non-whitespace is one word.
function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * A small floating, draggable word-counter panel — pinned bottom-centre by
 * default. It reads counts straight off the live editor:
 *  - no (or collapsed) selection  → total words in the document
 *  - a non-empty selection inside  → words in that selection (shown statically,
 *    i.e. the number jumps straight to the total; no 1→2→…→N animation)
 *
 * Self-contained: it owns its own listeners and drag position, so the parent
 * only decides whether it's mounted (`onClose` lets it dismiss itself too).
 */
export function WordCountPanel({
  editorRef,
  onClose,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const [count, setCount] = useState(0);
  const [scope, setScope] = useState<"doc" | "selection">("doc");

  // Drag position. `null` means "use the default bottom-centre placement";
  // once dragged we switch to explicit top-left pixel coordinates.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Offset between the pointer and the panel's top-left corner during a drag.
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  // ── Word counting: recompute on selection change + editor edits ───────────
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const update = () => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        // Only treat it as a selection count if the selection lives in the editor.
        if (editor.contains(range.commonAncestorContainer)) {
          setScope("selection");
          setCount(countWords(sel.toString()));
          return;
        }
      }
      setScope("doc");
      setCount(countWords(editor.innerText ?? editor.textContent ?? ""));
    };

    update();
    document.addEventListener("selectionchange", update);
    editor.addEventListener("input", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      editor.removeEventListener("input", update);
    };
  }, [editorRef]);

  // ── Dragging (pointer events) ─────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    // Don't start a drag from the close button.
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top }); // pin to current spot before moving
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const off = dragOffset.current;
    if (!off) return;
    const rect = panelRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 0;
    const h = rect?.height ?? 0;
    // Keep the panel fully on-screen.
    const x = Math.min(Math.max(0, e.clientX - off.dx), window.innerWidth - w);
    const y = Math.min(Math.max(0, e.clientY - off.dy), window.innerHeight - h);
    setPos({ x, y });
  };

  const endDrag = (e: React.PointerEvent) => {
    dragOffset.current = null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId))
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const positioned = pos !== null;

  return (
    <div
      ref={panelRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={
        positioned
          ? { left: pos.x, top: pos.y }
          : { left: "50%", bottom: "1.5rem", transform: "translateX(-50%)" }
      }
      className="fixed z-50 flex cursor-grab touch-none select-none items-center gap-3 rounded-xl border border-line bg-paper px-4 py-2.5 shadow-[0_12px_30px_-12px_rgba(33,28,20,0.55)] active:cursor-grabbing"
    >
      <span className="text-2xl font-semibold tabular-nums text-ink">
        {count}
      </span>
      <span className="text-xs uppercase tracking-wide text-ink-soft">
        {scope === "selection" ? "words selected" : "words"}
      </span>
      <button
        type="button"
        data-no-drag
        aria-label="Close word counter"
        title="Close"
        onClick={onClose}
        className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
