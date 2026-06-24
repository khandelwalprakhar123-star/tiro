
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stage 1: send the 6-digit code to the entered email.
  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) return setError(error.message);
    setStep("code");
  }

  // Stage 2: verify the code → Supabase sets the session cookie.
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) return setError(error.message);
    router.push("/workspace");
    router.refresh();
  }

  // Google OAuth — redirects to Google, then back through /auth/callback.
  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="grain relative min-h-screen w-full overflow-hidden bg-paper text-ink">
      {/* Oversized decorative wordmark bleeding off the left edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 bottom-[-4rem] z-0 select-none font-display text-[34vw] leading-none text-ink/[0.04] lg:text-[24vw]"
        style={{ fontVariationSettings: "'opsz' 144, 'WONK' 1" }}
      >
        T.
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:px-12">
        {/* Editorial panel */}
        <section className="rise" style={{ animationDelay: "0.05s" }}>
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-ink-soft">
            <span className="h-px w-8 bg-yolk-deep" />
            Tiro
          </p>
          <h1
            className="font-display text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
          >
            Write with
            <br />
            <span className="relative inline-block">
              everything
              <span className="absolute -bottom-1 left-0 h-3 w-full -rotate-1 bg-yolk/60" />
            </span>
            .
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-ink-soft">
            Prose, images, audio, and video — composed in one place, published
            anywhere. Sign in to open your desk.
          </p>
        </section>

        {/* Auth card */}
        <section
          className="rise w-full rounded-2xl border border-line bg-paper-deep/60 p-7 shadow-[0_24px_60px_-30px_rgba(33,28,20,0.5)] backdrop-blur-sm sm:p-9"
          style={{ animationDelay: "0.18s" }}
        >
          {step === "email" ? (
            <form onSubmit={sendCode} className="flex flex-col gap-6">
              <div>
                <h2 className="font-display text-2xl text-ink">Sign in</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  We&rsquo;ll email you a one-time code. No password needed.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-ink-soft">
                  Email
                </span>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border-b-2 border-line bg-transparent pb-2 text-lg text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-yolk-deep"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="group relative mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold tracking-wide text-paper transition-all hover:bg-yolk-deep hover:text-ink disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send code"}
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </button>

              <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-ink-soft">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>

              <button
                type="button"
                onClick={signInWithGoogle}
                className="inline-flex items-center justify-center gap-3 rounded-full border border-line bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-ink/40"
              >
                <GoogleGlyph />
                Continue with Google
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="flex flex-col gap-6">
              <div>
                <h2 className="font-display text-2xl text-ink">Check your inbox</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-ink">{email}</span>.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-ink-soft">
                  Code
                </span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="••••••"
                  className="w-full border-b-2 border-line bg-transparent pb-2 text-center font-display text-4xl tracking-[0.5em] text-ink outline-none transition-colors placeholder:text-ink/20 focus:border-yolk-deep"
                />
              </label>

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold tracking-wide text-paper transition-all hover:bg-yolk-deep hover:text-ink disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify & enter"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                ← Use a different email
              </button>
            </form>
          )}

          {error && (
            <p className="mt-5 rounded-lg border border-red-300/60 bg-red-50 px-4 py-2.5 text-sm text-red-800">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
