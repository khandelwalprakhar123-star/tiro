"use client";

// ── Themed dialog banners ────────────────────────────────────────────────────
// A drop-in replacement for the browser's native confirm()/prompt(), styled to
// Tiro's paper/ink system so it adapts to both themes (Yolk light / Sage dark)
// for free — every colour is a semantic token (--paper, --ink, --line, --danger…).
//
// Shape: a banner that slides down from the top of the window (not a centred
// modal), with the action buttons — and, for a prompt, a text input — living
// inside it. One <DialogHost/> is mounted once at the app root; call sites use
// the promise-based API and barely change:
//
//   if (!(await confirmDialog({ title: "Move to trash?", tone: "danger" }))) return;
//   const name = await promptDialog({ title: "New folder", defaultValue: "…" });
//   if (name === null) return; // cancelled
//
// confirmDialog resolves true/false; promptDialog resolves the trimmed string,
// or null if cancelled.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Icon = "trash" | "folder" | "broom" | "alert";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  icon?: Icon;
};

type PromptOptions = {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: Icon;
};

type Request =
  | {
      id: number;
      kind: "confirm";
      opts: ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      id: number;
      kind: "prompt";
      opts: PromptOptions;
      resolve: (value: string | null) => void;
    };

// ── Tiny external store (single in-flight request) ───────────────────────────
let current: Request | null = null;
let counter = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return current;
}
function getServerSnapshot(): Request | null {
  return null;
}

// If a dialog is already open when a new one is requested, cancel the old one so
// its awaiter doesn't hang, then show the new request.
function enqueue(req: Request) {
  if (current) {
    const stale = current;
    if (stale.kind === "confirm") stale.resolve(false);
    else stale.resolve(null);
  }
  current = req;
  emit();
}

function resolveCurrent(value: boolean | string | null) {
  const req = current;
  if (!req) return;
  current = null;
  emit();
  if (req.kind === "confirm") req.resolve(value as boolean);
  else req.resolve(value as string | null);
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    enqueue({ id: ++counter, kind: "confirm", opts, resolve });
  });
}

export function promptDialog(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    enqueue({ id: ++counter, kind: "prompt", opts, resolve });
  });
}

// ── Medallion glyphs (stroke-only, match the icon set; inherit currentColor) ──
function Glyph({ icon }: { icon: Icon }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true,
  };
  switch (icon) {
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6" />
        </svg>
      );
    case "broom":
      return (
        <svg {...common}>
          <path d="M19 5l-7 7M11 9l4 4M5 19c1.5-3 3-4.5 6-6l4 4c-1.5 3-3 4.5-6 6l-4-4zM5 19l-1 1" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z" />
        </svg>
      );
    case "alert":
    default:
      return (
        <svg {...common}>
          <path d="M12 8v5M12 17h.01M10.3 4.3 2.6 18a1.5 1.5 0 0 0 1.3 2.2h16.2a1.5 1.5 0 0 0 1.3-2.2L13.7 4.3a1.5 1.5 0 0 0-2.6 0z" />
        </svg>
      );
  }
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Mount once at the app root. Renders the in-flight dialog as a top banner and
 * resolves its promise on the user's choice. The card is keyed per request so a
 * fresh prompt seeds its input cleanly.
 */
export function DialogHost() {
  const req = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!req) return null;
  return <DialogCard key={req.id} request={req} />;
}

function DialogCard({ request }: { request: Request }) {
  const isPrompt = request.kind === "prompt";
  const opts = request.opts;
  const tone =
    request.kind === "confirm" && request.opts.tone === "danger"
      ? "danger"
      : "default";

  const [value, setValue] = useState(
    request.kind === "prompt" ? (request.opts.defaultValue ?? "") : "",
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Move focus into the banner on mount; restore it to the trigger on unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      if (request.kind === "prompt") {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else {
        cardRef.current?.querySelector<HTMLElement>("[data-confirm]")?.focus();
      }
    }, 40);
    return () => {
      window.clearTimeout(t);
      previouslyFocused?.focus?.();
    };
  }, [request]);

  function cancel() {
    resolveCurrent(request.kind === "prompt" ? null : false);
  }

  function submit() {
    if (request.kind === "prompt") {
      const trimmed = value.trim();
      if (!trimmed) return; // require a non-empty name
      resolveCurrent(trimmed);
    } else {
      resolveCurrent(true);
    }
  }

  // Escape cancels, Enter submits, Tab is trapped within the banner.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "Tab" && cardRef.current) {
      const nodes = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const icon: Icon = opts.icon ?? (tone === "danger" ? "trash" : "alert");
  const confirmLabel =
    opts.confirmLabel ??
    (isPrompt ? "Create" : tone === "danger" ? "Delete" : "Confirm");
  const cancelLabel = opts.cancelLabel ?? "Cancel";
  const titleId = `dlg-title-${request.id}`;
  const descId = opts.message ? `dlg-desc-${request.id}` : undefined;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4">
      <div
        ref={cardRef}
        role={isPrompt ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        className="dialog-banner-in pointer-events-auto mt-4 w-full max-w-xl rounded-2xl border border-line bg-paper/95 p-4 shadow-[0_24px_60px_-20px_rgba(20,16,12,0.45)] backdrop-blur sm:p-5"
      >
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              tone === "danger"
                ? "bg-danger/12 text-danger"
                : "bg-yolk/15 text-yolk-deep"
            }`}
          >
            <Glyph icon={icon} />
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="font-display text-lg leading-snug text-ink"
            >
              {opts.title}
            </h2>
            {opts.message && (
              <p
                id={descId}
                className="mt-1 text-sm leading-relaxed text-ink-soft"
              >
                {opts.message}
              </p>
            )}

            {request.kind === "prompt" && (
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={request.opts.placeholder}
                maxLength={120}
                className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft focus:border-yolk-deep"
              />
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-confirm
            onClick={submit}
            disabled={isPrompt && !value.trim()}
            className={
              tone === "danger"
                ? "rounded-full bg-danger px-4 py-2 text-sm font-medium text-danger-ink transition-colors hover:bg-danger-deep disabled:opacity-50"
                : "rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
