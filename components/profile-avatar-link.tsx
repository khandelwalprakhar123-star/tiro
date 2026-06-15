import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Top-left profile icon → /profile. Self-contained: reads the current user's
// avatar/display name itself, so it can be dropped into any authenticated page.
// (Future home for friends/invites, per product direction.)
export async function ProfileAvatarLink() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const avatarUrl = profile?.avatar_url ?? "";
  const initial = (profile?.display_name || user.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <Link
      href="/profile"
      aria-label="Your profile"
      className="block h-10 w-10 overflow-hidden rounded-full border-2 border-line bg-paper-deep transition-all hover:border-yolk-deep hover:ring-2 hover:ring-yolk/40"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="Your profile"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-lg text-ink-soft">
          {initial}
        </span>
      )}
    </Link>
  );
}
