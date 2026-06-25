"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { renameFolder, deleteFolder } from "@/app/workspace/actions";
import { confirmDialog } from "@/components/ui/dialog";

// Inline-editable folder title. Saves on blur / Enter.
export function FolderTitle({
  folderId,
  initialName,
}: {
  folderId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);

  async function save() {
    const trimmed = name.trim() || "Untitled folder";
    if (trimmed === initialName) return;
    setName(trimmed);
    await renameFolder(folderId, trimmed);
    router.refresh();
  }

  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      maxLength={120}
      aria-label="Folder name"
      className="w-full bg-transparent font-display text-4xl leading-tight tracking-tight text-ink outline-none placeholder:text-ink/25 sm:text-5xl"
      style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
    />
  );
}

export function DeleteFolderButton({ folderId }: { folderId: string }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const ok = await confirmDialog({
      title: "Delete folder?",
      message: "The documents inside are kept — only the folder is removed.",
      confirmLabel: "Delete folder",
      tone: "danger",
      icon: "folder",
    });
    if (!ok) return;
    setBusy(true);
    await deleteFolder(folderId); // server action redirects to /workspace
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete folder"}
    </button>
  );
}
