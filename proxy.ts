import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that anyone can visit WITHOUT being logged in.
// Everything else requires a session.
const PUBLIC_ROUTES = ["/", "/login", "/signup", "/auth", "/p"];

// If the request is for a published-document subdomain (e.g.
// `quiet-river-4821.tiro.works`, or `…​.localhost` in dev), return the slug.
// `www` and the bare apex are NOT subdomains. Anything else under `tiro.works`
// is treated as a published slug → served by the /p/[slug] route.
function publishedSlug(hostname: string): string | null {
  const prod = /^([a-z0-9-]+)\.tiro\.works$/.exec(hostname);
  if (prod && prod[1] !== "www") return prod[1];
  // Dev convenience: browsers resolve *.localhost to 127.0.0.1, so
  // `quiet-river-4821.localhost:3000` lets us test subdomains locally.
  const dev = /^([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (dev) return dev[1];
  return null;
}

export async function proxy(request: NextRequest) {
  // Subdomain → published page. Rewrite to /p/<slug> and skip the auth gate
  // entirely (published pages are public; no session needed). The browser URL
  // stays the subdomain; Next renders the /p/[slug] route. Asset requests
  // (/_next/static, images) are excluded by the matcher below, so they never
  // hit this rewrite and load normally on the subdomain host.
  const hostname = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const slug = publishedSlug(hostname);
  if (slug) {
    const url = request.nextUrl.clone();
    url.pathname = `/p/${slug}`;
    return NextResponse.rewrite(url);
  }

  // Start with a response we can attach refreshed cookies to.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // When Supabase refreshes the session, write the new cookies onto
        // BOTH the request (so the rest of this run sees them) and the
        // response (so the browser receives them). Proxy is allowed to
        // set cookies — this is the write that server.ts intentionally skips.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the session with Supabase and triggers
  // the cookie refresh above. Do this on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Not logged in and trying to reach a protected page → send to /login.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

// Run the proxy on all routes EXCEPT static assets and image files.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
