"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileIcon, FolderIcon } from "@/components/icons";
import { formatDate } from "@/lib/format";
import {
  restoreDocument,
  purgeDocument,
  restoreFolder,
  purgeFolder,
} from "../workspace/actions";

type Props = {
  kind: "doc" | "folder";
  item: { id: string; label: string; deleted_at: string };
};

export function TrashCard({ kind, item }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleRestore() {
    setBusy(true);
    if (kind === "doc") await restoreDocument(item.id);
    else await restoreFolder(item.id);
    setBusy(false);
    router.refresh();
  }

  async function handlePurge() {
    const what = kind === "doc" ? "document" : "folder";
    if (
      !confirm(
        `Permanently delete this ${what}? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    if (kind === "doc") await purgeDocument(item.id);
    else await purgeFolder(item.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="group relative" data-busy={busy}>
      {/* Static thumbnail (no link — trashed items aren't openable). */}
      <div className="flex aspect-[5/4] items-center justify-center rounded-xl border border-line bg-paper-deep/40 opacity-70 transition-opacity group-hover:opacity-100">
        {kind === "doc" ? <FileIcon /> : <FolderIcon />}
      </div>
      <p className="mt-2.5 truncate font-display text-sm font-medium text-ink">
        {item.label}
      </p>
      <p className="text-xs text-ink-soft">Deleted {formatDate(item.deleted_at)}</p>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleRestore}
          className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-ink/40 hover:bg-paper-deep disabled:opacity-50"
        >
          Restore
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handlePurge}
          className="rounded-full px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          Delete forever
        </button>
      </div>
    </div>
  );
}
