"use client";

import { useEffect } from "react";

/**
 * PROTOTYPE — a smooth, gliding text caret for the contenteditable editor.
 *
 * The browser draws the native caret and won't let us animate its movement, so
 * the trick is: hide the native caret (`caret-color: transparent`, added here
 * via the `smooth-caret-host` class) and draw our own — a thin ink bar that
 * *transitions* between positions instead of snapping. The result reads like a
 * pen nib gliding across the page.
 *
 * Framework-free: it reads the caret's pixel position straight off the native
 * Selection/Range API (the same API the editor already uses everywhere), so it
 * needs no editor library.
 *
 * Honest prototype caveats (see the chat): IME/composition and coarse-pointer
 * (touch) devices fall back to the native caret; empty lines use an element
 * rect fallback; reduced-motion disables the whole thing.
 */
export function useSmoothCaret(
  editorRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Respect the user's motion preference: leave the native caret alone.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Touch / coarse pointers: native caret + on-screen keyboard behave better.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    // Build our caret element once and park it on <body> (position: fixed, so
    // it lives in viewport coordinates — no offset-parent math).
    const caret = document.createElement("div");
    caret.className = "smooth-caret blink";
    caret.setAttribute("aria-hidden", "true");
    document.body.appendChild(caret);

    // Hide the real caret only while ours is active.
    editor.classList.add("smooth-caret-host");

    let raf = 0;
    let blinkResume: ReturnType<typeof setTimeout> | null = null;
    let lastX = NaN;
    let lastY = NaN;

    // Where is the collapsed caret, in viewport pixels? null = don't show ours.
    function caretRect(): { x: number; y: number; h: number } | null {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;

      const range = sel.getRangeAt(0);
      // Only when the caret is actually inside the editor and it has focus.
      if (!editor || !editor.contains(range.startContainer)) return null;
      if (
        document.activeElement !== editor &&
        !editor.contains(document.activeElement)
      ) {
        return null;
      }

      // Caret height from the font size at the caret (a touch taller than the
      // glyphs) — NOT the full line box, so it matches the native caret instead
      // of looking oversized on roomy line-heights.
      const node = range.startContainer;
      const el =
        node.nodeType === Node.TEXT_NODE
          ? node.parentElement
          : (node as HTMLElement);
      const fontSize = el ? parseFloat(getComputedStyle(el).fontSize) : 16;
      const h = Math.round((Number.isFinite(fontSize) ? fontSize : 16) * 1.15);

      const probe = range.cloneRange();
      probe.collapse(true);
      const rect = probe.getClientRects()[0] ?? probe.getBoundingClientRect();

      // Center the caret in its line box so it sits where the text sits.
      if (rect && rect.height > 0) {
        return { x: rect.left, y: rect.top + (rect.height - h) / 2, h };
      }

      // Empty line / node boundary: position at the element's content start.
      const er = el?.getBoundingClientRect();
      if (!er) return null;
      return { x: er.left, y: er.top + (er.height - h) / 2, h };
    }

    function paint() {
      raf = 0;
      const r = caretRect();
      if (!r) {
        caret.classList.remove("visible");
        return;
      }

      const moved = r.x !== lastX || r.y !== lastY;

      // Glide only along a line. A first paint, a line change, or a click
      // somewhere far should jump — a diagonal swoop across the page reads as a
      // bug, not as smooth. Snap by killing the transition for this one update.
      const farJump =
        !Number.isFinite(lastX) || Math.abs(r.y - lastY) > r.h * 1.4;
      if (farJump) {
        caret.classList.add("snap");
        requestAnimationFrame(() => caret.classList.remove("snap"));
      }

      caret.style.height = `${r.h}px`;
      caret.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
      caret.classList.add("visible");

      // Pause the blink while gliding, then resume — that's what makes the
      // motion read as smooth rather than a smear.
      if (moved) {
        caret.classList.remove("blink");
        caret.classList.add("moving");
        if (blinkResume) clearTimeout(blinkResume);
        blinkResume = setTimeout(() => {
          caret.classList.remove("moving");
          caret.classList.add("blink");
        }, 180);
      }
      lastX = r.x;
      lastY = r.y;
    }

    function schedule() {
      if (raf) return;
      raf = requestAnimationFrame(paint);
    }

    document.addEventListener("selectionchange", schedule);
    editor.addEventListener("input", schedule);
    editor.addEventListener("keyup", schedule);
    editor.addEventListener("focus", schedule);
    editor.addEventListener("blur", schedule);
    window.addEventListener("scroll", schedule, true); // capture: catch inner scrolls too
    window.addEventListener("resize", schedule);

    schedule();

    return () => {
      document.removeEventListener("selectionchange", schedule);
      editor.removeEventListener("input", schedule);
      editor.removeEventListener("keyup", schedule);
      editor.removeEventListener("focus", schedule);
      editor.removeEventListener("blur", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
      if (blinkResume) clearTimeout(blinkResume);
      editor.classList.remove("smooth-caret-host");
      caret.remove();
    };
  }, [editorRef]);
}
