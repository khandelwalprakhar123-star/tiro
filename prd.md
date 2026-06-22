# DeeScribe — Living PRD

> **How to use this document.** This is a *living* PRD, not a final spec. It starts small and grows
> one feature at a time. As we design and ship each feature, we add its section here with just enough
> detail to build and verify it. We do **not** try to specify everything up front.
>
> **Evolution rule:** every time we start a new feature, append/update its section in this file before
> writing code, and update the **Status** table below. When the product feels complete, we freeze this
> file — at that point it becomes the full, authoritative scope for the project.
>
> The original comprehensive vision lives in `prd-vision.md` as a reference target. This `prd.md` is the
> source of truth for *what we have actually decided and built so far.*

---

## 1. What we're building (one paragraph)

DeeScribe is a web-based, multimodal document editor — "Google Docs with first-class media embeds."
Users write rich documents (text, images, links, audio, video), organize them into folders, and export
or publish them. Built on Next.js (App Router) + Supabase + Vercel + Tailwind.

---

## 2. Tech stack (as committed so far)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Auth + DB + Storage | Supabase |
| Styling | Tailwind CSS |
| Hosting | Vercel |

We add rows/details here as we adopt them. Nothing is locked beyond what we've actually used.

---

## 3. Feature status

| Feature | Status | Section |
|---|---|---|
| Authentication (Email OTP + Google) | ✅ Done | §4 |
| Profile (avatar, display name, status, photo viewer) | ✅ Done | §5 |
| Documents — create/edit/delete | ✅ Done | §6 |
| Editor — rich text (bold/italic/underline, H1–5, bullets) | 🔨 In progress | §6 |
| Editor — block model + media embeds (from scratch) | 🧊 Planned | §6 |
| Folders / organise (many-to-many) | 🔨 In progress | §7 |
| Trash — restore / permanent delete | ✅ Done | §8 |
| Audio embeds + custom player (real waveform) | ✅ Done (volume deferred; runtime test pending) | §9 |
| Publish to web (`<slug>.tiro.works`, public, no login) | ✅ Done (needs migration applied + wildcard DNS) | §11 |

Legend: 🔨 in progress · ✅ done · 🧊 planned · ❌ dropped

---

## 4. Authentication ✅

**Goal:** let a user sign in two ways:
1. **Email OTP** — user enters their email, gets a 6-digit code, enters it to log in. (No password.)
2. **Google** — one-click "Continue with Google" (OAuth).

**Decisions so far**
- Sessions are **cookie-based** via `@supabase/ssr`, so the server always knows who's logged in.
- On first login, a `profiles` row is created for the user (display name / avatar later).
- Protected routes redirect to the login page when there's no session.

**Acceptance criteria**
- AC1: A new user can sign in with email OTP and is logged in afterward.
- AC2: A user can sign in with Google and is logged in afterward.
- AC3: The session survives a page reload.
- AC4: Logging out clears the session and redirects to login.

**Status:** ✅ Both flows work end-to-end. Email OTP via Resend SMTP; Google OAuth via a Google Cloud
OAuth client wired into Supabase. (Google app still in "Testing" mode — publish before public launch.)

---

## 5. Profile ✅

**Goal:** let a logged-in user manage how they appear across DeeScribe
**What it does**
- Edit **display name** and **status** (short tagline); upload a **profile picture** (avatar).
- Avatar is stored in the Supabase `avatars` storage bucket; the rest lives in the `profiles` table row.
- **Photo viewer:** clicking the avatar (or a "View photo" button) opens the picture enlarged in a
  circular frame over a transparent overlay. It can be **dragged around like a macOS window**, and closes
  on any outside click or Escape.

**Decisions so far**
- Save is **client-side** (browser Supabase client); RLS guarantees a user can only read/write their own
  profile row and only upload to their own `‹uid›/…` folder in storage.
- A `profiles` row is auto-created on first login (DB trigger), so the page always has a row to edit.

**Acceptance criteria**
- AC1: A user can upload an avatar and it persists across reload.
- AC2: A user can edit display name + status and the changes save.
- AC3: The photo viewer opens, is draggable, and closes on outside-click / Escape.

---

## 6. Documents 🔨

**Goal:** create, edit, organise, and delete documents (`prd-vision.md` §2). Being built in slices.

**Slice 1 — skeleton (current):** lifecycle plumbing with a plain-textarea editor.
- `documents` table (migration `supabase/migrations/0001_create_documents.sql`, RLS owner-only). `content`
  is `jsonb` (holds `{"plain": "..."}` for now; becomes the block model in slice 2).
- Workspace lists your live docs (newest first) + a **New document** button (Server Action → insert → redirect).
- `/doc/[docId]` editor: rename (title), edit body, **debounced autosave (~1s)** with Saving/Saved state,
  **soft delete** (sets `deleted_at` → leaves all views; trash UI later).

