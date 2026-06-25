"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFolder } from "./actions";
import { promptDialog } from "@/components/ui/dialog";

export function NewFolderButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const name = await promptDialog({
      title: "New folder",
      placeholder: "Folder name",
      defaultValue: "Untitled folder",
      confirmLabel: "Create folder",
      icon: "folder",
    });
    if (name === null) return; // cancelled
    setBusy(true);
    await createFolder(name);
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
    >
      <span className="text-base leading-none">+</span> New folder
    </button>
  );
}
