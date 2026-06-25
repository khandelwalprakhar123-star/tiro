"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderIcon } from "@/components/icons";
import { confirmDialog, promptDialog } from "@/components/ui/dialog";
import {
  renameFolder,
  deleteFolder,
  addDocToFolder,
  moveFolderIntoFolder,
} from "./actions";

type Props = {
  folder: { id: string; name: string };
  docCount: number;
};

type DragPayload = { type: "doc" | "folder"; id: string };

export function FolderCard({ folder, docCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on any outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function handleRename() {
    const name = await promptDialog({
      title: "Rename folder",
      defaultValue: folder.name,
      placeholder: "Folder name",
      confirmLabel: "Rename",
      icon: "folder",
    });
    if (name == null) return; // cancelled
    setBusy(true);
    await renameFolder(folder.id, name);
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    const ok = await confirmDialog({
      title: "Delete folder?",
      message: "The documents inside are kept — only the folder is removed.",
      confirmLabel: "Delete folder",
      tone: "danger",
      icon: "folder",
    });
    if (!ok) return;
    setBusy(true);
    await deleteFolder(folder.id);
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const raw = e.dataTransfer.getData("application/x-tiro");
    if (!raw) return;
    let payload: DragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    // Dropping a folder onto itself is a no-op.
    if (payload.type === "folder" && payload.id === folder.id) return;

    setBusy(true);
    if (payload.type === "doc") {
      await addDocToFolder(payload.id, folder.id);
    } else {
      await moveFolderIntoFolder(payload.id, folder.id);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div
      className="group relative"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/x-tiro",
          JSON.stringify({ type: "folder", id: folder.id }),
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragOver={(e) => {
        // Allow dropping; highlight while a card hovers over us.
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <Link href={`/folders/${folder.id}`} className="block" draggable={false}>
        <div
          className={`flex aspect-[5/4] items-center justify-center rounded-xl border bg-paper-deep/50 transition-all group-hover:border-yolk-deep group-hover:bg-paper-deep ${
            over
              ? "border-yolk-deep bg-paper-deep ring-2 ring-yolk-deep/60"
              : "border-line"
          }`}
        >
          <FolderIcon />
        </div>
        <p className="mt-2.5 truncate font-display text-sm font-medium text-ink group-hover:text-yolk-deep">
          {folder.name}
        </p>
        <p className="text-xs text-ink-soft">
          {docCount} document{docCount === 1 ? "" : "s"}
        </p>
      </Link>

      {/* Kebab menu trigger (top-right of the card) */}
      <div ref={menuRef} className="absolute right-1.5 top-1.5">
        <button
          type="button"
          aria-label="Folder options"
          onClick={() => setOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/80 text-ink-soft opacity-0 backdrop-blur transition-opacity hover:text-ink group-hover:opacity-100 data-[open=true]:opacity-100"
          data-open={open}
        >
          ⋯
        </button>

        {open && (
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-[0_18px_40px_-20px_rgba(33,28,20,0.5)]">
            <button
              type="button"
              disabled={busy}
              onClick={handleRename}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-paper-deep disabled:opacity-50"
            >
              Rename
            </button>
            <div className="my-1 h-px bg-line" />
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="block w-full px-3 py-1.5 text-left text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
