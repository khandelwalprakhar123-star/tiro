"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
    >
      Sign out
    </button>
  );
}
