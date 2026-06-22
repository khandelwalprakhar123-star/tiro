"use client";

import { useState } from "react";

const TABS = [
  {
    key: "writers",
    label: "Writers",
    line: "Essays and newsletters that breathe.",
    body: "Draft long-form prose with a display-serif heading scale, drop in the reference photo and the field recording, and ship the whole thing to your own web page — no CMS, no theme wrangling.",
    detail: "Per-selection fonts · headers & footers · Markdown export",
  },
  {
    key: "students",
    label: "Students",
    line: "Notes that hold the lecture, not just the words.",
    body: "Record the explanation, paste the diagram, link the source, and keep it all in one document. Organise by class with folders — the same note can live in several at once.",
    detail: "Audio notes · checklists · many-to-many folders",
  },
  {
    key: "creators",
    label: "Creators",
    line: "Treatments and pitches that play in the page.",
    body: "Storyboard with images, embed the reference clip, unfurl the moodboard links, then publish a link a client can open on their phone without an account.",
    detail: "Inline video · link unfurls · public publish",
  },
] as const;

export function AudienceTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <section className="mx-auto max-w-5xl px-6 py-24 lg:px-10 lg:py-28">
      <h2
        className="max-w-2xl font-display text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.02] tracking-[-0.02em] text-ink"
        data-reveal
      >
        However you work, in one place.
      </h2>

      <div className="mt-10" data-reveal>
        {/* Tab strip */}
        <div role="tablist" aria-label="Who Tiro is for" className="flex flex-wrap gap-2">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active === i}
              aria-controls={`panel-${t.key}`}
              onClick={() => setActive(i)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                active === i
                  ? "bg-ink text-paper"
                  : "border border-line text-ink-soft hover:border-ink/40 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div
          role="tabpanel"
          id={`panel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          key={tab.key}
          className="rise mt-8 grid gap-8 rounded-2xl border border-line bg-paper-deep/50 p-8 sm:p-12 lg:grid-cols-[1.2fr_0.8fr]"
          style={{ animationDuration: "0.45s" }}
        >
          <div>
            <p
              className="font-display text-2xl leading-snug text-ink sm:text-3xl"
              style={{ textWrap: "balance" }}
            >
              {tab.line}
            </p>
            <p className="mt-5 max-w-xl leading-relaxed text-ink-soft">{tab.body}</p>
          </div>
          <div className="flex items-end">
            <p className="text-sm font-medium leading-relaxed text-ink-soft">
              <span className="mb-2 block h-px w-8 bg-yolk-deep" />
              {tab.detail}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
