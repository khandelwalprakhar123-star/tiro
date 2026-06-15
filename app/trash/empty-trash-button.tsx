"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { emptyTrash } from "../workspace/actions";

export function EmptyTrashButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleEmpty() {
    if (
      !confirm(
        "Permanently delete everything in the trash? This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    await emptyTrash();
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleEmpty}
      className="inline-flex items-center gap-2 rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold tracking-wide text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
    >
      Empty trash
    </button>
  );
}
