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
- Fonts: **Fraunces** (display serif) + **Hanken Grotesk** (body) via `next/font/google`; plus
  **Lora, Source Serif 4, Inter, JetBrains Mono** loaded for the editor's per-selection font picker
  (branch `feat/font-editing`)

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
- **Doc-media storage buckets** — all public-read, owner-scoped write RLS, flat `‹uid›/‹docId›/…` layout
  (so a doc purge sweeps its media in one prefix list+remove): **`doc-images`** (0003), **`doc-videos`**
  (0004), **`doc-audio`** (0005). All **APPLIED** to remote. The shared `‹uid›/‹docId›/` scheme is what
  lets `purgeDocMedia` clean all three at once.

**Git state (2026-06-21):** the app is committed and **auto-deploys to `tiro.works`** (Vercel watches
GitHub `main`; pushes by a GitHub-recognized author build live in ~1–2 min — commits authored as the
machine hostname get `BLOCKED`, see the rebrand/deploy notes). Latest commit **`441bbac`** (checklist
conversion fix + ffmpeg-free video) — **pushed and live on `tiro.works`** (deploy `dpl_CUauW9c7…`,
state `READY`, author recorded as Prakhar Khandelwal so not blocked). Working tree is **clean** (all
`HANDOFF-*.md` files were deleted). A stale **`feat/video` worktree** still exists at
`.claude/worktrees/video` (`6be1640`) but is **obsolete** — the ffmpeg server-transcode approach it held
was abandoned; video now ships the audio-model rewrite that's on `main`. Safe to remove that worktree.

**Marketing site:** `/` now serves a brand **landing page** to logged-out visitors (signed-in users still
redirect to `/workspace`). Lives in `components/landing/*`; preserves the paper/ink/yolk + Fraunces/Hanken
identity, signature "scribble → text" SVG motif, drenched-ink Publish band, and reuses the editor's
`.doc-content` CSS for true-to-life mockups. Root `PRODUCT.md` holds the impeccable design context.
See the 2026-06-22 changelog entry. **Not yet committed.**

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
| `components/icons.tsx` | Stroke-only toolbar/UI glyphs: `FileIcon`, `FolderIcon`, `ImageFrameIcon`, `VideoFrameIcon` (clapperboard), `AudioFrameIcon` (waveform), `PlusIcon` (Insert trigger), `ListIcon`, `TextAlignIcon`, `ChecklistIcon`, `AlignIcon`, `TrashIcon`. |
| `components/profile-avatar-link.tsx` | Async server component: circular avatar (initial fallback) linking to `/profile`. Self-contained (reads user + profile via `getUser`). Used top-left in the doc editor. |

**Auth + shell**
| Path | Purpose |
|---|---|
| `app/layout.tsx` | Root layout; loads Fraunces + Hanken Grotesk; app metadata. |
| `app/globals.css` | Design tokens (yolk palette, paper/ink), grain texture, `rise` load animation, `.doc-content` editor styles, media-figure styles (`figure[data-img|data-video|data-audio|data-link-card]` incl. the audio waveform player + `--played` clip-path fill), profile-picture viewer animations. |
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
| `app/doc/[docId]/document-editor.tsx` | Client rich-text editor: title, `contenteditable` body, sticky toolbar (B/I/U, H/align/list dropdowns, checklist, **Insert** dropdown → Image/Video/Audio), debounced ~1 s autosave (`{version:2, html}`). Hosts media via small modules (below); `insertNodeAtCaret` keeps media top-level (never nested); `mediaPathsIn` + per-bucket known-sets drive reconcile-on-save orphan cleanup. **Horizontal drag** repositions media (`translateX`+`data-x`): images grab directly, video/audio/link-card use a hover **drag handle** (MutationObserver-injected, stripped from saved HTML). **Backspace** at a block start deletes the preceding media figure via `execCommand("delete")` (undoable). Capture-phase media listeners drive every audio player. |
| `app/doc/[docId]/image-toolbar.tsx` · `video-toolbar.tsx` | Contextual floating toolbars for a selected image/video (resize, align, caption, flip/filters/crop for images; align/caption/resize/delete for video). Audio has no toolbar (delete via Backspace). |
| `app/folders/[folderId]/page.tsx` | Protected (`getClaims()`); folder view — its docs, new-doc-in-folder, inline rename, delete. |
| `app/folders/[folderId]/folder-controls.tsx` | Client `FolderTitle` (inline rename on blur/Enter) + `DeleteFolderButton`. |

**Media embeds (editor lib modules)**
| Path | Purpose |
|---|---|
| `lib/compress-image.ts` | Client image compression → WebP (EXIF-baked, ≤1600px) before upload to `doc-images`. |
| `lib/use-video-insert.ts` | Client video insert (NO server, NO ffmpeg): `prepareVideo` → upload original file as-is + poster to `doc-videos` → swap in `<video controls>`. |
| `lib/video-prepare.ts` | Client-only video prep (mirrors `audio-prepare`): validate ≤60 s + ≤200 MB, grab a poster frame via `<video>`→`<canvas>`, best-effort HEVC warning. No server/ffmpeg. |
| `lib/audio-prepare.ts` | Client-only audio: `decodeAudioData` → ~56 waveform peaks + ≤60 s cap (≤60 s keeps original; >60 s trims to WAV). No server/ffmpeg. |
| `lib/use-audio-insert.ts` | Client audio insert + `buildAudioFigure` (player markup w/ `data-peaks`); upload to `doc-audio`. |
| `lib/unfurl-actions.ts` · `lib/use-link-preview.ts` | Pasted-URL link-preview cards (`"use server"` OpenGraph/oEmbed unfurl + SSRF guards; client card build + delegated play/open). |

**Trash**
| Path | Purpose |
|---|---|
| `app/trash/page.tsx` | Protected (`getClaims()`); soft-deleted docs + folders (`deleted_at IS NOT NULL`), grouped grids, empty state. |
| `app/trash/trash-card.tsx` | Client card for a trashed doc/folder: **Restore** + **Delete forever**. |
| `app/trash/empty-trash-button.tsx` | Client "Empty trash" (confirm → `emptyTrash`). |

**Database** — migrations `0001_create_documents.sql`, `0002_create_folders.sql`,
`0003_create_doc_images_bucket.sql`, `0004_create_doc_videos_bucket.sql`,
`0005_create_doc_audio_bucket.sql` (all applied to remote),
`0006_create_published_pages.sql` (Publish-to-Web — **APPLIED to remote 2026-06-22**: table + 7 cols
+ 4 RLS policies verified).

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
- [x] **App committed + deploying to `tiro.works`** (Vercel ← GitHub `main`). The "commit the working tree"
      item is done; the app is live and auto-deploys on push.
