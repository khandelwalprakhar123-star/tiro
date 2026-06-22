"use client";

// The "Publish to web" control in the editor header. Publishing snapshots the
// document into `published_pages` (server action) and makes it viewable, with no
// login, at  <slug>.tiro.works. This panel shows the public link, lets the owner
// copy/open it, push a fresh snapshot ("Update published version"), or unpublish.
//
// Sharing model (v1): one mode — anyone with the link can view. There is no
// per-person access; published = world-readable.

import { useEffect, useRef, useState } from "react";
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

export function PublishPanel({
  docId,
  initial,
}: {
  docId: string;
  initial: PublishState | null;
}) {
  const [state, setState] = useState<PublishState | null>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"publish" | "update" | "unpublish" | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the popover on an outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const isLive = !!state;
  const url = state ? publicUrl(state.slug) : "";

  async function doPublish() {
    setBusy("publish");
    setError(null);
    try {
      setState(await publishDocument(docId));
    } catch {
      setError("Couldn’t publish. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function doUpdate() {
    setBusy("update");
    setError(null);
    try {
      setState(await publishDocument(docId));
    } catch {
      setError("Couldn’t update. Please try again.");
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
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors ${
          isLive
            ? "border-yolk/50 bg-yolk/10 text-ink hover:border-yolk"
            : "border-line text-ink-soft hover:border-ink hover:text-ink"
        }`}
      >
        {isLive && (
          <span className="h-1.5 w-1.5 rounded-full bg-yolk" aria-hidden />
        )}
        {isLive ? "Published" : "Publish"}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-line bg-paper p-4 shadow-xl">
          {!isLive ? (
            <>
              <p className="text-sm font-medium text-ink">Publish to web</p>
              <p className="mt-1 text-sm text-ink-soft">
                Create a public page anyone can view — no login needed. All your
                text and embeds (images, video, audio, links) come along.
              </p>
              <button
                type="button"
                onClick={doPublish}
                disabled={busy === "publish"}
                className="mt-4 w-full rounded-full bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy === "publish" ? "Publishing…" : "Publish to web"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">This page is live</p>
              <p className="mt-1 text-sm text-ink-soft">
                Anyone with this link can view it.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-xs text-ink"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
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

              <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs text-ink-soft">
                  The public page is a snapshot. Push your latest edits when
                  you’re ready.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={doUpdate}
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

          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
