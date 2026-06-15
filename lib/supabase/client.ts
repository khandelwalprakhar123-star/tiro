import { createBrowserClient } from "@supabase/ssr";

// Creates a Supabase client for use in the BROWSER (Client Components).
// It reads/writes the auth session from document.cookie.
// We export a function (not a shared instance) so each caller gets a fresh,
// correctly-scoped client.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
