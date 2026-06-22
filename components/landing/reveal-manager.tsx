"use client";

import { useEffect } from "react";

/**
 * Arms the scroll-reveal system. Content is visible by default (server markup
 * carries no hidden state); only once this mounts on the client do we add the
 * `reveal-armed` class to <html>, which switches [data-reveal] elements to
 * their hidden start state, and then reveal them as they scroll into view.
 *
 * Consequence: with no JS, a crawler, or a reduced-motion preference, every
 * section simply renders visible — the animation can only ever enhance.
 */
export function RevealManager() {
  useEffect(() => {
    const root = document.documentElement;

    // Respect reduced motion: don't arm at all — leave everything visible.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;

    root.classList.add("reveal-armed");

    const targets = Array.from(
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

    for (const el of targets) io.observe(el);

    // Anything already in view on load (above the fold) reveals immediately.
    requestAnimationFrame(() => {
      for (const el of targets) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9) el.classList.add("is-visible");
      }
    });

    return () => io.disconnect();
  }, []);

  return null;
}
