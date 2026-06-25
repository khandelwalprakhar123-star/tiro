import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function ProfilePage() {
  const supabase = await createClient();
  // Local JWT verification (no network); the proxy did the authoritative check.
  // The JWT carries the user id (sub) and email as claims, so we don't need a
  // network getUser() just to read them.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  // Read the current profile row. maybeSingle() returns null instead of
  // throwing if the row doesn't exist yet (e.g. a user created before the
  // auto-create trigger) — the form upserts, so a missing row is fine.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, status")
    .eq("id", claims.sub)
    .maybeSingle();

  return (
    <main className="grain relative min-h-screen bg-paper text-ink">
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-14">
        <header className="rise flex items-center justify-between">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            ← Back to desk
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-ink-soft">
              Profile
            </p>
          </div>
        </header>

        <section className="rise mt-12" style={{ animationDelay: "0.08s" }}>
          <h1
            className="font-display text-4xl leading-tight tracking-tight sm:text-5xl"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
          >
            Your profile
          </h1>
          <p className="mt-3 text-ink-soft">
            How you appear across Tiro.
          </p>
        </section>

        <div className="rise mt-10" style={{ animationDelay: "0.16s" }}>
          <ProfileForm
            userId={claims.sub}
            email={typeof claims.email === "string" ? claims.email : ""}
            initialDisplayName={profile?.display_name ?? ""}
            initialStatus={profile?.status ?? ""}
            initialAvatarUrl={profile?.avatar_url ?? ""}
          />
        </div>
      </div>
    </main>
  );
}