- [x] **Media embeds shipped:** images, video (local-dev), pasted-URL link cards, and **audio with a custom
      waveform player** (insert/drag/paste, play/pause/seek, 60 s cap, Backspace-delete + undo). Live on prod.
- [x] **Go Marco shipped:** type-a-code formatting mode (merged `25d5e30`). The codes are called **marcos**
      (canonical term — see `prd.md` §15). Not yet browser-verified.
- [ ] **Confirm end-to-end manually:** profile avatar upload + save; doc reload-persists; folder add/remove/
      nest/restore. (Plumbing works in runtime; no formal pass recorded.)
- [ ] **Audio follow-ups (deferred):** 0–200 % volume via Web Audio `GainNode` (§9.3); bulletproof undo via
      deferred storage cleanup / soft media-trash (currently eager sweep → late-undo can 404, no orphans).
- [x] **Video — production-safe (ffmpeg removed)** (2026-06-20): dropped the server-side `compressVideo`
      transcode entirely and moved video to the **audio model** — original file stored as-is + a
      client-captured poster, ≤60 s + ≤200 MB caps, HEVC warning. No serverless timeout liability.
      Trade-off accepted: no compression; HEVC `.mov` may not play outside Safari (warned, not blocked).
- [ ] **Optional perf:** switch proxy `getUser()` → `getClaims()` to drop the last ~375 ms/nav (tradeoff:
      revoked sessions valid until token expiry). Deferred — kept as the authoritative gate.
- [x] **Responsive pass — page chrome** (2026-06-15): workspace/folder/trash headers + title rows now
      stack/wrap on phone (mobile-first `sm:` prefixes). Login/profile/editor were already responsive.
- [ ] **Responsive polish (deeper):** tablet (768px) grid tuning, editor sticky-toolbar while typing on
      mobile, and confirm folder/trash hardening with a genuinely long folder name (only pattern-verified).
- [ ] **Next doc slices:** headers/footers · **export/publish** — **PDF export DONE** (client jsPDF, opens
      in a new tab; on branch `feat/export-pdf`, awaiting review/merge); **Publish-to-Web DONE** (code +
      migration 0006 written; `<slug>.tiro.works` public pages — needs migration applied + wildcard DNS/Vercel
      domain to fully resolve, see 2026-06-22 changelog); Markdown export still pending.

---

## Changelog

### 2026-06-24
- **Logout now returns to the landing page, not the sign-in screen.** `app/workspace/logout-button.tsx`
  changed `router.push("/login")` → `router.push("/")`. The root is a `PUBLIC_ROUTE` (`proxy.ts`), so a
  signed-out visitor sees the marketing landing there — nicer "here's what you're leaving" moment, and it
  surfaces the new Go Marco band. (Sign-in screen on logout was a hard-coded redirect, never a route guard.)
- **Landing page: new "Go Marco" shorthand band** (`components/landing/shorthand-band.tsx`; wired into
  `landing.tsx` right after the "one page" proof section, + a `#shorthand` nav link in `site-nav.tsx`).
  Built with the `/impeccable` skill in the brand register. Emphasises speed/efficiency: a "Format at the
  speed of thought" headline (self-drawing scribble motif), a `Select → type a marco → ↵` flow, a
  product-faithful demo vignette (the real in-editor marco HUD applying `h1`), and a warm "Every marco"
  cheat-sheet card listing all marcos grouped (Emphasis/Align/Structure/Type/Lists/Insert/Ship) with keycap
  `<kbd>` chips + dotted-leader rows. Mono (`--font-jetbrains`) used ONLY inside code chips (literal
  keystrokes), not as decorative voice — keeps the warm-editorial brand. Server-rendered; reveals only
  enhance (no-JS/reduced-motion safe). Browser-verified at 1280px + 390px (no overflow), `tsc`/`eslint`
  clean, zero console errors. The marco list mirrors `runMarco()` + `prd.md` §15 — keep all three in sync.
- **Terminology decision (per owner): the shorthand codes are called "marcos".** Canonical vocabulary going
  forward — one **marco** = one shorthand code (`h1`, `b`, `fc red`); **Go Marco** = the mode you type them
  in; "going marco" = enabling it. Use "marco(s)" (not "shortcut"/"shorthand code") in UI copy, docs, and
  code comments from here on. Documented as `prd.md` **§15** (added this session), which also lists every
  shipped marco + the future-marcos shortlist. The internal identifiers (`marco`, `runMarco`, `GoMarcoIcon`,
  `feat/go-marco`) already match this term — no code rename needed.
- **"Go marco" shorthand mode built and merged to `main`** (`25d5e30`; branch `feat/go-marco`). A modal
  formatter in
  `document-editor.tsx`: a toolbar toggle (using the new `GoMarcoIcon`) turns the editor into command-entry
  mode — select text, type a short code, press Enter to format. Implementation:
  - `onEditorKeyDown` intercepts at the top when `marco` is on, routing keys to `handleMarcoKey`, which
    builds a buffer (Enter applies, Esc clears/exits, Backspace edits; modifier + arrow keys pass through).
    Selection is preserved because every captured key is `preventDefault`'d — no DOM mutation, so no snapshot
    needed (unlike `font-color-control.tsx`, which must snapshot because its inputs steal focus).
  - `runMarco(code)` maps codes to the **existing** helpers (no reimplementation): `exec()` for b/i/u +
    align + headings + bullets/numbered + `p`; `insertChecklist()`; `nudgeSize()` for `+`/`-`; new `setSize()`
    (absolute, via `applyFontSize`) for `fs<n>`; `setColor()` for `fc <colour>` (hex/3-hex/named via
    `CSS.supports`); `setFont()` for `f <name>` (fuzzy match vs `FONTS`); file-input refs for `ii/iv/ia`;
    `setPublishOpen`/`handleExportPdf`/`handleExportMarkdown` for `eweb/epdf/emd`.
  - Codes (case-insensitive, whole-match so `b`≠`bd`, `e`≠`eweb`): `b i u`, `l e r`, `h1`–`h5`, `p`,
    `bd bn bc`, `+ - fs+ fs- fs<n>`, `f <name>`, `fc <colour>`, `ii iv ia`, `eweb epdf emd`.
  - UX: bottom-centre HUD pill shows the forming code + a "polo" confirmation flash (Marco→Polo); yolk ring
    on the editor while active. `tsc` + `eslint` clean. **Not yet verified in-browser; not committed.**
- **`GoMarcoIcon` added (`components/icons.tsx`).** Stroke-only zigzag glyph (sharp double-peak "M" for
  *M*arco) recreated from an owner-supplied hand-drawn Tironian-style stroke — SVG (not the raster
  screenshot) so it scales and inherits `currentColor`. Used as the mode's toolbar toggle + HUD glyph.
