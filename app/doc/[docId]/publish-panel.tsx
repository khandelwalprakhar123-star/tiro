"use client";

// The "Publish to web" dialog, opened from the editor's ship (Publish/Export)
// menu. Publishing snapshots the document into `published_pages` (server action)
// and makes it viewable, with no login, at  <slug>.tiro.works. The dialog shows
// the public link and lets the owner copy/open it, push a fresh snapshot
// ("Update published version"), or unpublish.
//
// It's a CONTROLLED modal: the editor owns `open`/`onClose` and the published
// `state` (so the toolbar can show a "live" dot); this component just renders and
// drives the server actions.
//
// Sharing model (v1): one mode — anyone with the link can view.

import { useEffect, useState } from "react";
import {
  publishDocument,
  unpublishDocument,
  type PublishState,
} from "@/lib/publish-actions";

// Build the public URL for a slug. In production that's the tiro.works subdomain;
// in local dev we use <slug>.localhost:<port> (browsers resolve *.localhost), which
// proxy.ts rewrites to /p/<slug> just like production.
function publicUrl(slug: string): string {
  if (typeof window === "undefined") return `https://${slug}.tiro.works`;
  const { protocol, hostname, port } = window.location;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return `${protocol}//${slug}.localhost${port ? `:${port}` : ""}`;
  }
  return `https://${slug}.tiro.works`;
}

export function PublishDialog({
  docId,
  state,
  setState,
  open,
  onClose,
}: {
  docId: string;
  state: PublishState | null;
  setState: (s: PublishState | null) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<"publish" | "update" | "unpublish" | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isLive = !!state;
  const url = state ? publicUrl(state.slug) : "";

  async function publish(kind: "publish" | "update") {
    setBusy(kind);
    setError(null);
    try {
      setState(await publishDocument(docId));
    } catch {
      setError(
        kind === "publish"
          ? "Couldn’t publish. Please try again."
          : "Couldn’t update. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function doUnpublish() {
    setBusy("unpublish");
    setError(null);
    try {
      await unpublishDocument(docId);
      setState(null);
    } catch {
      setError("Couldn’t unpublish. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the readonly input is still there to copy manually.
    }
  }

  return (
    // Backdrop — click outside the card to close.
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 px-6 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-ink-soft transition-opacity hover:opacity-70"
        >
          ✕
        </button>

        {!isLive ? (
          <>
            <h2 className="font-display text-2xl text-ink">Publish to web</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Create a public page anyone can view — no login needed. All your
              text and embeds (images, video, audio, links) come along.
            </p>
            <button
              type="button"
              onClick={() => publish("publish")}
              disabled={busy === "publish"}
              className="mt-5 w-full rounded-full bg-ink px-4 py-2.5 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === "publish" ? "Publishing…" : "Publish to web"}
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl text-ink">This page is live</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Anyone with this link can view it.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink"
              />
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            >
              Open in a new tab ↗
            </a>

            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs text-ink-soft">
                The public page is a snapshot. Push your latest edits when you’re
                ready.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => publish("update")}
                  disabled={busy !== null}
                  className="flex-1 rounded-full bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "update" ? "Updating…" : "Update published version"}
                </button>
                <button
                  type="button"
                  onClick={doUnpublish}
                  disabled={busy !== null}
                  className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                >
                  {busy === "unpublish" ? "…" : "Unpublish"}
                </button>
              </div>
            </div>
          </>
        )}

        {error && <p className="mt-4 text-xs text-red-700">{error}</p>}
      </div>
    </div>
  );
}
