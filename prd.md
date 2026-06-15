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

## 9. Open questions / assumptions

- Email OTP = **6-digit code** flow (not magic link). Confirm if you'd prefer the clickable magic link instead.
- Exact shade of the "Egg-Yolk" accent and other product details are deferred until we reach those features.
