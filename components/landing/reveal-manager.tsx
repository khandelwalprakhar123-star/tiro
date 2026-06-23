"use client";

import { useEffect } from "react";

/**
 * Arms the landing page's motion systems on the client only.
 *
 * 1. Scroll reveals — content is visible by default (server markup carries no
 *    hidden state); once this mounts we add `reveal-armed` to <html>, which
 *    switches [data-reveal] elements to their hidden start state and reveals
 *    them as they scroll into view.
 * 2. Scroll-driven ink — each frame we write two custom properties that the CSS
 *    reads to draw the marginal pen line and the per-section underlines:
 *      --page-progress  on <html>            (0→1 across the whole document)
 *      --scrub          on each [data-scrub]  (0→1 as it crosses the viewport)
 *
 * Consequence: with no JS, a crawler, or a reduced-motion preference we never
 * arm, so every section renders visible and every ink stroke renders finished —
 * the motion can only ever enhance.
 */
export function RevealManager() {
  useEffect(() => {
    const root = document.documentElement;

    // Respect reduced motion: don't arm at all — leave everything in its
    // finished, visible state.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;

    root.classList.add("reveal-armed");

    // --- 1. Scroll reveals (fire once) -------------------------------------
    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    for (const el of revealTargets) io.observe(el);

    // Anything already in view on load (above the fold) reveals immediately.
    requestAnimationFrame(() => {
      for (const el of revealTargets) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9) el.classList.add("is-visible");
      }
    });

    // --- 2. Scroll-driven ink (continuous) ---------------------------------
    const scrubTargets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scrub]"),
    );

    const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;

      // Whole-page progress drives the marginal pen line.
      const max = document.documentElement.scrollHeight - vh;
      const progress = max > 0 ? clamp01(window.scrollY / max) : 0;
      root.style.setProperty("--page-progress", progress.toFixed(4));

      // Per-element progress: 0 when the element's top sits at 88% of the
      // viewport height, 1 once it has risen to 42% — so the underline writes
      // itself as the heading travels up through the reading zone.
      const start = vh * 0.88;
      const end = vh * 0.42;
      for (const el of scrubTargets) {
        const top = el.getBoundingClientRect().top;
        const p = clamp01((start - top) / (start - end));
        el.style.setProperty("--scrub", p.toFixed(4));
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return null;
}
