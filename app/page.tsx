import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  // getClaims() verifies the session JWT locally (asymmetric ES256 keys) — no
  // network round-trip. The proxy already did the authoritative getUser().
  const { data } = await supabase.auth.getClaims();

  redirect(data?.claims ? "/workspace" : "/login");
}
