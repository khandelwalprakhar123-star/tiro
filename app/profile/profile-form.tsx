"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  email: string;
  initialDisplayName: string;
  initialStatus: string;
  initialAvatarUrl: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function ProfileForm({
  userId,
  email,
  initialDisplayName,
  initialStatus,
  initialAvatarUrl,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [status, setStatus] = useState(initialStatus);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Picture viewer (lightbox) state machine: closed → open → closing → closed.
  // We keep the node mounted while "closing" so the exit animation can play
  // before React removes it. Without this, the close would be instant.
  const [viewer, setViewer] = useState<"closed" | "open" | "closing">("closed");

  // Drag state for the enlarged photo (macOS-window-style).
  // `pos` is the offset from the centered resting position.
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, originX: 0, originY: 0, moved: false });

  function openViewer() {
    setPos({ x: 0, y: 0 }); // always reopen centered
    setViewer("open");
  }

  function closeViewer() {
    setViewer("closing");
    // Match the longest exit animation duration in globals.css (0.24s).
    setTimeout(() => setViewer("closed"), 240);
  }

  function onDragStart(e: React.PointerEvent) {
    // Capture the pointer so move/up keep firing on this element even if the
    // cursor outruns it — same idea as a window grabbing the mouse.
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
  }

  function onDragMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true;
    setPos({ x: drag.current.originX + dx, y: drag.current.originY + dy });
  }

  function onDragEnd() {
    drag.current.active = false;
  }

  // Close on Escape, and lock background scroll while the viewer is open.
  useEffect(() => {
    if (viewer === "closed") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeViewer();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [viewer]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file)); // local preview before upload
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSave("saving");
    setError(null);

    try {
      let nextAvatarUrl = avatarUrl;

      // 1. If a new avatar was chosen, upload it to the user's own folder.
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() ?? "png";
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        // Cache-bust so the new image shows immediately (same path each time).
        nextAvatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      }

      // 2. Upsert the profile row (RLS ensures it's our own).
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: userId,
        display_name: displayName.trim() || null,
        status: status.trim() || null,
        avatar_url: nextAvatarUrl || null,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;

      setAvatarUrl(nextAvatarUrl);
      setAvatarFile(null);
      setPreview(null);
      setSave("saved");
      router.refresh(); // re-fetch server data so other views update
      setTimeout(() => setSave("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSave("error");
    }
  }

  const shownAvatar = preview ?? avatarUrl;
  const initial = (displayName || email || "?").charAt(0).toUpperCase();

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-line bg-paper-deep/50 p-7 sm:p-9"
    >
      {/* Avatar */}
      <div className="flex items-center gap-6">
        <div className="relative">
          {/* The avatar doubles as a "view" trigger when a photo exists. */}
          <button
            type="button"
            onClick={shownAvatar ? openViewer : undefined}
            disabled={!shownAvatar}
            aria-label={shownAvatar ? "View profile photo" : undefined}
            className={`block h-24 w-24 overflow-hidden rounded-full border-2 border-line bg-paper transition-transform ${
              shownAvatar ? "cursor-zoom-in hover:scale-105" : "cursor-default"
            }`}
          >
            {shownAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shownAvatar}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-4xl text-ink-soft">
                {initial}
              </div>
            )}
          </button>
          <span className="pointer-events-none absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-paper bg-yolk" />
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40"
            >
              Change photo
            </button>
            {shownAvatar && (
              <button
                type="button"
                onClick={openViewer}
                className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40"
              >
                View photo
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-soft">PNG or JPG, square works best.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={pickFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Email (read-only) */}
      <div className="mt-8">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-ink-soft">
          Email
        </span>
        <p className="text-ink-soft">{email}</p>
      </div>

      {/* Display name */}
      <label className="mt-7 block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-ink-soft">
          Display name
        </span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="What should we call you?"
          maxLength={60}
          className="w-full border-b-2 border-line bg-transparent pb-2 text-lg text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-yolk-deep"
        />
      </label>

      {/* Status */}
      <label className="mt-7 block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-ink-soft">
          Status
        </span>
        <input
          type="text"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="A short tagline…"
          maxLength={120}
          className="w-full border-b-2 border-line bg-transparent pb-2 text-lg text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-yolk-deep"
        />
      </label>

      {/* Save */}
      <div className="mt-9 flex items-center gap-4">
        <button
          type="submit"
          disabled={save === "saving"}
          className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold tracking-wide text-paper transition-all hover:bg-yolk-deep hover:text-ink disabled:opacity-50"
        >
          {save === "saving" ? "Saving…" : "Save changes"}
        </button>
        {save === "saved" && (
          <span className="text-sm text-yolk-deep">Saved ✓</span>
        )}
      </div>

      {error && (
        <p className="mt-5 rounded-lg border border-red-300/60 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Picture viewer overlay. Rendered via a portal into document.body so
          it escapes the page's transformed `.rise` ancestor — otherwise
          `fixed inset-0` would anchor to that ancestor, not the viewport, and
          clicks outside the card wouldn't close it. Clicking anywhere closes;
          the click on the image itself is stopped from bubbling. */}
      {viewer !== "closed" &&
        shownAvatar &&
        typeof document !== "undefined" &&
        createPortal(
          <div
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo"
          onClick={closeViewer}
          className={`fixed inset-0 z-50 flex items-center justify-center bg-transparent p-6 ${
            viewer === "closing" ? "viewer-overlay-out" : "viewer-overlay-in"
          }`}
        >
          {/* Drag wrapper: owns the translate offset (and the grab cursor) so
              it never clashes with the scale animation on the circle inside.
              stopPropagation keeps a click/drag here from closing the viewer. */}
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, touchAction: "none" }}
            className="cursor-grab active:cursor-grabbing"
          >
            {/* Animated circle: owns the pop-in/out scale animation. */}
            <div
              className={`relative h-[min(78vw,30rem)] w-[min(78vw,30rem)] select-none overflow-hidden rounded-full border-4 border-paper shadow-2xl ${
                viewer === "closing" ? "viewer-pic-out" : "viewer-pic-in"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shownAvatar}
                alt="Profile photo"
                draggable={false}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>,
          document.body
        )}
    </form>
  );
}