**Acceptance criteria (slice 1)**
- AC1: Create a new doc → opens at `/doc/[id]`.
- AC2: Title + body changes autosave and persist across reload.
- AC3: Workspace lists all live docs and links to each.
- AC4: Delete moves the doc to trash (disappears from the list; row kept via `deleted_at`).

**Slice 2 — rich text formatting (current):** the body is now a `contenteditable` region with a sticky
toolbar. Supported: **bold, italic, underline** (apply to the text selection), **headings H1–H5** and
**bullets** (apply to the cursor's block; clicking the active heading again returns to normal text).
- Implemented with the browser's `execCommand` as a *mutation convenience only* — the saved HTML is the
  source of truth (spec §4.5 permits this). Paste is stripped to plain text (safe; no raw HTML injected).
- Storage shape changed: `content` is now `{ version: 2, html }`. Old `{ plain }` docs auto-convert to
  paragraphs on open.

**Next slices:** full block model + media embeds (§4.5) · folders + reference copies (§4.1) · trash
view/restore.

---

## 7. Folders / organise 🔨

**Goal:** organise documents into folders (`prd-vision.md` §4.1). A document can live in **many** folders
at once and is still one underlying record — edits propagate everywhere; "filing" never duplicates.

**Model:** `folders` table + `document_folders` join table (many-to-many), RLS owner-only (a link is yours
only if you own both the document and the folder). Migration `supabase/migrations/0002_create_folders.sql`.

**What works**
- Workspace shows a **Folders** grid (distinct folder-tab icon, same card language as docs) above **All
  documents**, plus a **New folder** button.
- Folder card → `/folders/[folderId]`: lists that folder's docs, inline-rename the folder, delete folder
  (soft delete; docs inside are kept), and **New document** (created already filed into the folder).
- Each doc card has a ⋯ menu: **Add to / remove from folders** (multi-select toggle), **Remove from this
  folder** (in folder view), and **Delete** (soft delete).

**Acceptance criteria**
- AC1: Create/rename/delete folders.
- AC2: Add a document to multiple folders; it appears in each.
- AC3: Removing a doc from one folder doesn't delete it or affect other folders.
- AC4: Deleting a folder keeps its documents (they remain under All documents / other folders).

**Not yet:** nested folders (column exists, no UI) · drag-and-drop · trash view for restoring deleted
folders/docs.

---

## 8. Trash ✅

**Goal:** make delete safe and reversible. Deleting a doc or folder is a **soft delete** (sets
`deleted_at`); the Trash is where those live until you restore or permanently remove them.

**What it does**
- `/trash` (linked from the workspace header) lists all soft-deleted **folders** and **documents** (newest
  deletion first) — the mirror of every other view, which filters `deleted_at IS NULL`.
- Per item: **Restore** (clears `deleted_at` → reappears in the workspace and in any folders it was still
  linked to) and **Delete forever** (hard `DELETE`; doc↔folder links cascade away).
- **Empty trash** permanently removes everything in the trash at once.

**Acceptance criteria**
- AC1: Deleting a doc/folder makes it appear in `/trash` and disappear from the workspace.
- AC2: Restore brings the item back exactly where it was (folder memberships intact).
- AC3: Delete forever / Empty trash permanently removes the row(s); they don't return on reload.

**Known limitation:** permanently deleting a folder with *nested* subfolders also deletes those subfolders
(`parent_id on delete cascade`). Acceptable until nested folders get a full UI.

---

## 9. Audio embeds + custom player 🔨

**Goal:** let a doc embed an audio file, played back with a custom player (not the raw
browser `<audio controls>`), styled with the yolk accent — matching `prd-vision.md` §9.1/§9.3.

**Deviation from `prd-vision.md` §9.1 (recorded deliberately).** The vision spec says the
waveform must be **decorative** ("do not analyze or measure real audio amplitude… purely
visual"). We are instead building a **real waveform** (WhatsApp-style: bar heights reflect the
actual audio amplitude envelope), because it's better UX at near-zero extra cost. `prd-vision.md`
is left unedited (it's the frozen reference); this living PRD overrides it for the audio feature.

**Resource decision (chosen for least compute / fastest / least bandwidth).** Compute the
waveform peaks **once, in the uploader's browser, at insert time** — exactly how WhatsApp does it
(the sender's device computes it). NOT server-side ffmpeg (would spend serverless compute we pay
for), and NOT client-decode-on-every-view (would re-decode + re-download the whole file each load).
- On insert: `file.arrayBuffer()` → `AudioContext.decodeAudioData()` → bucket the samples into
  ~50 bars → take each bucket's peak → normalise to small ints (0–100).
- Store the bars **on the figure as a data attribute** — `data-peaks="3,7,12,40,…"` — inside the
  existing `{version:2, html}` content model. ~50 ints ≈ a few hundred bytes. **No schema change.**
- Every viewer renders bars instantly from `data-peaks`; the `<audio>` element only streams bytes
  when the user hits play. Per-view compute ≈ drawing rectangles. Server compute = zero.
- Tradeoff accepted: a very long upload decodes the whole file once in the uploader's browser. Fine
  for typical clips; a server-side fallback for huge files is a deferred, additive change behind the
  same `data-peaks` renderer.

**Storage:** new public-read `doc-audio` bucket (`supabase/migrations/0005_create_doc_audio_bucket.sql`),
owner-scoped write RLS, path scheme `‹uid›/‹docId›/‹id›.‹ext›` — mirrors `doc-images`/`doc-videos`.
Unlike video, audio is **not transcoded** — the original is stored as-is (no `-raw` temp, no ffmpeg).

**Player UI:** play/pause, the waveform doubling as a seek bar (click/drag to scrub; played bars
fill yolk, unplayed stay muted), elapsed / total time. Built from scratch as a client component,
hooked into `document-editor.tsx` via the same media seams as image/video (`mediaPathsIn` extended
to the third bucket; `purgeDocMedia` sweeps it; paste/drop/click handlers route audio).

**Deferred for now (per user):** the **0–200% volume control** (§9.3). Native `HTMLMediaElement.volume`
caps at 1.0, so >100% requires routing through a Web Audio `GainNode` — that's the one fiddly piece,
and we're leaving it out of the first cut. The player ships with play/pause + seek + waveform first.

**Acceptance criteria**
- AC1: Insert an audio file (button / drag / paste) → it uploads and renders a waveform player; persists across reload.
- AC2: The waveform reflects the real audio (loud sections = taller bars), computed once at upload.
- AC3: Play/pause works; the played portion of the waveform fills with the yolk accent as it plays.
- AC4: Clicking/dragging the waveform seeks to that position.
- AC5: Deleting the audio (in-editor or via doc purge) removes its file from the `doc-audio` bucket (no orphans).

**Build order:** (1) `doc-audio` bucket migration ✅ applied · (2) insert + upload + waveform compute ✅ ·
(3) player UI (play/pause, seek, yolk fill) ✅ · (4) editor seams + orphan cleanup ✅ · (5) volume
GainNode — deferred. **Runtime test pending** (auth-gated).

---

## 10. Open questions / assumptions

- Email OTP = **6-digit code** flow (not magic link). Confirm if you'd prefer the clickable magic link instead.
- Exact shade of the "Egg-Yolk" accent and other product details are deferred until we reach those features.

---

## 11. Publish to web ✅

**Goal:** let a logged-in user publish a document to a public web page that **anyone can view without
logging in**, at a **`<slug>.tiro.works`** subdomain. All embeds (text, images, URL/link cards, audio,
video) work fully on the public page. One sharing mode only (this slice): **anyone with the link can view.**

**Decisions (with user)**
- **Snapshot, not live.** Publishing copies the document's current title + HTML into a public snapshot. The
  public page does **not** change as you keep editing — you click **Update published version** to push the
  latest. (Lets you keep editing privately and release when ready.) **Unpublish** removes the page.
- **Auto-generated readable slug** (`quiet-river-4821.tiro.works`) for v1. User-chosen custom subdomains are
  a deferred follow-up (the slug is the table's primary key, so a rename is a future, additive change).

**How it works**
- A new public table **`published_pages`** (`slug` PK, `document_id`, `owner_id`, snapshot `title` + `content`)
  is the *only* thing anonymous visitors can read. RLS: **public SELECT**; owner-only writes. The private
  `documents` table is never exposed to anon. Media already lives in public-read buckets, so embeds load for
  anyone with no extra policy. Migration `supabase/migrations/0006_create_published_pages.sql`.
- **Subdomain → page:** `proxy.ts` rewrites `<slug>.tiro.works` (and `<slug>.localhost` in dev) to the public
  `/p/[slug]` route, bypassing the auth gate. The page is also reachable directly at `tiro.works/p/<slug>`.
- The published HTML is **sanitized at publish** (`<script>`/`on*=`/`javascript:` stripped) before it's served
  to the public via `dangerouslySetInnerHTML`. The public renderer re-creates only embed interactivity
  (audio player, link-card open/play) — no editing, toolbar, or saving.
- **Editor control:** a **Publish** popover in the editor header (publish / copy link / open / update / unpublish),
  with a yolk "Published" badge when the doc is live.

**Acceptance criteria**
- AC1: Publishing a doc returns a `<slug>.tiro.works` link that opens the document for a logged-out visitor.
- AC2: All embeds (text, images, link cards, audio, video) render and play on the public page.
- AC3: Editing the doc does not change the public page until **Update published version** is clicked.
- AC4: **Unpublish** makes the public page 404.
- AC5: An anonymous visitor can never reach an *unpublished* document.

**Status:** ✅ Code + migration written; `tsc`/`eslint`/`next build` clean. **To go fully live:** apply
migration 0006 to remote, and add wildcard DNS (`*.tiro.works`) + the `*.tiro.works` domain in Vercel. Until
the wildcard domain resolves, published docs are viewable at the path form `tiro.works/p/<slug>`.
