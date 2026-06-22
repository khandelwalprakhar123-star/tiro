import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Landing } from "@/components/landing/landing";

export default async function Home() {
  const supabase = await createClient();
  // getClaims() verifies the session JWT locally (asymmetric ES256 keys) — no
  // network round-trip. The proxy already did the authoritative getUser().
  const { data } = await supabase.auth.getClaims();

  // Signed-in users go straight to their desk; everyone else meets the
  // marketing landing page.
  if (data?.claims) redirect("/workspace");

  return <Landing />;
}
