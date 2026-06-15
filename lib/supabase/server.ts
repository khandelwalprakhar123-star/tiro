import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Creates a Supabase client for use on the SERVER (Server Components,
// Route Handlers, Server Actions). It reads/writes the auth session from
// Next.js's request/response cookies instead of document.cookie.
//
// In Next.js 15+, cookies() is async, so this helper is async too.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        // Supabase reads all cookies to find the session...
        getAll() {
          return cookieStore.getAll();
        },
        // ...and writes them back when the session is refreshed.
        // In a pure Server Component this can throw (you can't set cookies
        // while rendering), so we swallow that case — middleware handles the
        // refresh write instead.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore.
          }
        },
      },
    },
  );
}
