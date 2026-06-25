"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { confirmDialog } from "@/components/ui/dialog";
import {
  addDocToFolder,
  removeDocFromFolder,
  deleteDocument,
} from "./actions";

type Folder = { id: string; name: string };

type Props = {
  doc: { id: string; title: string; updated_at: string };
  folders: Folder[]; // all of the user's folders (for the "add to folder" menu)
  memberFolderIds: string[]; // folders this doc is currently in
  currentFolderId?: string; // set when shown inside a folder view
};

export function DocumentCard({
  doc,
  folders,
  memberFolderIds,
  currentFolderId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const members = new Set(memberFolderIds);

  async function toggleFolder(folderId: string) {
    setBusy(true);
    if (members.has(folderId)) {
      await removeDocFromFolder(doc.id, folderId);
    } else {
      await addDocToFolder(doc.id, folderId);
    }
    setBusy(false);
    router.refresh();
  }

  async function handleRemoveFromCurrent() {
    if (!currentFolderId) return;
    setBusy(true);
    await removeDocFromFolder(doc.id, currentFolderId);
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    const ok = await confirmDialog({
      title: "Move to trash?",
      message: "This document goes to the trash. You can restore it later.",
      confirmLabel: "Move to trash",
      tone: "danger",
      icon: "trash",
    });
    if (!ok) return;
    setBusy(true);
    await deleteDocument(doc.id);
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div
      className="group relative"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/x-tiro",
          JSON.stringify({ type: "doc", id: doc.id }),
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <Link href={`/doc/${doc.id}`} className="block" draggable={false}>
        <div className="flex aspect-[5/4] items-center justify-center rounded-xl border border-line bg-paper-deep/50 transition-all group-hover:border-yolk-deep group-hover:bg-paper-deep">
          <FileIcon />
        </div>
        <p className="mt-2.5 truncate font-display text-sm font-medium text-ink group-hover:text-yolk-deep">
          {doc.title || "Untitled"}
        </p>
        <p className="text-xs text-ink-soft">{formatDate(doc.updated_at)}</p>
      </Link>

      {/* Kebab menu trigger (top-right of the card) */}
      <div ref={menuRef} className="absolute right-1.5 top-1.5">
        <button
          type="button"
          aria-label="Document options"
          onClick={() => setOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/80 text-ink-soft opacity-0 backdrop-blur transition-opacity hover:text-ink group-hover:opacity-100 data-[open=true]:opacity-100"
          data-open={open}
        >
          ⋯
        </button>

        {open && (
          <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-[0_18px_40px_-20px_rgba(33,28,20,0.5)]">
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-soft">
              Add to folder
            </p>
            {folders.length === 0 ? (
              <p className="px-3 py-1.5 text-sm text-ink-soft">No folders yet.</p>
            ) : (
              <ul className="max-h-48 overflow-auto">
                {folders.map((f) => {
                  const inFolder = members.has(f.id);
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleFolder(f.id)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-paper-deep disabled:opacity-50"
                      >
                        <span className="w-3 text-yolk-deep">
                          {inFolder ? "✓" : ""}
                        </span>
                        <span className="truncate">{f.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="my-1 h-px bg-line" />

            {currentFolderId && (
              <button
                type="button"
                disabled={busy}
                onClick={handleRemoveFromCurrent}
                className="block w-full px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-paper-deep disabled:opacity-50"
              >
                Remove from this folder
              </button>
            )}
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
