# Tiro — Change Tracker

> **Rebrand note (2026-06-16):** the product was renamed **DeeScribe → Tiro** (domain `tiro.works`).
> Historical changelog entries below predate the rename and still say "DeeScribe" — that's intentional
> (the log is not rewritten). "DeeScribe" and "Tiro" refer to the same product.

> **Purpose.** This file is the running log of everything we build, change, or remove. It exists so that
> any agent (or human) can get up to speed on the project state *fast* without re-reading the whole
> codebase or chat history. As we move to multiple agents, this is the shared source of truth for
> "what has happened so far" and "what's next."
>
> **Rules for agents:**
> 1. **Read this file first** before making changes, to understand current state and decisions.
> 2. **Update this file** whenever you add/change/remove anything meaningful — append a dated entry to
>    the Changelog, and update the relevant section (Current State / Pending) so it stays accurate.
> 3. Keep entries concise and factual. Record *decisions and their reasons*, not just diffs.
> 4. `prd.md` = what we're building (intent). `tracker.md` = what we've actually done (state). Keep both current.

---

## Current state (snapshot)

**Product:** Tiro — a multimodal document editor (Next.js + Supabase). Named after Marcus Tullius Tiro
(Cicero's scribe, inventor of shorthand). Domain: **`tiro.works`** (registrar: GoDaddy). See `prd.md`
(living spec) and `prd-vision.md` (full reference vision).

**Stack in place:**
- Next.js **16.2.9** (App Router) + React 19 + TypeScript + Turbopack
- Tailwind CSS v4 (config via `@theme` in `app/globals.css`)
- Supabase (`@supabase/supabase-js` + `@supabase/ssr`) — cookie-based auth
- Fonts: **Fraunces** (display serif) + **Hanken Grotesk** (body) via `next/font/google`

**Supabase project (ACTIVE):**
- Name: **DeeScribe** · ref **`rgryvohgicykwuxnwnhe`** · region **`ap-south-1` (Mumbai)**
- URL: `https://rgryvohgicykwuxnwnhe.supabase.co`
- Old Sydney project (`vaornwonnojtdkytmafv`, `ap-southeast-2`) was **deleted** — do not reference it.
- Connected via the account-level Supabase MCP (no project `.mcp.json`). **NOTE (2026-06-14):** MCP schema
  calls (`list_tables`, `list_migrations`) now return *permission denied* — verify DB state via the
  Supabase dashboard or CLI, not MCP. User is considering moving schema management to the Supabase CLI
  (git-tracked migrations); existing schema would be captured via `supabase db pull`.

**Auth status:** ✅ **Complete.** Both Email OTP (6-digit code) and Google OAuth work end-to-end on the
Mumbai project. Email: Resend SMTP + OTP template + Confirm-email OFF + URL config. Google: OAuth client
created in Google Cloud (consent screen External; redirect URI = Supabase callback
`https://rgryvohgicykwuxnwnhe.supabase.co/auth/v1/callback`), Client ID/Secret added to Supabase
Sign In / Providers → Google. **Google app is published** (confirmed 2026-06-16: a brand-new,
non-allow-listed email signed in successfully → not gated to test users). Consent-screen display
name may still read "DeeScribe" (cosmetic only; does not affect logins).

**Session verification (perf, 2026-06-15):** the proxy (`proxy.ts`) runs the authoritative
`getUser()` (network revalidate + cookie refresh) on every request. Protected **pages** use
`getClaims()` instead — local **ES256** JWT signature verification (project uses asymmetric JWT signing
keys), so **no network round-trip**. This removed the duplicate ~375 ms per-navigation auth call.
`getUser()` is still used where it must be: the proxy (authoritative gate + refresh), all Server Actions
(`requireUser` in `actions.ts`), and `ProfileAvatarLink`. Remaining controllable latency is the single
proxy `getUser()`; switching that to `getClaims()` too would remove it at the cost of not catching a
mid-session ban/delete until token expiry (~1 h) — **not done** (left as the authoritative gate).

**Database (Mumbai project):**
- `public.profiles` (1:1 with `auth.users`; cols: display_name, avatar_url, status, timestamps). RLS on —
  owner-only select/insert/update. Auto-create trigger `on_auth_user_created` → `handle_new_user()`
  (EXECUTE revoked from anon/authenticated so it's not a public RPC).
- Storage bucket **`avatars`** (public-read). Policies: public select; insert/update/delete restricted to
  files under the user's own `‹uid›/…` folder.
- Migrations: `create_profiles_table`, `lock_down_handle_new_user_rpc`, `create_avatars_bucket`.
- `public.documents` (owner_id, title, content jsonb, header/footer jsonb, timestamps, deleted_at). RLS on —
  owner-only select/insert/update/delete. Index `documents_owner_idx (owner_id, updated_at desc)`.
  Migration `supabase/migrations/0001_create_documents.sql`.
- `public.folders` (owner_id, name, parent_id nullable, timestamps, deleted_at) + `public.document_folders`
  (document_id, folder_id, PK both) — many-to-many (§4.1). RLS owner-only; df policies check ownership of
  both document and folder via EXISTS. Migration `supabase/migrations/0002_create_folders.sql`.
- **Migrations 0001 + 0002 are APPLIED** ✅ — confirmed 2026-06-15 by live `documents` and `folders`
  rows rendering with real data (`/doc/[id]` and `/folders/[id]` serve actual content). Run via the
  dashboard SQL editor (MCP schema writes denied); both files are safe to re-run (IF NOT EXISTS /
  drop-then-create).

**Git state (2026-06-15):** the repo has a single commit — `38da79c Initial commit from Create Next App`.
The **entire DeeScribe app is uncommitted** (working tree): all of `app/{auth,doc,folders,login,profile,
trash,workspace}`, `components/`, `lib/`, `proxy.ts`, `supabase/`, the PRDs and this tracker are untracked,
plus modified `app/{globals.css,layout.tsx,page.tsx}`, `CLAUDE.md`, `package*.json`. No real commit yet.

---

## File inventory (full)

**Config / libs**
| Path | Purpose |
|---|---|
| `.env.local` | Supabase URL + publishable key (Mumbai project). Gitignored. |
| `next.config.ts` | Next config — currently empty/defaults. |
| `proxy.ts` | Per-request gate (Next 16 renamed `middleware`→`proxy`). Authoritative `getUser()` (refresh + revalidate) + redirects logged-out users off non-public routes to `/login`. `matcher` excludes static assets. |
| `lib/supabase/client.ts` | Browser Supabase client (`createBrowserClient`). |
| `lib/supabase/server.ts` | Server Supabase client (`createServerClient`, async cookies; `setAll` swallowed in RSC). |
| `components/icons.tsx` | `FileIcon` (document glyph) + `FolderIcon` (folder-tab glyph) — kept visually distinct. |
| `components/profile-avatar-link.tsx` | Async server component: circular avatar (initial fallback) linking to `/profile`. Self-contained (reads user + profile via `getUser`). Used top-left in the doc editor. |

**Auth + shell**
| Path | Purpose |
|---|---|
| `app/layout.tsx` | Root layout; loads Fraunces + Hanken Grotesk; app metadata. |
| `app/globals.css` | Design tokens (yolk palette, paper/ink), grain texture, `rise` load animation, `.doc-content` editor styles, profile-picture viewer animations (`viewer-overlay-in/out`, `viewer-pic-in/out`). |
| `app/page.tsx` | Root — `getClaims()` → redirect to `/workspace` (logged in) or `/login`. |
| `app/login/page.tsx` | Two-stage email-OTP login + "Continue with Google". |
| `app/auth/callback/route.ts` | OAuth return handler (`exchangeCodeForSession` → redirect to `next`/`/workspace`). |
| `app/workspace/logout-button.tsx` | Client logout (`signOut` + redirect). |

**Profile**
| Path | Purpose |
|---|---|
| `app/profile/page.tsx` | Protected; `getClaims()` for auth, reads profile row by `claims.sub`. |
| `app/profile/profile-form.tsx` | Client form: avatar upload + display name + status, client-side save. Also the **profile-picture viewer**: click avatar / "View photo" → enlarged photo in a circular frame (transparent overlay via `createPortal`), draggable like a macOS window, closes on outside-click or Escape. |

**Workspace / documents / folders**
| Path | Purpose |
|---|---|
| `app/workspace/page.tsx` | Protected desk (`getClaims()`); lists top-level folders + all live docs (grids). Computes per-folder live-doc counts. |
| `app/workspace/actions.ts` | **All Server Actions** (`"use server"`). Docs: create / createInFolder / delete(soft) / restore / purge. Folders: create / rename / move(nest, cycle-guarded) / delete(soft) / restore / purge. Membership: add/remove doc↔folder. `emptyTrash`. Each calls `requireUser()` (`getUser`). |
| `app/workspace/document-card.tsx` | Client doc card: thumbnail + ⋯ menu (add/remove folder membership, delete). **Draggable** (sets `application/x-deescribe` payload) for filing into folders. |
| `app/workspace/folder-card.tsx` | Client folder card: ⋯ menu (rename/delete). **Draggable + drop target** — drop a doc to file it, drop a folder to nest it (`moveFolderIntoFolder`). |
| `app/workspace/new-folder-button.tsx` | Client "New folder" (`prompt` → `createFolder`). |
| `app/doc/[docId]/page.tsx` | Protected (`getClaims()`); loads doc (RLS-guarded), migrates legacy `{plain}` content → `<p>` HTML, renders editor. |
| `app/doc/[docId]/document-editor.tsx` | Client rich-text editor: title, `contenteditable` body, sticky toolbar (B/I/U, H1–H5, bullets via `execCommand`), debounced ~1 s autosave (`{version:2, html}`), soft-delete. Paste stripped to plain text. |
| `app/folders/[folderId]/page.tsx` | Protected (`getClaims()`); folder view — its docs, new-doc-in-folder, inline rename, delete. |
| `app/folders/[folderId]/folder-controls.tsx` | Client `FolderTitle` (inline rename on blur/Enter) + `DeleteFolderButton`. |

**Trash**
| Path | Purpose |
|---|---|
| `app/trash/page.tsx` | Protected (`getClaims()`); soft-deleted docs + folders (`deleted_at IS NOT NULL`), grouped grids, empty state. |
| `app/trash/trash-card.tsx` | Client card for a trashed doc/folder: **Restore** + **Delete forever**. |
| `app/trash/empty-trash-button.tsx` | Client "Empty trash" (confirm → `emptyTrash`). |

**Database** — `supabase/migrations/0001_create_documents.sql`, `0002_create_folders.sql` (both applied).

---

## Key decisions

- **Auth model:** passwordless **email OTP (6-digit code)** + **Google OAuth**. Cookie-based sessions via
  `@supabase/ssr` so Server Components/middleware know the user.
- **Email OTP requires custom SMTP** to edit the template/show the code → using **Resend**
  (`smtp.resend.com:465`, user `resend`, password = Resend API key). Sender `onboarding@resend.dev` for now
  (only delivers to the Resend account owner's email until a domain is verified).
- **"Confirm email" must be OFF** in Supabase Email provider — otherwise new users get a "Confirm signup"
  email instead of the OTP code.
- **Email template:** code shown **dark-on-light with a yolk accent bar** (not light-on-dark) to survive
  email-client dark-mode recoloring.
- **Design language:** editorial / warm-paper. Egg-yolk yellow `#ffb300` is the single accent (PRD §9).
- **Region moved Sydney → Mumbai** for India latency.
- **Auth verification split (perf):** proxy = authoritative `getUser()` (network) once per request; pages
  = `getClaims()` (local ES256 verify, no network). Avoids paying two auth round-trips per navigation.
- **Organising = drag-and-drop + ⋯ menus.** Docs and folders are HTML5-draggable; folder cards are drop
  targets (drop a doc to file it; drop a folder to nest it — `moveFolderIntoFolder`, with a cycle guard).
  A shared `application/x-deescribe` drag payload (`{type, id}`) carries the dragged item.
- **Content model:** doc `content` is `{version: 2, html}`; legacy `{plain}` rows auto-convert to `<p>`
  on open. `execCommand` is a mutation convenience only — the saved HTML is the source of truth.

---

## Pending / next up

- [x] **Email OTP working end-to-end** on Mumbai project (SMTP, template, Confirm-email OFF, URL config done).
- [x] **Google OAuth working end-to-end** (Google Cloud client + Supabase provider configured).
- [x] **Migrations 0001 + 0002 applied** (confirmed via live doc/folder data, 2026-06-15).
- [x] **App in active logged-in use** — documents create/edit/autosave and folders render with real data.
- [x] **Google app published** (confirmed 2026-06-16 — new non-test email signed in).
- [ ] **Confirm end-to-end manually:** profile avatar upload + save; doc reload-persists; folder add/remove/
      nest/restore. (Plumbing works in runtime; no formal pass recorded.)
- [ ] **Commit the working tree.** Everything below the initial `create-next-app` commit is currently
      uncommitted (see Git state note). Consider an initial real commit of the app.
- [ ] **Optional perf:** switch proxy `getUser()` → `getClaims()` to drop the last ~375 ms/nav (tradeoff:
      revoked sessions valid until token expiry). Deferred — kept as the authoritative gate.
- [x] **Responsive pass — page chrome** (2026-06-15): workspace/folder/trash headers + title rows now
      stack/wrap on phone (mobile-first `sm:` prefixes). Login/profile/editor were already responsive.
- [ ] **Responsive polish (deeper):** tablet (768px) grid tuning, editor sticky-toolbar while typing on
      mobile, and confirm folder/trash hardening with a genuinely long folder name (only pattern-verified).
- [ ] **Next doc slices:** rich block editor (§4.5) → embeds → export/publish.

---

## Changelog

### 2026-06-17
- **Bugfix: media figures nesting on insert (corrupted audio render).** First runtime test showed audio
  players as bare unstyled text. Root cause (found via inspecting saved DOM): a second media insert could
  land with the caret *inside* a previous non-editable figure, jamming the new `<figure>` into the prior
  figure's `<span data-audio-time>` → invalid HTML (`figure` inside `span`) → browser reparents on reload
  → flex layout collapses → looks unstyled. NOT a CSS bug. Fix: `insertNodeAtCaret` now walks up from the
  caret and, if it sits within a `contenteditable=false` block, repositions to just *after* the outermost
  such block — so image/video/audio always insert at the top level, never nested. `tsc`+`eslint` clean.
  **Docs already saved with the bad HTML stay corrupted** — test in a fresh doc; clear `.next` to rule out
  CSS caching. (Same fix protects image + video inserts.)
- **Audio embeds + custom waveform player — BUILT** (steps 2–4 of the §9 plan; gate clean,
  not yet runtime-tested). Migration 0005 **applied** to remote (`supabase db query --linked`;
  `doc-audio` bucket + 4 RLS policies created). New code:
  - **`lib/audio-prepare.ts`** — browser-only: `decodeAudioData` (OfflineAudioContext @22.05 kHz to
    bound memory) → `computePeaks` (avg channels → 56 peak bars, normalised 0–100) + ≤60 s cap. ≤60 s
    uploads the **original file untouched**; >60 s trims to the first 60 s and re-encodes that slice to
    **WAV** (dependency-free `encodeWav`, 16-bit PCM). No ffmpeg, no server compute.
  - **`lib/use-audio-insert.ts`** — `useAudioInsert` hook (mirrors the video hook minus the server
    action) + `buildAudioFigure`: optimistic "Preparing…" placeholder → prepare → upload blob to
    `doc-audio` at `‹uid›/‹docId›/‹id›.‹ext›` → swap in the player. Player markup is fully serializable
    (`data-peaks`, two layered bar rows, `<audio preload=metadata>`); 50 MB guard; mid-flight-delete race
    handled.
  - **`document-editor.tsx`** seams: `mediaPathsIn` now returns `audios` (from `audio[data-path]`);
    `knownAudioPaths` ref seeded on mount + diffed on save (orphan sweep on `doc-audio`); save clone
    strips `figure[data-audio][data-status]` placeholders and resets transient `--played`/`data-playing`;
    Audio toolbar button + hidden `audio/*` input; drop + paste route audio files; `onEditorClick` does
    play/pause + click-to-seek on the waveform. **Key trick:** ONE set of **capture-phase** media
    listeners on the editor drives every player (current + reloaded) — media events don't bubble but the
    capture phase still reaches the parent, so no per-element hydration. `timeupdate` sets the `--played`
    fill fraction; CSS clips a yolk bar-row copy to it (WhatsApp-style progress).
  - **`components/icons.tsx`** `AudioFrameIcon` (waveform bars). **`actions.ts`** `purgeDocMedia` now
    sweeps `doc-audio` too. **`globals.css`** `figure[data-audio]` player styles (yolk play/pause button,
    layered waveform with `--played` clip-path fill, time readout, Preparing placeholder).
  - **Deferred (per user):** 0–200 % volume / Web Audio GainNode. **No contextual audio toolbar** in v1
    (delete via Backspace on the atomic block). `tsc --noEmit` + `eslint` clean; **runtime test pending**
    (auth-gated — needs a login + a real audio upload). Retired `HANDOFF-audio.md`.
- **Audio embeds + custom player — slice started (PRD recorded, migration written).** New feature:
  embed audio in a doc with a custom yolk-accented player and a **real WhatsApp-style waveform**.
  - **PRD §9 added to `prd.md`** (status table row + full section), and §"Open questions" renumbered
    §9→§10. Records two deliberate decisions: (1) **deviation from `prd-vision.md` §9.1** — real
    waveform instead of the spec's "decorative only" (better UX, near-zero extra cost; vision left
    unedited as the frozen reference). (2) **Least-resource approach** — compute waveform peaks ONCE
    in the uploader's browser at insert (`decodeAudioData` → ~50 normalised bars), store on the figure
    as `data-peaks` in the existing `{version:2, html}` model (**no schema change**); every viewer
    renders instantly, zero server compute, audio streams only on play. **0–200% volume (GainNode)
    deferred** per user — first cut is play/pause + seek + waveform.
  - **Migration `supabase/migrations/0005_create_doc_audio_bucket.sql` written** (NOT yet applied):
    public-read `doc-audio` bucket, 50 MB cap, owner-scoped write RLS, path `‹uid›/‹docId›/‹id›.‹ext›`
    — mirrors `doc-videos` (0004). No transcode / no `-raw` temp (audio stored as-is). Apply via
    `supabase db query --linked -f …0005….sql` (the established path while migration history is split).
- **Reviewed video import for crash caveats (no code change yet).** Local dev: working as designed
  (auth re-check, path-ownership guard, temp-dir `finally` cleanup, mid-encode delete race handled).
  The "max ~11s" the user observed is **not** a code limit — nothing caps duration; just the test
  clips. Real caveats surfaced: **(1) 🔴 production/Vercel will break** — `compressVideo` spawns the
  native `ffmpeg-static` binary via `execFile`; serverless has no `maxDuration` set (default ~10s on
  Hobby) so `preset slow` encodes get killed, plus `/tmp` ~512 MB + memory limits + binary may not
  ship. Transcode must move off Vercel before deploying video. **(2) 🟠 no `timeout` on the ffmpeg
  spawn** → a malformed/huge file can hang the action forever (spinner never resolves). **(3) 🟠
  `preset slow` scales with length×resolution** — long/4K or many parallel drops saturate CPU / feel
  like a hang. **(4) 🟡 failed encode leaks a `…-raw` orphan** in storage until doc purge. Offered to
  add the spawn timeout as cheap hardening.

### 2026-06-16
- **Hardened the magic-link / email-OTP template for real inboxes.** The custom branded HTML (Tiro card,
  yolk accent, code box) lived only in the Supabase dashboard and rendered poorly because it pulled fonts
  via `<link href="fonts.googleapis.com">` — email clients strip `<head>`/`<link>`, so Fraunces/Hanken
  never loaded. Rewrote it with web-safe stacks only (Georgia serif for display + code, Helvetica/Arial for
  body — accessible everywhere, no external requests) and added an Outlook MSO ghost-table wrapper so the
  480px card keeps its width/rounded corners in the Word engine. Now version-controlled at
  `supabase/templates/magic_link.html` and wired via `[auth.email.template.magic_link]` in `config.toml`
  (still needs pasting into the hosted dashboard, or `supabase stop && start` for local). Variable is
  `{{ .Token }}` (correct for email OTP; `.Code` is SMS-only).
- **Fixed Google OAuth "redirects to localhost" after rebrand.** Root cause: Supabase **URL Configuration**
  still had the old dev `Site URL` and the new domain was not on the redirect allow-list, so Supabase
  ignored the app's `redirectTo` and fell back to `localhost`. Fix (dashboard): `Site URL` →
  `https://tiro.works`; added `https://tiro.works/auth/callback`, `https://www.tiro.works/auth/callback`,
  `http://localhost:3000/auth/callback` to **Redirect URLs**. Google provider toggle was already Enabled.
- **Restored paused Supabase project.** A spinning load at `…supabase.co/auth/v1/authorize` (mid-OAuth) was
  the free-tier project being auto-paused; restoring it cleared the hang.
- **Confirmed Google app is published** (not in Testing mode): a brand-new non-allow-listed email signed in
  successfully. Removes the prior "publish Google app" pending item. Consent-screen name may still show
  "DeeScribe" (cosmetic).
- **Rebrand: DeeScribe → Tiro** (domain `tiro.works`, bought on GoDaddy). Named after Marcus Tullius Tiro.
  - **GitHub repo renamed** `deescribe` → `tiro` via `gh repo rename` — remote `origin` is now
    `https://github.com/khandelwalprakhar123-star/tiro.git` (local remote auto-rewritten; old URL redirects).
  - **UI/code rebrand** (done by a parallel subagent): user-facing wordmark + page title + profile copy
    `DeeScribe` → `Tiro` across `app/layout.tsx`, `app/login/page.tsx`, `app/workspace/page.tsx`,
    `app/trash/page.tsx`, `app/profile/page.tsx`. Internal: unfurl UA → `TiroBot/1.0; +https://tiro.works`
    (`lib/unfurl-actions.ts`), video temp-dir prefix → `tiro-vid-` (`lib/video-actions.ts`). Drag MIME
    `application/x-deescribe` → `application/x-tiro` at all 3 sites (`document-card.tsx` set;
    `folder-card.tsx` read + set) — drag-to-file/nest stays consistent. `tsc` + `eslint` clean.
  - **Pending (user dashboard actions):** rename Vercel project `deescribe` → `tiro`
    (`prj_pIAhrkoEZeAZM1anMUc4xEivici7`, team `team_J9JnarR91YdIOg9pFbn81po3`); rename Supabase project
    display name `DeeScribe` → `tiro` (cosmetic only — ref `rgryvohgicykwuxnwnhe`/URL/keys unchanged);
    attach `tiro.works` in Vercel Domains + add A(`@`)/CNAME(`www`) records at GoDaddy.
  - **Not changed:** local dir name (`texteditor`), Supabase ref/URL, env vars, storage bucket names,
    migrations.
  - **Domain wired:** `tiro.works` added in Vercel (apex primary; `www` redirects). DNS kept at GoDaddy —
    apex **A `@` → `216.198.79.1`** (Vercel new-scheme IP), **CNAME `www` → `d2bc8aa19557a0c8.vercel-dns-017.com`**
    (edited GoDaddy's default Parked A + `www`→`tiro.works` CNAME; NS/SOA/_domainconnect left intact).
    Verified live via `dig`. SSL auto-issued by Vercel.
  - **Deploy gotcha — Vercel "BLOCKED" deployments.** First two pushes deployed but Vercel marked them
    `BLOCKED`. Root cause: **no git identity was set on the machine**, so commits were authored as
    `humptydumpty@Humptys-MacBook-Air.local` (hostname-derived), which isn't a GitHub-recognized email →
    Vercel's commit-author anti-abuse gate blocks the build. Also had to reconnect Vercel↔GitHub once after
    the repo rename. **Fix:** set `git config user.name "Prakhar Khandelwal"` + `user.email` to the GitHub
    no-reply address `260607936+khandelwalprakhar123-star@users.noreply.github.com` (guaranteed tied to the
    account, keeps real email private), then a fresh commit deployed cleanly (Vercel resolved
    `githubCommitAuthorLogin`). NOTE: identity is set **repo-local only** — set it `--global` to avoid the
    same block in other repos. The two earlier bad-author commits remain in history (harmless; tip is valid).
- **Video upload + server-side compression, and pasted-URL link previews (feature branch `feat/video`).**
  Built in a git worktree (`.claude/worktrees/video`) off the `773115b` baseline so it can later merge cleanly
  alongside the parallel image work above. Two capabilities, deliberately split into separate files so they
  only meet `document-editor.tsx` in small additive seams (keeps merge conflicts near-zero).
  - **Compression decision (locked with user):** **H.264 / CRF 20 / preset slow**, long edge capped at
    **1080p** (downscale-only), AAC 128k, `+faststart`. CRF is a *quality* target (not a fixed bitrate), so
    quality stays near-identical to source while files shrink ~50–80%. Runs **server-side** via a native
    `ffmpeg` binary (`ffmpeg-static` + `ffprobe-static`), NOT in the browser (too expensive client-side).
  - **Why a storage PATH, not bytes, crosses the server action:** Next's `serverActions.bodySizeLimit`
    defaults to **1 MB** (confirmed in bundled docs). So the **client uploads the raw file straight to
    storage**, then calls the action with just the path. Flow: optimistic "Uploading…/Compressing…"
    placeholder → upload raw to `‹uid›/‹docId›/‹id›-raw.‹ext›` → `compressVideo({rawPath,docId,id})` → server
    downloads, transcodes in `/tmp`, probes dims/duration, extracts a poster frame, uploads `‹id›.mp4` +
    `‹id›.jpg`, deletes the raw → client swaps the placeholder for a real `<video controls poster>`.
  - **Files added:** `supabase/migrations/0004_create_doc_videos_bucket.sql` (public-read `doc-videos` bucket,
    owner-scoped RLS mirroring 0003, 500 MB cap — **APPLIED to remote**, bucket + 4 policies verified);
    `lib/video-actions.ts` (`"use server"` ffmpeg transcode); `lib/use-video-insert.ts` (client hook);
    `app/doc/[docId]/video-toolbar.tsx` (align / caption / delete / resize); `lib/unfurl-actions.ts`
    (`"use server"` OpenGraph/oEmbed + YouTube/Vimeo, SSRF host guards); `lib/use-link-preview.ts` (pasted-URL
    → preview card, inline play-on-click via delegation so it survives reload); `lib/vendor.d.ts`;
    `VideoFrameIcon` in `components/icons.tsx`.
  - **Editor seams (`document-editor.tsx`, additive):** `imagePathsIn` → `mediaPathsIn` (images vs videos —
    different buckets); `knownVideoPaths` + `selectedVideo`; save now serialises from a **clone** that strips
    the selection ring AND in-progress placeholders (a still-compressing video / still-loading card is never
    persisted); orphan cleanup sweeps **both** buckets; `onPaste` routes a lone URL to a preview; `onDrop`
    accepts videos; `onEditorClick` handles preview play/open + video selection; toolbar gains a **Video** button.
  - **Cleanup:** `actions.ts` `purgeDocImages` → **`purgeDocMedia`** (sweeps both buckets via
    `purgeBucketPrefix`); called from `purgeDocument` + `emptyTrash`.
  - **CSS:** `figure[data-video]` (align variants, native controls, ring), upload placeholder + spinner,
    `figure[data-link-card]` unfurl cards (media, play overlay, inline iframe, clamped title/desc).
  - **Config:** `serverExternalPackages: ["ffmpeg-static","ffprobe-static"]` in `next.config.ts`; deps added.
  - **Verified:** `tsc` clean, `eslint` clean, `next build` succeeds; the exact ffmpeg encode/probe/poster
    pipeline validated on landscape (4K→1080p), portrait (unchanged), and small (no upscale) clips.
    **NOT yet runtime-tested in-app** (auth-gated — needs a login + a real upload).
  - **Worktree notes:** worktrees carry no `node_modules`/`.env.local` (gitignored), so this one got its own
    `npm install` + a copied `.env.local`. **Prod caveat:** `ffmpeg-static`+spawn suits local dev; Vercel
    serverless would need a different transcode host — isolated behind `lib/video-actions.ts`. Preset `slow`
    honored per the user's choice; flip `PRESET` to `"medium"` in `lib/video-actions.ts` if encodes feel slow.
- **Image + toolbar refinements (round 2).**
  - **Image horizontal drag (fixed).** The HTML5-drag reposition never placed (contenteditable cancels it),
    so replaced it with **pointer-based horizontal dragging**: drag the image left/right → `translateX` on the
    `<figure>` (stored as inline transform + `data-x`), clamped to the editor column. Text still flows
    above/below (no reflow). Plain clicks (no movement past a 4px threshold) still select. Removed all the old
    `draggable`/`onDragStart`/`onDrop`-internal/drop-line code; external-file drop kept. CSS `cursor: grab`/
    `grabbing`.
  - **Image toolbar:** the **AlignIcon** lost its inner lines (empty frame — it's an image). Corner rounding
    is now a **"Round" button that fades into the slider** on click (`tool-fade-in`), instead of always-on.
  - **Main toolbar:** buttons/icons enlarged (`h-9`, `text-base`, 20px trigger icons) so list prefixes read;
    corners rounded +20% (`rounded-[0.9rem]`). **Checklist** added to the list dropdown — `ul[data-checklist]`
    with a clickable non-editable `[data-check]` box; click toggles `li[data-checked]` (tick overshoots the
    square, per the icon `ChecklistIcon`); Enter adds a new item / exits when empty (`onEditorKeyDown`).
  - **Doc header:** removed the profile/avatar link (and the `avatar` prop + `ProfileAvatarLink` import) — now
    just `← Back to desk` (left) and **Delete back at top-right** (`justify-between`).
  - `tsc --noEmit` + eslint clean. Verified via Playwright: pointer X-drag moves+clamps, Round→slider reveal,
    checklist menu item, header layout. (Screenshots skipped — MCP font-load timeout; checks were functional.)
  - **Follow-up tweaks:** main toolbar order is now B/I/U · Heading · **Text align · List** · Image (align moved
    before list); toolbar buttons enlarged to **44×44px** (`h-11`, `text-lg`, 24px trigger icons). Verified via
    DOM measurement in a relaunched Playwright session.

### 2026-06-15
- **Image toolbar polish + main toolbar dropdowns + header swap (UI pass).**
  - **Image reposition (Google-Docs style):** image figures are now `draggable="true"`; dragging one shows a
    yolk **insertion line** and drops it at the caret position (`document-editor.tsx` — `draggingFigure` ref,
    `onEditorDragStart/DragEnd`, internal-move branch in `onDrop`, `dropLine` indicator). External-file drop
    still works (internal move takes priority).
  - **Icons (colorless, stroke-only, in `components/icons.tsx`):** `ImageFrameIcon` (framed mountains + sun)
    replaces the 🖼 emoji on the insert button; `TrashIcon` replaces 🗑 on the image delete; `AlignIcon`
    (←[≡]→) for the image align dropdown; `ListIcon` (I / a / • rows) and `TextAlignIcon` (universal lines)
    for the main toolbar.
  - **Image toolbar:** the 3 align buttons collapsed into a **dropdown** (Left/Center/Right). Corner rounding
    is now a **slider** (`0`=sharp → `100`=very round, capped at `RADIUS_MAX_PCT=40%` so it never becomes a
    circle/ellipse; stored as `data-radius` + inline `border-radius`). Removed the old discrete radius CSS.
  - **Main formatting toolbar:** **centered** (`justify-center`); headings H1–H5 collapsed into an **H
    dropdown** (+ Normal text); the bullet button became a **list dropdown** (Bulleted + Numbered, new
    `insertOrderedList`); new **text-align dropdown** (Left/Center/Right) with **⌘E/⌘L/⌘R** keyboard
    shortcuts (`onEditorKeyDown`). Reusable `ToolbarMenu`/`MenuItem` + shared `toolbarBtnClass`.
    `ActiveMarks` extended with `ordered` + `align` (via `queryCommandState`).
  - **Header layout swap (user pref):** nav/actions move LEFT, the `— DeeScribe` wordmark moves RIGHT.
    Workspace + Trash: groups reordered (nav left, wordmark right). Doc editor + Folder: `justify-between` →
    `justify-start` (all controls left). Profile already matched (Back-to-desk left, label right).
  - `tsc --noEmit` + eslint clean; dropdowns + reposition smoke-verified via Playwright.
- **Image editing (slice 2) — contextual image toolbar.** Click an inserted image → selection ring +
  floating toolbar (`app/doc/[docId]/image-toolbar.tsx`, new). Tools: **resize** (drag bottom-right handle,
  stored as a % width on the `<figure>`), **align** L/C/R (block placement within the column — text still
  only above/below; the user confirmed NO side-wrap, so we kept the in-flow block model), **flip** H/V,
  **filters** grayscale/sepia/contrast, **caption** (toggle an editable `<figcaption>`), **delete**, and
  **crop**. All non-destructive edits are encoded as `data-*`/inline-style on the figure/img and saved in
  the HTML (reversible, CSS in `globals.css`). **Crop is DESTRUCTIVE** (user's choice; undo/redo planned
  later): draws a rectangle → `fetch()` the source bytes (avoids canvas cross-origin taint) → canvas crop →
  re-encode WebP → upload a NEW `‹uid›/‹docId›/‹id›.webp` → swap `src`+`data-path`; the old file becomes
  unreferenced and is swept by the existing reconcile-on-save cleanup.
  - **Editor wiring** (`document-editor.tsx`): `selectedFigure` state, click-to-select (caption clicks keep
    selection), outside-mousedown deselect (ignores `[data-image-overlay]`), selection ring stripped from
    the saved HTML so it never persists.
  - **"Too large" fix:** default figure width is now **65%** of the column (`globals.css`) instead of full
    width; resize handle adjusts from there.
  - Lint note: image-toolbar opts out of `react-hooks/immutability` + `set-state-in-effect` for the file —
    it does intentional imperative DOM mutation of the contenteditable subtree, which those rules don't
    model. `tsc --noEmit` + eslint clean. Known gaps: crop mapping ignores active flips (crop-before-flip
    is fine); no multi-handle crop box (draw-rectangle only); resize is width-only (aspect locked).
- **Supabase CLI workflow set up + agent skills installed.** Installed Supabase CLI **2.106.0**
  (`brew install supabase/tap/supabase`) and the agent skills (`npx skills add supabase/agent-skills` →
  `.agents/skills/{supabase, supabase-postgres-best-practices}`, symlinked to Claude Code; project-scoped,
  NOT gitignored — commit them). Ran `supabase init` (created `supabase/config.toml`) + linked to DeeScribe
  (`supabase link --project-ref rgryvohgicykwuxnwnhe`). This replaces the dashboard-SQL workaround for the
  long-denied MCP schema writes — migrations can now be applied from the terminal.
  - **Migration-history split-brain discovered (deferred cleanup).** `supabase migration list --linked`
    shows local `0001/0002/0003` are NOT in remote history, while remote has 3 orphan timestamped entries
    (`2026-06-13T17:58–18:00` = the original profiles/avatars MCP migrations) with no local files. So
    `supabase db push` is blocked ("remote versions not found in local") until reconciled. The actual
    *schema* is all present; only the history table disagrees. Reconciling (via `db pull` baseline, or
    `migration repair`) is a separate task — not done yet to avoid mutating remote history without need.
  - **How 0003 was applied despite the block:** `supabase db query --linked -f …` runs SQL directly via the
    Management API (login token, no DB password, no history write) — the least-invasive path. Going forward,
    until history is reconciled, use `db query --linked` for ad-hoc remote SQL rather than `db push`.
- **Image insertion (slice 1) — drag / paste / toolbar, client-compressed, owner-scoped storage,
  orphan-free.** Lets a doc embed images. Decisions locked first with the user: **lossy WebP @0.8 quality**
  client-side (NOT lossless), **single copy** for v1 (a bounded "full" second copy for click-to-expand is a
  deferred v2 — additive), images are **full-width centered blocks** so text only flows above/below (the
  user's stated wrap need; no left/right wrap → no `float`/`shape-outside`, no floating-coordinate layer).
  Vercel image optimization avoided via plain `<img>` + `images:{unoptimized:true}` already in `next.config.ts`.
  - **`lib/compress-image.ts`** — `createImageBitmap({imageOrientation:"from-image"})` (bakes in EXIF
    rotation) → scale longest edge to ≤1600px → `canvas.toBlob("image/webp", 0.8)`. Keeps Supabase
    storage + egress small (free-tier protection). Returns `{blob,width,height}`.
  - **`supabase/migrations/0003_create_doc_images_bucket.sql`** — public-read `doc-images` bucket; RLS
    insert/update/delete restricted to the user's own `‹uid›/…` folder (mirrors `avatars`). Path scheme
    **`‹uid›/‹docId›/‹imageId›.webp`** — scoping by docId is what makes purge cleanup a single list+remove.
    **APPLIED** ✅ (2026-06-15) via `supabase db query --linked -f …0003….sql` — verified on remote:
    bucket `doc-images` (public=true) + all 4 policies present.
  - **`app/doc/[docId]/document-editor.tsx`** — toolbar **🖼 Image** button (hidden file input), **paste**
    (clipboard image), **drag-drop** (desktop files, caret set to drop point) all funnel into one
    `insertImage(file)`: compress → upload → insert a `<figure data-img contenteditable=false><img
    data-path=…></figure>` block + trailing `<p>` via DOM nodes (robust vs focus loss). New `userId` prop
    (passed from page `claims.sub`).
  - **Orphan-free deletion (two layers):** (1) **reconcile-on-save** — each save diffs `data-path`s in the
    live DOM against `knownImagePaths` (seeded on mount); images removed in the editor get
    `storage.remove()`d. (2) **purge cleanup** in `actions.ts` — `purgeDocument` + `emptyTrash` call a new
    `purgeDocImages()` (list+remove `‹uid›/‹docId›/`). `purgeFolder` needs none (it deletes the folder, not
    its docs). Soft delete keeps images (restorable).
  - **`app/globals.css`** — `.doc-content figure[data-img]`/`img` block-centered, `max-width:100%`.
  - **Known v1 gaps (deferred):** no resize handles / drag-to-reorder yet (layout resize = future CSS-width
    edit); undo *after* a save that already swept the file would 404 the image (rare); animated GIFs flatten
    to a static WebP frame. `tsc --noEmit` + eslint clean. NOT runtime-tested yet (needs the 0003 migration
    run + a login).
- **Fixed SSR hydration error on document/trash cards (date formatting).** Both `app/workspace/document-card.tsx`
  and `app/trash/trash-card.tsx` formatted dates with `new Date(iso).toLocaleDateString(undefined, …)`. The
  `undefined` locale resolves to the *runtime's* default, which differs between the Node server (en-US →
  "Jun 15, 2026") and the browser (en-GB → "15 Jun 2026"); `toLocaleDateString` also uses local timezone.
  Both are non-deterministic across server/client, so React threw a hydration mismatch and re-rendered the
  subtree on the client. Fix: new shared **`lib/format.ts`** `formatDate(iso)` that builds the string from a
  fixed month table and **UTC** date parts → locale- and timezone-independent, identical on server and client.
  Output format is now "15 Jun 2026". Removed the duplicated local `formatDate` from both card components and
  imported the shared one. `tsc --noEmit` clean.
- **Responsive pass — workspace, folder, trash headers/title rows.** Playwright audit at 375 / 768 / 1280px
  across all pages. Findings: `/login`, `/doc/[id]` editor, and `/profile` already responsive; `/workspace`
  **broken** at phone width — the top nav (wordmark + Trash/Profile/Sign out pills) and the title row
  ("Documents" + New folder/New document buttons) were hardcoded `flex … justify-between` with no wrap/stack,
  so the right-most pill/button clipped off-screen, worsened by `px-8` container padding. Fix (mobile-first
  Tailwind): container `px-4 py-10 sm:px-8 sm:py-16`; header `flex-wrap … gap-y-4`; title row
  `flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between`. Verified fixed via re-screenshot.
  Applied the **same hardening preventively** to `/folders/[folderId]` and `/trash` — their title rows shared
  the identical brittle `justify-between` pattern (fit only because the current folder name is short; a long
  name would clip the "+ New document" / "Empty trash" button). `tsc --noEmit` clean. Desktop layout
  unchanged (every new class is `sm:`-gated). Doc editor + login + profile needed no changes.
- **Added `OVERVIEW.md`** — a short (~70-line) high-level map: what DeeScribe is, what's built, and the
  two tech layers (Next.js on top, Supabase beneath) + how a session cookie connects them. Deliberately
  omits real-time and deep mechanics (those live in `LEARNING.md`). Doc only.
- **Added `LEARNING.md`** — a teaching guide to the stack for the project owner (this is a learn-Next.js
  project). Covers: the request lifecycle (proxy → server component → hydration → mutation → revalidate),
  Server vs Client Components, Server Actions, every React hook used (with the `useRef`-for-latest-value
  and `useEffect`-cleanup lessons), data freshness vs real-time (honest: app uses pull/`revalidatePath`,
  NOT Supabase Realtime — includes how to add it), and a Supabase deep dive (two clients, cookie auth +
  proxy, `getUser` vs `getClaims`, RLS, auth flows, storage, soft delete). Plus an errors/gotchas field
  guide and ranked key concepts. Doc only; no app code changed.
- **Tracker de-stale + full audit.** Read the entire app and reconciled this tracker: expanded the file
  inventory from "(auth + profile)" to the **full** tree; marked migrations 0001/0002 **applied**;
  documented **drag-and-drop organising** + `moveFolderIntoFolder` (was shipped in code but never logged);
  documented the `{version:2, html}` content model; refreshed Pending. No code changed in this pass.
- **Perf fix — page auth via `getClaims()` (no network).** Every protected navigation was making **two**
  network `getUser()` calls (one in `proxy.ts`, one in the page). Switched the page-level call to
  `getClaims()` in all six pages (`/`, `/workspace`, `/doc/[docId]`, `/folders/[folderId]`, `/trash`,
  `/profile`) — local ES256 JWT verification (asymmetric signing keys confirmed via the JWKS endpoint),
  **zero network**. Removes ~375 ms/navigation. `profile` now reads id/email from `claims.sub`/`claims.email`.
  `getUser()` retained in the proxy (authoritative gate + cookie refresh), Server Actions, and
  `ProfileAvatarLink`. `next build` type-checks clean; auth still enforced (verified 307→/login on
  unguarded `/folders`). The remaining proxy `getUser()` (~375 ms) is the next optional lever.
- **Perf investigation (why "slow to render").** Measured via the Next dev `trace` + per-request log.
  Findings: dev render is **bimodal** — p50 ≈ 83 ms but a tail to ~2.3 s; the tail is **Turbopack
  on-demand compile** (first hit per route / after an edit), *not* app code (incremental compiles are
  15–100 ms). Supabase RTT from India ≈ 50–65 ms (not the bottleneck). Production build renders
  unauthenticated routes in ~5 ms (no on-demand compile). Net: in-dev ~1 s/edit is normal `next dev`
  overhead; the controllable runtime cost was the double `getUser()` (fixed above). Also confirmed
  `proxy.ts` loads correctly (unguarded `/folders` 307→`/login` proves the proxy runs) and the earlier
  middleware→proxy deprecation/error log lines were stale history from a mid-session rename (clean after
  restart). Google Fonts fetch is fast (~190 ms), not a stall source.
- **Fixed stale folder document count on workspace folder cards.** The count
  (`folderCounts` in `app/workspace/page.tsx`) was tallying raw `document_folders`
  link rows without checking `deleted_at`. Because deletes are soft (the link row
  survives), trashed-but-still-linked docs inflated the count (e.g. delete 1 of 3 →
  still showed 3; add 1 → showed 4 for 3 real docs). Fix: build a `liveDocIds` set
  from the already-fetched live `documents` and count only links pointing to a live
  doc. The folder *detail* page was already correct (re-queries with `deleted_at IS
  null`); only the card count drifted.
- **Renamed `middleware.ts` → `proxy.ts`.** Next.js 16 deprecated the `middleware` file convention and
  renamed it to `proxy` (same functionality; clearer name, and Proxy now defaults to the Node.js runtime
  instead of Edge). Changes: file renamed, exported `middleware` function renamed to `proxy`, in-file
  comments updated. The `config`/`matcher` export and all Supabase session/cookie logic are unchanged.
  Cleared the deprecation warning. (Codemod available: `npx @next/codemod@canary middleware-to-proxy .`)

### 2026-06-14
- **Trash view / restore / permanent delete (final delete slice).** Completes the soft-delete lifecycle:
  deleted docs/folders were previously invisible forever but kept in the DB. New:
  - **Server actions** (`app/workspace/actions.ts`): `restoreDocument`/`restoreFolder` (clear `deleted_at`),
    `purgeDocument`/`purgeFolder` (hard `DELETE`; doc↔folder links cascade away via the 0002 FK),
    `emptyTrash` (hard-deletes all soft-deleted docs+folders for the user). `deleteDocument` now also
    `revalidatePath("/trash")`.
  - **`/trash` page** (`app/trash/page.tsx`, server component): queries the mirror of every other view
    (`deleted_at IS NOT NULL`), grouped Folders + Documents grids, "Empty trash", empty state. Auth-gated
    (not in middleware PUBLIC_ROUTES + re-checks user).
  - **`app/trash/trash-card.tsx`** (client): reused for both kinds — Restore + "Delete forever" (confirm).
  - **`app/trash/empty-trash-button.tsx`** (client): confirm → `emptyTrash`.
  - **Workspace header** gains a **Trash** link (next to Profile).
  - **Known limitation:** `purgeFolder` relies on the `folders.parent_id on delete cascade`, so permanently
    deleting a folder would also delete any *nested* subfolders (incl. live ones). Accepted for now — nested
    folders have no full UI. tsc + eslint clean; not runtime-tested (auth-gated + migrations must be run).

- **Folder cards get a ⋯ menu.** Extracted workspace folder cards into a `FolderCard` client component
  (`app/workspace/folder-card.tsx`) mirroring `DocumentCard`'s kebab: same trigger/dropdown styling, with
  **Rename** (prompt → `renameFolder`) and **Delete** (confirm → `deleteFolder`) actions. `page.tsx` now
  renders `<FolderCard>` instead of an inline `<Link>`. tsc + eslint clean.
- **Folders / organise (slice).** Many-to-many model per §4.1: `folders` + `document_folders` tables
  (migration `0002`), owner-only RLS (df checks ownership of both sides via EXISTS). New server actions in
  `app/workspace/actions.ts` (createFolder/renameFolder/deleteFolder, addDocToFolder/removeDocFromFolder,
  createDocumentInFolder, deleteDocument). UI: workspace Folders grid (distinct `FolderIcon` in
  `components/icons.tsx`) + New-folder button; `/folders/[folderId]` view with inline rename, delete,
  new-doc-in-folder; interactive `DocumentCard` (client) with ⋯ menu to toggle folder membership / remove /
  delete. Folder cards share the doc-card language but use a folder-tab glyph (verified distinct via
  Playwright render). tsc + eslint clean; not runtime-tested (auth-gated + migration must be run).
- **Workspace doc cards.** Replaced the text list with a Google-Docs-style responsive grid (2/3/4 cols):
  each doc is a static rounded "page" thumbnail (inline `FileIcon` SVG) with a smaller title + date below.
- **Profile avatar nav icon.** New self-contained server component
  `components/profile-avatar-link.tsx` — circular avatar (initial fallback) linking to `/profile`. Lives
  **top-left in the document editor** header (passed from the server page into the client editor as a prop,
  since it's an async server component). Workspace header reverted to wordmark + "Profile" text link.
  Intended as the future home for friends/invites. Also **widened the doc editor** (`max-w-3xl`→`max-w-5xl`,
  more padding) to use the horizontal space.
- **Editor slice 2 — rich text formatting.** Body upgraded from `<textarea>` to a `contenteditable` editor
  with a sticky toolbar: **bold/italic/underline** (selection), **H1–H5** + **bullets** (block-level;
  active heading toggles back to paragraph). Uses `execCommand` as a mutation convenience only — saved HTML
  is the source of truth (spec §4.5 allows this); paste stripped to plain text. `content` shape now
  `{ version: 2, html }`; old `{ plain }` docs auto-convert to `<p>` on open (`app/doc/[docId]/page.tsx`).
  New `.doc-content` styles in `globals.css` (Tailwind preflight strips heading/list styling). Verified the
  execCommand/queryCommandState behaviors in Chromium via Playwright (bold, formatBlock `<h1>`,
  insertUnorderedList all correct). tsc + eslint clean. NOT yet runtime-tested in-app (needs login).
  Known quirk: bullets can nest as `<p><ul>…` — browser auto-corrects on reload, cosmetic.
- **Documents skeleton (slice 1) built.** Goal: create/edit/organise/delete docs (prd-vision §2), done in
  slices. This slice = lifecycle plumbing + plain-textarea editor (rich block editor and folders come next).
  - DB: `supabase/migrations/0001_create_documents.sql` (documents table + owner-only RLS + index). Applied
    via dashboard SQL editor (user's choice; MCP schema writes denied).
  - `app/workspace/actions.ts` — `createDocument` Server Action (auth-checked, inserts, redirects to /doc/[id]).
  - `app/workspace/page.tsx` — lists live docs (newest first) + New-document button.
  - `app/doc/[docId]/page.tsx` — server-loads the doc (RLS-guarded; redirects to /workspace if missing).
  - `app/doc/[docId]/document-editor.tsx` — client editor: title rename, body textarea, debounced ~1s
    autosave with Saving/Saved state, soft-delete (sets deleted_at). Saves via browser client.
  - Verified: tsc + eslint clean. NOT yet runtime-tested (needs the migration run + a login).
  - Followed AGENTS.md directive — read bundled Next docs (mutating-data, dynamic-routes) first: confirmed
    `params` is a Promise (await it) and Server Action + redirect patterns for Next 16.
- **Doc-sync pass (de-stale).** Audited code vs docs. `prd.md`: marked Auth ✅ done, added a Profile ✅
  section + status row, added Documents/editor as planned-next. `prd-vision.md`: removed stale "Tiptap"
  mention (line 273) — editor is built from scratch (confirmed by user). `tracker.md`: refreshed
  profile-form + globals.css inventory rows; flagged that Supabase MCP schema reads now return
  permission-denied. Memory `texteditor-stack.md` corrected (was still saying TipTap + localStorage auth).
- **Authentication complete.** Email OTP and Google OAuth both working end-to-end on the Mumbai project.
  Google: created OAuth client in Google Cloud (consent screen External, redirect URI = Supabase callback),
  enabled Google provider in Supabase Sign In / Providers with the Client ID/Secret. App still in Google
  "Testing" mode (publish later for public users).
- **Viewer made draggable + portal/transparent fixes.** Overlay is now `bg-transparent` (no dark/blur
  backdrop) and rendered via `createPortal` into `document.body` — escapes the page's transformed `.rise`
  ancestor so `fixed inset-0` covers the real viewport (click *anywhere* closes; image click is
  `stopPropagation`'d). Enlarged photo is **drag-and-droppable like a macOS window**: pointer-events +
  `setPointerCapture`, offset tracked in `pos` state. Two nested elements separate concerns — outer drag
  wrapper owns the `translate` (and grab cursor), inner circle owns the scale pop animation — so the two
  transforms don't collide. Reopens centered.
- **Profile picture viewer (lightbox) added** in `app/profile/profile-form.tsx`. Clicking the avatar (now a
  button, `cursor-zoom-in`, hover-scale) or a new "View photo" button opens the photo large inside a
  circular frame over a dimmed `backdrop-blur` overlay. Closes on backdrop click (image click is
  `stopPropagation`'d) or Escape; locks body scroll while open. Fluid open/close via a
  `closed → open → closing → closed` state machine that keeps the node mounted during the exit animation.
  New keyframes in `app/globals.css` (`viewer-overlay-in/out`, `viewer-pic-in/out`), all disabled under
  `prefers-reduced-motion`. Viewer/triggers only appear when an avatar exists.

### 2026-06-13
- **PRD restructured:** `prd.md` rewritten as a lightweight *living* PRD (evolves per feature); original
  comprehensive spec preserved as `prd-vision.md`.
- **Supabase MCP:** confirmed account-level MCP works; created+deleted a project-scoped `.mcp.json`
  (redundant, 401'd) — using the global MCP instead.
- **Next.js app scaffolded** via `create-next-app` (Next 16.2.9, App Router, TS, Tailwind v4).
- **Supabase libs installed:** `@supabase/supabase-js`, `@supabase/ssr`.
- **Auth foundation built:** `.env.local`, `lib/supabase/client.ts`, `lib/supabase/server.ts`,
  `middleware.ts`.
- **Auth UI built:** `app/login/page.tsx` (email OTP + Google), `app/workspace/page.tsx`,
  `app/workspace/logout-button.tsx`, `app/auth/callback/route.ts`, `app/page.tsx` redirect.
- **Theming:** `app/layout.tsx` switched to Fraunces + Hanken Grotesk; `app/globals.css` design tokens,
  grain, load animation.
- **Verified:** app boots; `/login` 200; `/` and `/workspace` correctly redirect when logged out.
- **Project migrated Sydney → Mumbai:** created new `DeeScribe` project in `ap-south-1`
  (`rgryvohgicykwuxnwnhe`); repointed `.env.local`; old Sydney project deleted by user.
- **Email:** designed on-brand Resend OTP email template (dark-on-light code box + yolk accent); set subject.
- **Created this tracker** + added agent directive to `CLAUDE.md`.
- **Profile feature built:** migrations `create_profiles_table` (table + RLS + auto-create trigger),
  `lock_down_handle_new_user_rpc` (revoke EXECUTE — fixes advisor warning), `create_avatars_bucket`
  (public bucket + per-user-folder policies). Added `/profile` page + client form (avatar upload, display
  name, status; client-side save via browser client). Added Profile link in workspace header. Verified
  compiles + auth-guarded. Security advisors clean (only passwordless-irrelevant leaked-password lint).