- **Headers & footers deferred (per owner).** Marked §14 + the §3 status row in `prd.md` as 🧊 **Deferred**
  (was "planned / next slice"). No code change — the reserved `documents.header`/`footer` jsonb columns keep
  it an additive future change.
- **PRD refresh — `prd.md` now matches shipped reality.** The living-PRD status table and sections had
  drifted (still showed editor/folders "in progress", publish "needs DNS", and had no sections for the
  features that shipped since). Updated: §2 tech stack (Next 16/React 19, fonts, jsPDF), §3 status table
  (rich text + fonts + colour + media + folders + exports + landing all ✅; added an architecture note that
  the from-scratch block model of vision §4.5 is **not pursued** — the HTML model is the shipped design),
  §4 (Google app published), §6 (slices 2–4: rich text, fonts incl. colour, media embeds), §7 (drag-and-drop
  + nesting + trash shipped), §9 (audio runtime-confirmed; ffmpeg-free video note), §11 (publish **fully
  live** — wildcard DNS done), §10 (open questions trimmed; export-doesn't-carry-inline-style noted), and
  **new sections §12 Export (PDF/Markdown), §13 Landing page, §14 Headers & footers (planned)**.
- **`.gitignore`** — added the locally-installed agent tooling dirs (`.agents/`, `.codex/`, `.impeccable/`,
  `.claude/skills/`) so they're never accidentally committed.
- **Font colour — per-selection text colour (feature branch `feat/font-color`).** New toolbar control to
  the right of the font-size stepper. Selection-based, same model as the font-family/size controls:
  styles the highlighted text, or (bare caret) starts a "type-ahead" colour run.
  - **Trigger:** a capital **A** banded red/green/blue via a hard-stop `background-clip:text` gradient (cut
    at asymmetric heights — 0/38/66% — so the bands read roughly even over the triangular glyph but aren't
    symmetric), with a thin underline bar showing the **active** colour (reflects `currentColor` at the caret).
  - **Panel — two tabs (`Choose` default, `Wheel`):**
    - **Choose:** a **10×10 swatch grid**. Row 0 = 10-step black→white greyscale; rows 1–9 = hue across the
      columns (0–324° in 36° steps), light→dark down the rows (HSL lightness 0.92→0.14). Plus a **Default
      colour** button that clears the inline colour. Click a swatch → apply + close.
    - **Wheel:** a large **circular HSV wheel** (240px) drawn on a `<canvas>` (hue = angle, saturation =
      radius, full value), a **brightness slider** applied as a CSS black-overlay (no per-frame redraw), a
      marker dot, a live **preview square**, an **Apply** button, and **HEX + R/G/B inputs** (typing any of
      them moves the wheel). Selecting Wheel also slides out an **Add** panel to its right (allowed to
      overlap). The main panel is a **fixed width** (`16.5rem`) so it grows vertically (taller wheel) rather
      than horizontally — the inputs row was previously stretching it too wide.
    - **Add panel (custom slots):** an **8×2 = 16-slot** grid. **Drag** the wheel's preview square into a
      slot to save it (HTML5 DnD, `text/color`); **left-click** a filled slot to apply; **right-click** a
      filled slot → a red **Delete**. Slots persist in **localStorage** (`tiro:custom-colors`), loaded via a
      lazy `useState` initializer (no SSR/hydration mismatch — the panel isn't rendered until opened).
  - **Selection preservation:** typing in the HEX/RGB inputs steals focus and collapses the editor
    selection, so the control **snapshots the selection range** when it opens (on the trigger's mousedown)
    and **restores it** right before calling `onPick`. Swatch/slot clicks `preventDefault` mousedown to keep
    the live selection anyway; the snapshot covers the input-driven path.
  - **Files:** `lib/inline-style.ts` (+`applyFontColor`, `startColorRun`, `currentColor`, `rgbToHex`; mirror
    the font-family fns — `<span style="color:…">`, ZWSP anchor stripped on save by the existing
    `​` strip). `app/doc/[docId]/font-color-control.tsx` (**new** — all colour maths + UI; client-only).
    `document-editor.tsx`: `ActiveMarks.color` + `EMPTY_ACTIVE` + `refreshActive` (`currentColor`), a
    `setColor` handler (selection→`applyFontColor`, caret→`startColorRun`), and `<FontColorControl>` rendered
    after the size stepper.
  - **Bugfix during build:** the right-click Delete menu showed but didn't fire — the outside-click handler
    called `setMenu(null)` on *every* mousedown, unmounting the menu before its own click. Fixed with a
    `menuRef` guard (a mousedown inside the menu is ignored by the outside-click logic).
  - **Verification:** `tsc --noEmit` + `eslint` clean, `next build` passes. Exercised end-to-end in a real
    browser (Playwright) via a temporary public `/colortest` harness (since the editor is auth-gated):
    confirmed the RGB-banded trigger, both tabs, the circular wheel + brightness + HEX/RGB inputs, the Add
    panel layout, **apply recolours text + updates the active bar**, **drag-to-slot saves + persists**,
    **right-click Delete clears + persists**, and **left-click slot applies** — no console errors. Harness +
    the temporary `proxy.ts` public-route entry were **removed/reverted** after verifying. **Not yet merged.**
  - **Known limitation (v1):** PDF/Markdown export don't yet special-case inline colour (PDF renders default
    ink; the colour `<span>` is just inert markup there — same status as inline font family/size).
- **Branding — phase 1: kill the "DeeScribe" name in forward-facing docs.** Settling the verbal identity
  (the product is **Tiro** everywhere user-facing; only stale spec docs still said DeeScribe). Renamed the
  product references in `prd.md` (title, overview, profile goal) and `prd-vision.md` (title, overview, the
  `--tiro-yolk` design-token name), and updated the four SQL migration comment headers
  (`0001`–`0004`, comment-only — no DB behavior change). Added a one-line **provenance note** to the top of
  `prd-vision.md` recording the 2026-06-16 DeeScribe→Tiro rename rather than erasing it. **`tracker.md` left
  untouched on purpose** — its historical changelog and the still-accurate Supabase project display name
  ("DeeScribe", pending dashboard rename) are intentional records, not name references to fix. Next:
  consolidate the verbal identity (tagline "Write with everything." + one-liner + voice guide) into a `brand.md`.

### 2026-06-23
- **Landing page de-misleading + scroll-driven SVG motion** (`/impeccable polish`, brand register). Two
  fixes, prompted by the owner: the page implied Tiro turns scribbles into text (it doesn't — it's a
  multimodal *text editor*), and it wanted ink animations that track scroll.
  - **Removed the misleading "Scribble becomes document" hero panel** (`components/landing/hero.tsx`): the
    rows where a squiggle "became" *Field notes / a voice memo / a photograph / a link* read as a
    handwriting/speech-to-text feature Tiro has never had. Replaced with an honest, abstracted
    mini-document — a heading + prose rules, a real image, a real audio waveform (yolk played-fraction),
    and a link card — captioned "One page, every medium." Hero subhead rewritten to "A text editor where
    the photograph, the voice memo, the video, and the link live *inside* the writing." Decorative ink
    underline/swash under "everything" kept (it's emphasis, not a feature claim).
  - **Scroll-driven ink** (`components/landing/ink-spine.tsx` + `reveal-manager.tsx` + `globals.css`): a
    fixed marginal pen-line SVG (`.ink-spine`, desktop ≥1080px only) that draws top→bottom in proportion
    to page scroll, and a section underline under "It all lives on **one page**" that scrubs as the
    heading crosses the viewport. `RevealManager` now also writes `--page-progress` (on `<html>`) and
    `--scrub` (per `[data-scrub]`) each frame via an rAF-throttled scroll handler; CSS maps them to
    `stroke-dashoffset` (`pathLength="1"`). Verified numerically: page-progress 0→0.5→1 drives spine
    dashoffset 0.985→0.5→0. Both gated behind `html.reveal-armed`, so no-JS / reduced-motion / crawlers
    get the finished, visible state and no half-drawn line.
  - **Removed orphaned CSS** (`.xform-row`, `.xform-caret`, `.caret-blink` + keyframe) left by the old
    hero panel. `tsc --noEmit` and `eslint` clean.
  - **PRODUCT.md:** replaced the "the scribble becomes text" design principle with "Say what it is: a
    multimodal text editor" (no capture-to-text conversion), and clarified that ink flourishes are
    decorative brand voice, not a feature signal.
- **Export to Markdown.** New `lib/export-markdown.ts` exports the document as a `.md` file. Modeled on
  `lib/export-pdf.ts`: clones the editor, strips runtime-only chrome (drag handles, `.is-selected`,
  still-loading media), then walks the DOM emitting Markdown instead of jsPDF primitives — so no
  layout/pagination math. Hand-written walker (no `turndown` dep) because it must understand the editor's
  custom nodes (figure `data-img`/`data-video`/`data-audio`/`data-link-card`, checklists via `data-checked`).
  Media degrades gracefully: image → `![caption](src)`, video/audio → link or italic placeholder, link-card →
  `[title](url)`. **Downloads** a file (vs PDF's new-tab) since Markdown isn't viewable and downloads dodge the
  popup blocker. Wired into `document-editor.tsx`: `handleExportMarkdown` callback + a third `MenuItem`
  ("Export to Markdown") in the ship dropdown, beside Export to PDF.
- **Simplified the ship/export logo.** `ShipIcon` (`components/icons.tsx`) reduced from 4 paths to 2 (mast +
  triangular sail, hull) — dropped the curved billowing sail and the 5-bump wavy waterline that read as noise
  at toolbar size.
- Branch: `feature/export-markdown` (merged to `main`).
- **Ship-menu polish (follow-up).** Fixed four issues from the first cut: (1) menu items no longer wrap —
  added `whitespace-nowrap` + `w-max` so "Export to Markdown" sits on one line; (2) confirmed all items are
  uniform `text-sm` (the apparent "smaller PDF" was just the wrap illusion); (3) renamed the published-state
  item "Published — manage…" → "Manage published page" (clearer, single line); (4) the ship button no longer
  turns dark/black when a doc is published — `active` is now `exporting` only (the yolk dot already signals
  published), so the dark fill means "menu open / exporting", not "published".

### 2026-06-22
- **Marketing landing page at `/` (logged-out).** Built Tiro's first real landing page via the `impeccable`
  design skill (register: brand). `app/page.tsx` now: signed-in → redirect `/workspace` (unchanged), else
  renders the new `<Landing/>`. Components live in **`components/landing/`** (`landing.tsx` composes them):
  `site-nav` (sticky, gains a border/blur on scroll), `hero`, `editor-mock`, `media-showcase`, `publish-band`,
  `audience-tabs`, `closing-cta`, `site-footer`, plus `reveal-manager` (scroll-reveal).
  - **Signature motif — scribble → text.** A hand-drawn SVG scribble draws on (CSS `stroke-dashoffset`,
    `pathLength=1`), a caret rides it, clean Fraunces type resolves in its wake. Anchors the hero, recurs as a
    deferred re-draw at the closing CTA. Ties to Tiro = Cicero's shorthand-inventing scribe. User-chosen
    direction; inspired structurally by wisprflow.ai's before/after hero.
  - **Identity preserved** (committed brand, per skill): paper/ink/egg-yolk + Fraunces/Hanken + grain. Pushed
    bolder than `/login` with a full-bleed **drenched-ink Publish band** and oversized type.
  - **Real product proof, not adjectives.** The "It all lives on one page" section + Media section reuse the
    editor's own `.doc-content` CSS verbatim (real audio waveform player, link-card unfurl, image figures), so
    mocks match the real editor. Three **verified** Unsplash images (HTTP 200-checked). The Publish band's
    browser mock continues the same "Iceland, day three" doc, now live at `leona.tiro.works`.
  - New CSS in `app/globals.css` (clearly-commented "LANDING PAGE" block): scribble/ink-in/swash/caret
    keyframes, a `reveal-armed` scroll-reveal system (content visible by default; only JS arms the hidden
    start state — no-JS/headless/reduced-motion all render visible), `.browser-mock`, `.link-underline`.
    Full `prefers-reduced-motion` fallbacks land every animation on its finished state.
  - Verified in-browser (Playwright) at 390 / 820 / 1440px; tab switching works; no console errors.
    `next build` + `tsc` pass. Also wrote root **`PRODUCT.md`** (impeccable project context). Not yet committed.
- **Publish moved into a toolbar "ship" dropdown (with Export to PDF).** Replaced the header Publish button
  *and* the standalone end-of-toolbar Export button with ONE `ToolbarMenu` at the toolbar's end: a new
  **`ShipIcon`** (a sailboat with its sail billowing rightward on a short waterline — "set the doc out into
  the world") opens a dropdown with two items — **Publish to web** (→ opens the publish dialog) and
  **Export to PDF**. A small yolk dot sits on the ship when the doc is currently published.
  - `PublishPanel` (header popover) → refactored into a **controlled `PublishDialog`** (centered modal,
    backdrop/Escape to close) in `app/doc/[docId]/publish-panel.tsx`. The editor now owns the publish `state`
    (`useState(initialPublish)`) + an `open` flag and passes them down, so the toolbar can show the live dot.
    Same publish/copy/open/update/unpublish actions as before.
  - `components/icons.tsx`: added `ShipIcon` (stroke-only, 24×24, matches the set). Old `ExportIcon` left
    defined but unused. Verified the ship renders cleanly at 24px via a screenshot harness.
  - `tsc` + `eslint` clean, `next build` passes. (Not yet committed/pushed.)
- **Bugfix — audio playback surfaced a scary "Runtime NotSupportedError" overlay + swallowed insert errors.**
  Audio's first real runtime test (it was previously gate-only). Two fixes in `document-editor.tsx` +
  `app/p/[slug]/published-document.tsx`:
  - **Unhandled `play()` rejection.** The play button did `void audioEl.play()`; when a source can't be
    loaded/decoded, `play()` **rejects** with `NotSupportedError: The element has no supported sources`, and
    because it was unhandled it surfaced as Next's red runtime overlay. Now wrapped in `.catch()` — the editor
    shows a friendly dismissible notice ("This audio can't be played — its file may be missing or in an
    unsupported format."), the public page swallows it silently.
  - **Audio insert errors were hidden.** `useAudioInsert`'s `onError` was `() => setSave("error")` (just the
    misleading "Save failed" badge, real message lost to the console) — the same anti-pattern already fixed
    for video. Now routes through `showNotice("error", err.message)` like video, so decode/upload failures say
    *why*. (User confirmed audio working after these.) `tsc` clean.
- **Publish-to-Web — published documents are public at `<slug>.tiro.works`** (no login to view). One
  sharing mode: anyone with the link can view. Built end-to-end; **migration 0006 APPLIED to remote
  (2026-06-22)**; **wildcard DNS / Vercel domain not yet configured** (the remaining user dashboard step — see below).
  - **Model — snapshot, not live.** Publishing copies the doc's current title + content HTML into a new
    public table `public.published_pages` (keyed by a readable `slug`). Editing the doc does **not** change
    the public page until the owner clicks **Update published version** (re-publish overwrites the snapshot,
    keeps the same slug). **Unpublish** deletes the row → the subdomain 404s. Decision (with user): snapshot
    over live, and **auto-generated readable slug** now (`quiet-river-4821`), custom subdomains deferred.
  - **Why a separate table** (not an anon RLS policy on `documents`): the private `documents` table stays
    fully owner-only — never widened to `anon`. `published_pages` is the *only* anon-readable surface and is
    a minimal projection (slug/title/content snapshot). Media already lives in public-read buckets, so embeds
    (image/video/audio/link-card) just work for logged-out visitors with no extra policy.
  - **Migration `supabase/migrations/0006_create_published_pages.sql`** (written, **NOT yet applied**):
    `published_pages` (slug PK, document_id unique FK→documents ON DELETE CASCADE, owner_id, title, content
    jsonb snapshot, timestamps). RLS: **public SELECT `using (true)`** (the point — anyone can read a
    published page); INSERT/UPDATE/DELETE owner-only (`owner_id = auth.uid()`, insert also `EXISTS` the
    document is theirs). Apply via `supabase db query --linked -f supabase/migrations/0006_create_published_pages.sql`
    or paste into the dashboard SQL editor. Safe to re-run.
  - **Subdomain routing in `proxy.ts`:** new `publishedSlug(hostname)` matches `<slug>.tiro.works` (and
    `<slug>.localhost` for dev), excluding `www`/apex. On a match the proxy **rewrites to `/p/<slug>`** and
    returns immediately — skipping the auth gate (published pages are public, no `getUser()` needed). Browser
    URL stays the subdomain. Apex/`www`/`*.vercel.app` are unaffected. Asset requests (`/_next/static`, images)
    are already excluded by the matcher, so they load normally on the subdomain host.
  - **Public route `app/p/[slug]/`** (already public in `PUBLIC_ROUTES`): `page.tsx` (server) reads
    `published_pages` by slug via the anon server client (RLS allows), `notFound()` → friendly `not-found.tsx`
    if missing/unpublished; `generateMetadata` sets title + a tag-stripped excerpt for link previews.
    `published-document.tsx` (client) renders the snapshot HTML read-only inside `.doc-content` and
    **re-creates only embed interactivity** — the custom audio player (capture-phase listeners + click
    play/seek, same logic as the editor) and link-card open/play. No toolbar, no editing, no saving.
    Reachable two ways: `<slug>.tiro.works` (via rewrite) **and** `tiro.works/p/<slug>` (direct).
  - **Sanitization at publish:** `sanitizeHtml` in `lib/publish-actions.ts` strips `<script>`, inline
    `on*=` handlers, and `javascript:` URLs before the snapshot is stored (the HTML now renders to the public
    via `dangerouslySetInnerHTML`). Belt-and-suspenders — editor paste is already plain-text-stripped. Noted
    limitation: regex strip, not a full parser; swap for DOMPurify if untrusted HTML is ever ingested elsewhere.
  - **Editor integration:** new `lib/publish-actions.ts` (`publishDocument` upsert-by-document_id keeping the
    slug on re-publish, `unpublishDocument`, slug generation w/ DB uniqueness check). New
    `app/doc/[docId]/publish-panel.tsx` — a **Publish** popover in the editor header (next to Delete): publish,
    copy link, open, update, unpublish; shows a yolk "Published" badge when live. `document-editor.tsx` gained
    an `initialPublish` prop; `app/doc/[docId]/page.tsx` loads the doc's `published_pages` row and passes it so
    the panel opens in the right state. The public URL is built from `window.location` (prod → `<slug>.tiro.works`,
    dev → `<slug>.localhost:<port>`).
  - **Verified:** `tsc --noEmit` clean, `eslint` clean, **`next build` passes** (`/p/[slug]` registered as a
    dynamic route; proxy compiles). **Not yet runtime-tested** — requires (1) migration 0006 applied, and
    (2) wildcard DNS+domain (below). Until the wildcard domain exists, a published doc is still viewable at
    the path form `tiro.works/p/<slug>` (the subdomain just won't resolve yet).
  - **✅ Wildcard subdomains LIVE (2026-06-22).** Verified `https://scarlet-river-3638.tiro.works/` →
    HTTP 200, valid SSL, serves the published doc (title "Features · Tiro"), no login redirect; apex
    `tiro.works` still resolves (main site intact). What it took:
    1. Added domain **`*.tiro.works`** to the Vercel project. Vercel flagged it "Invalid Configuration"
       because **wildcard SSL requires Vercel to control DNS** (no CNAME-only path for wildcards — Let's
       Encrypt wildcard certs need the DNS-01 challenge, which Vercel can only do via its own nameservers).
    2. **Moved `tiro.works` nameservers GoDaddy → Vercel** (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`).
       DNS for the domain is now managed by Vercel (it auto-recreated apex + `www`). After propagation the
       wildcard went Valid and SSL issued automatically.
    NOTE for future DNS changes: records now live in **Vercel DNS**, not GoDaddy (GoDaddy still holds the
    registration). No custom email/MX on the domain, so nothing was lost in the move.

### 2026-06-21
- **Moved all editor formatting shortcuts to Ctrl** (one consistent modifier) in
  `app/doc/[docId]/document-editor.tsx` (`onEditorKeyDown`). Alignment is now **Ctrl+L/R/E**, inline
  marks are **Ctrl+B/U/I**, and the browser's native **Cmd+B/I/U** are `preventDefault`-ed so they no
  longer format. This frees every **Cmd** combo for the browser (Cmd+R reload, Cmd+L address bar, …).
  Trade-off accepted: taking over Ctrl shadows macOS's Ctrl+E/Ctrl+B line-navigation inside the editor.
  (Supersedes the earlier "only Cmd+R passes through" approach — the mixed Cmd/Ctrl behaviour was
  confusing.)
- **Shipped the checklist fix + ffmpeg-free video to production.** Committed the 2026-06-20 work as
  **`441bbac`** ("Fix checklist conversion + make video ffmpeg-free"), pushed to GitHub `main`, and
  **verified the live deploy**: Vercel build `dpl_CUauW9c7…` reached state **`READY`** (~44 s build),
  commit author correctly recorded as **Prakhar Khandelwal** (so not `BLOCKED`), aliases `tiro.works` +
  `www.tiro.works` point at it, and `https://tiro.works` returns `307` (the normal redirect to login for
  an unauthenticated request). No code change — release + verification only. All `HANDOFF-*.md` deleted;
  working tree clean.

### 2026-06-20
- **Bugfix — checklist deleted the selected lines instead of converting them.** Selecting several lines
  and clicking Checklist wiped them and left one empty box with a glitched caret. Root cause: `insertChecklist`
  built a fresh empty `<ul><li>` and called `insertNodeAtCaret`, which does `range.deleteContents()` first —
  so a multi-line selection was deleted and replaced by the empty list. Checklist now **converts** the
  selection like the bullet button does: `execCommand("insertUnorderedList")` (the browser handles multi-line
  selection, block splitting, and caret placement), then it tags the new list `data-checklist` and gives each
  `<li>` a non-editable `[data-check]` box. Added: (1) **toggle behaviour** — clicking on an existing checklist
  turns it back into paragraphs; clicking on a plain bullet list converts it to a checklist in place; (2) an
  **`unwrap` step** because Chromium can leave the new `<ul>` wrapped in a `<p>` (invalid `<ul>`-in-`<p>` → on
  reload the browser splits it, leaving a stray empty line above the list — the artifact visible in the bug
  screenshot). `tsc` + `eslint` clean. **Verified in a real-browser harness** (Playwright): 3 paragraphs →
  3 checklist items with text preserved + clean top-level `<ul>` (no `<p>` wrapper); toggle-off restores the
  lines with no orphan boxes; bullet list → checklist decorates in place. NOTE: docs already corrupted by the
  old behaviour aren't auto-repaired — delete the stray box and re-apply.
- **Video goes ffmpeg-free — production-safe, matching the audio model.** Removed the server-side
  transcode that was the Vercel serverless liability (a long `preset slow` ffmpeg encode runs past the
  function's execution limit and gets killed mid-flight → the upload silently vanishes + leaks a `-raw`
  orphan). It "worked on the live site" only because test clips were short enough to finish under the
  timeout — a ceiling, not a wall. **Now there is no server compute to time out.**
  - **Deleted:** `lib/video-actions.ts` (the `"use server"` ffmpeg transcode), `lib/vendor.d.ts` (its
    ffprobe ambient type), the `ffmpeg-static` + `ffprobe-static` deps, and `serverExternalPackages` from
    `next.config.ts`.
  - **New `lib/video-prepare.ts`** (client-only, mirrors `lib/audio-prepare.ts`): loads the file into a
    detached `<video>`, validates **≤60 s** (same cap as audio) and **≤200 MB**, captures a **poster frame**
    via `<canvas>` (seek ~1 s in, JPEG), and emits a best-effort **HEVC warning** (Safari can play `hvc1` +
    a `.mov`/quicktime file → likely HEVC → won't play in Chrome/Firefox). Rejects undecodable files with a
    clear message.
  - **`lib/use-video-insert.ts` rewritten:** no `compressVideo` call. Uploads the **original file as-is** to
    `‹uid›/‹docId›/‹id›.‹ext›` + the poster to `‹id›.jpg`, then swaps in `<video controls poster>`. Poster is
    optional (insert still succeeds without one). Same `knownVideoPaths` / orphan-sweep seams as before
    (`data-path` + `data-poster-path` both tracked) so cleanup is unchanged. Added an `onWarn` callback.
  - **Editor (`document-editor.tsx`):** new transient **notice banner** (under the header) so media
    validation errors and the HEVC warning say *why* (the old `onError` only flipped the save badge to
    "Save failed", which was misleading). `showNotice(kind,text)` auto-dismisses after 7 s; video `onError`
    now surfaces the real message and `onWarn` shows the amber HEVC caveat.
  - **Trade-off (documented decision):** no compression — a raw phone clip stays large (bounded by the
    200 MB cap + the 60 s cap); and HEVC clips may be black boxes for non-Safari viewers (warned, not
    blocked — outright rejecting iPhone uploads felt too hostile). If universal playback ever matters more
    than the serverless-free simplicity, the proper fix is an off-Vercel transcode service (Mux/Cloudinary),
    not bringing ffmpeg back into the function.
  - **Verified:** `tsc --noEmit` clean, `eslint` clean, **`next build` passes** (nothing references the
    deleted server action). Interactive insert not yet runtime-tested in-app (auth-gated) — but there's no
    server path left to fail.
- **Bugfix — first typed line in a new doc had wrong spacing.** A brand-new doc seeded the editor
  with `""`, so the **first line you typed went in as a bare text node** (no `<p>` wrapper); only after
  pressing Enter did the browser start emitting real `<p>` blocks (`defaultParagraphSeparator="p"`).
  Since only `<p>` carries the `.doc-content p` bottom margin, the first line hugged the second while
  every later line got the paragraph gap. **Fix (2 coordinated changes):** (1) seed empty docs with
  `<p><br></p>` instead of `""` (`document-editor.tsx` mount) so the first line is a real paragraph;
  (2) move the "Start writing…" placeholder onto that seeded paragraph in `globals.css`. The old rule
  hung the placeholder on the `.doc-content` container (`:empty::before`); with the seed the caret now
  lives inside a `<p>`, so a container `::before` got pushed onto its own line *above* the caret. Fix:
  add `.doc-content > p:only-child:has(> br:only-child)::before { content: "Start writing…" }` so the
  placeholder flows inline on the paragraph, on the caret's line (literal string because `attr()` can't
  read the container's `data-placeholder` from the `<p>`). Kept `:empty::before` for the truly-empty case.
  Follow-up: the inline `::before` occupied real space, so the browser drew the **caret after** the
  placeholder text (you had to backspace to reach the start). Made the paragraph `position: relative`
  and the placeholder `position: absolute; top/left: 0` so it's a paint-only overlay with no inline
  footprint — caret now sits at the true start (left of the "S"), like a normal input placeholder.
  Existing docs unaffected (they already have `<p>` content); seeding on mount doesn't trigger a save.
  Verified in a browser harness: typing `word 0`⏎`word 1 word 2`⏎`line 1` yields three uniform `<p>`
  blocks; placeholder renders on the caret's line and clears on the first keystroke.
- **Font editing — per-selection font family + size (feature branch `feat/font-editing`).**
  New left-most toolbar controls: a **font-family dropdown** and a **size stepper** (`−` / number / `+`,
  ±1). Both are **selection-based** (Word/Google-Docs model) — they style the highlighted text, not the
  whole document. A bare caret is a no-op (acts on a selection only).
  - **Why a custom primitive (`lib/inline-style.ts`):** `execCommand` can't do this directly —
    `fontSize` only accepts the legacy **1–7** scale (not `18px`) and `fontName` mangles custom
    `var(--font-*)` family values. Approach: use `execCommand("fontSize","7")` purely as a **marker** to
    let the browser wrap exactly the selection (it handles all multi-node/block boundary math), then
    **rewrite each `<font size="7">` into a `<span>`** carrying the real inline style we want. One
    primitive (`styleSelection`) powers both family and size. On each apply we **strip the same property
    from descendant spans** (and unwrap now-empty spans) so repeated nudges don't stack `<span>`s, and we
    **re-select the rewritten range** so the user can keep nudging without re-highlighting.
  - **Size scale (decision):** the toolbar shows an abstract Word-style number; **body default = 11**,
    anchored to the current `.doc-content` size (**1.125rem = 18px**) so existing docs don't visually
    jump. `sizeToPx`/`pxToSize` convert (each ±1 step ≈ 1.64px); clamped to **6–96**. The displayed
    number reflects the **computed** font-size at the caret (so headings read larger, etc.).
  - **Fonts loaded:** added **Lora, Source Serif 4, Inter, JetBrains Mono** via `next/font/google` in
    `app/layout.tsx` (CSS vars `--font-lora`, `--font-source-serif`, `--font-inter`, `--font-jetbrains`),
    joining the existing Fraunces/Hanken. Catalogue (`FONTS` in `lib/inline-style.ts`) also offers
    **Default** (inherit), Fraunces, Hanken Grotesk, and the **system fonts** (no load, fallback stacks):
    **Georgia, Times New Roman, Arial, Calibri, Helvetica** — 12 options total. Inline family values
    reference the `var(--font-*)` so no `<font>`/var mangling. (Calibri isn't on macOS → degrades to
    Segoe UI/sans-serif there.)
  - **Toolbar reflection:** `ActiveMarks` gained `fontId` + `fontSize`; `refreshActive` reads them
    (`currentFontId` matches the nearest inline family against the catalogue → `default`/`custom`;
    `currentSize` maps computed px → label) so the dropdown trigger shows the selection's font and the
    stepper shows its size. Saved HTML needs no changes — the spans persist via the existing serialize.
  - **Files:** `lib/inline-style.ts` (new), `app/layout.tsx` (4 fonts + html vars),
    `app/doc/[docId]/document-editor.tsx` (imports, `ActiveMarks`/`EMPTY_ACTIVE`, `refreshActive`,
    `setFont`/`nudgeSize` handlers, font menu + size stepper at the toolbar's left edge before Bold).
  - **Verification:** `tsc --noEmit` clean; **`next build` passes** (all four Google fonts resolved &
    self-hosted). Font family + the 4 added fonts confirmed working in-browser. Not yet merged to `main`.
  - **Bugfix (post-test, 2026-06-20):** the size stepper appeared frozen at 11 and couldn't step past one
    increment, and the font dropdown silently reverted to "Default" after each apply. Root cause: after
    applying a style we re-select the new span with `range.setStartBefore(span)`, so the selection's
    boundary `startContainer` is the *container* (doc-default font), not the styled span — and both
    `currentSize`/`currentFontId` read that container. Since `nudgeSize` bases the next size on
    `currentSize + delta`, it recomputed `11 + 1 = 12` every click → stuck. Fix: a `selectionElement()`
    helper that descends into `startContainer.childNodes[startOffset]` to read the actual styled element.
    Verified in a standalone Playwright harness: stepping now climbs 11→12→13→14→15 and back, leaving a
    single clean `<span>` (no nesting).
  - **Known limitations (v1):** collapsed-caret changes are no-ops (selection required); selecting the
    **Default** font leaves an empty wrapper span (harmless, no visual effect); PDF export
    (`lib/export-pdf.ts`) doesn't yet honor inline font family/size.

### 2026-06-17
- **Export to PDF — opens in a new browser tab, never downloads (feature branch `feat/export-pdf`).**
  New toolbar action that renders the current document to a PDF and opens it in a **new tab** for viewing
  (the user downloads it from the browser's built-in PDF viewer if they want — we never force a download).
  - **Library/approach (locked in):** **`jsPDF` (v4.2.1)** with a **hand-written DOM-walking renderer**
    (`lib/export-pdf.ts`), NOT html2canvas / a headless browser. Reasons: (1) the renderer emits **real,
    selectable text** with the paper/ink look (not a blurry raster), (2) it produces **small** files, (3) it
    **sidesteps html2canvas's cross-origin canvas-taint** problems with Supabase public image URLs, and (4)
    **no serverless headless-Chromium** to host. Images are brought in CORS-safely the same way the editor's
    crop does it: `fetch()` the bytes → object URL → `<img>` → `<canvas>` → JPEG data URL → `addImage`
    (so the canvas is never tainted, and webp is rasterised to a format jsPDF definitely accepts). jsPDF is
    **dynamically imported** so it only loads when the user actually exports.
  - **New-tab, no-download mechanics:** the PDF is emitted as an `application/pdf` **Blob object URL**
    (`doc.output("bloburl")`). The click handler opens a blank tab **synchronously** (inside the gesture, so
    the pop-up blocker allows it; it shows a "Generating your PDF…" splash) and then points that tab at the
    blob URL. Result: the browser's native PDF viewer renders it in a new tab; no `Content-Disposition`
    attachment, no save dialog.
  - **Fidelity (verified):** document **title** (serif, with a short yolk accent rule), **headings H1–H5**
    (serif), body text, **bold / italic / underline** (incl. bold-italic and styled mid-word runs kept
    glued), **bulleted / numbered / checklist** lists (checklist draws a real checkbox + a yolk tick for
    `[data-checked]`; lists hang-indent so wrapped lines align under the text), **images** (honoring the
    figure's width-% + `data-align` + non-destructive flips/filters), figure **captions**, and the warm
    **paper background / ink text** palette throughout. Custom line-breaker does word-wrap + alignment +
    automatic **page breaks** (multi-page docs paginate correctly; each new page is repainted paper).
  - **Graceful media degradation (never throws):** **video** → its poster frame + a "▶ Video" tag, or a
    `[video]` placeholder box if no poster; **audio** (no poster possible) → a "♪ [audio]" chip; **link
    cards** → thumbnail + title + the URL. Broken image/poster fetches fall back to a labeled placeholder
    rather than crashing the export. The save-pipeline strip is mirrored: drag handles, selection rings, and
    still-loading `[data-status]` placeholders are removed from a clone before rendering.
  - **Files:** `lib/export-pdf.ts` (new — `buildDocumentPdf` returns the jsPDF doc; `exportDocumentToPdf`
    builds + opens the tab; split so future download/publish paths can reuse the builder). `components/icons.tsx`
    `ExportIcon` (page-with-arrow, stroke-only/currentColor, matching the icon set). `document-editor.tsx`:
    `handleExportPdf` + an `exporting` busy state + an **Export** button after a divider at the end of the
    sticky toolbar (reuses `toolbarBtnClass`; lights up while generating). `jspdf` added to `package.json`.
  - **Verification:** `tsc --noEmit` + `eslint` clean; `next build` passes. Exporter exercised end-to-end via
    Playwright against a temporary public `/pdf-test` harness (since the editor is auth-gated) using a
    representative document (every heading/mark/list type, an image, plus video/audio/link-card) — confirmed
    a faithful multi-page PDF, all media-degradation paths render, and **"Open in new tab" lands on a
    `blob:` URL in a second tab (a viewer, not a download)**. The harness + a temporary `proxy.ts` public-route
    entry were **removed/reverted** after verifying (not committed).
  - **Untested-due-to-auth (low risk):** the Export button rendering **inside the real logged-in editor**
    (its markup reuses existing toolbar patterns and the build passes, but it wasn't clicked in-app). Manual
    check after login: open a real doc, click Export, confirm a new tab opens with the doc as a PDF and that
    real Supabase-hosted images/posters appear (they're public-read, fetched CORS-safely — should be fine).
  - **Possible follow-ups (not done):** turn the single Export button into an **Export** dropdown when
    Markdown / Publish-to-Web land (the roadmap item below); embed the real Fraunces/Hanken fonts via
    `addFont` for exact type matching (currently times/helvetica stand-ins); clickable link annotations on
    link-card URLs.
- **Media drag (video/audio/link-card) + unified Insert dropdown + new video icon.** Three editor tweaks:
  - **X-drag for video / audio / link-card embeds** (mirrors the image pointer-drag). Images are grabbed
    directly (whole image is the surface); these three carry interactive controls (native `<video>`, the
    audio play button + waveform seek, the link-card click-to-open/play), so a body-grab would hijack them.
    Chosen approach: a **small hover drag handle** (top-left; **top-right for audio** so it clears the
    left-anchored play button). The handle is **runtime-only chrome** — a `MutationObserver` on the editor
    adds one to every such figure as it appears (insert/paste/drop/undo, incl. the placeholder→real swap),
    and the save clone **strips `[data-drag-handle]`** so it never persists. Dragging the handle runs the
    same generalized `translateX` logic (clamped to the editor column, stored as inline transform +
    `data-x`); on drop it re-selects the figure so the floating image/video toolbar re-measures at the new
    spot (audio/link-card have no toolbar). `onEditorClick` now early-returns on a handle click so a no-move
    click can't trigger link-open / audio / select. CSS handle styles + `position: relative` on the three
    figure types in `globals.css` (handle shows on figure hover / while dragging; "↔" glyph signals the
    horizontal-only move).
  - **Insert dropdown.** The three separate Image / Video / Audio toolbar buttons collapsed into ONE
    **Insert** `ToolbarMenu` (reuses the existing `ToolbarMenu`/`MenuItem` pattern; new `PlusIcon` trigger).
    Each item fires the matching hidden file input (`fileInputRef`/`videoInputRef`/`audioInputRef`, kept as
    is); the trigger highlights while any insert is in flight and the busy item shows "Adding…".
  - **VideoFrameIcon redesigned** — the old framed play-triangle read like the YouTube logo. Now a
    **clapperboard** (hinged striped bar + slate body), stroke-only / currentColor / 24×24, consistent with
    `ImageFrameIcon`/`AudioFrameIcon`. Verified visually via a standalone render (distinct, clean).
  - `tsc --noEmit` + `eslint` clean; dev server compiles and serves. **Interactive drag/insert not yet
    runtime-tested in-app** (editor is auth-gated — needs a login + real media). Icon confirmed by render.
- **Backspace-delete made undoable.** Initial version used `prev.remove()` (raw Node API) → bypassed the
  contenteditable editing surface, so Cmd/Ctrl+Z couldn't restore it (whereas inserts, which go through
  `range.insertNode`/`execCommand`, ARE tracked by the native undo stack). Fix: the Backspace handler now
  selects the figure (`range.selectNode`) and calls `document.execCommand("delete")` — same editing
  pipeline as inserts, so it lands on the undo stack and Cmd+Z brings the embed back. **Caveat:** the
  file is swept from storage on the next autosave (~1s), so undo fully works only before that sweep;
  undo after a save would restore a figure whose file is gone (404). Bulletproof undo needs deferred
  storage cleanup (a soft media-trash) — noted as a follow-up. `tsc`+`eslint` clean.
- **Backspace deletes a media embed.** Caret at the start of a block + Backspace now removes an
  `figure[data-audio|data-video|data-img]` sitting immediately before it (atomic non-editable blocks
  that browsers won't reliably delete on their own). Added one branch in `onEditorKeyDown`: climb to the
  caret's editor-child block, confirm the caret is at its start (no text before it), and if the previous
  element is a media figure, delete it via the editing pipeline + `scheduleSave()` (the save orphan-sweep
  then deletes the file from storage). Also clears any figure selection. `tsc`+`eslint` clean. Gives audio
  a delete path (it has no contextual toolbar) and a keyboard delete for image/video too.
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
