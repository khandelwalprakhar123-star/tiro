# DeeScribe — Product Requirements Document

> **For the implementing agent (Opus 4.8):** This document is the single source of truth for building DeeScribe. Read it end-to-end before writing code. It is intentionally prescriptive about the data model, routing, and the tricky technical details (media playback, reference copies, exports). Where a decision is left open, it is flagged in **§13 Assumptions & Open Questions** — surface those to the user rather than guessing silently. Build in the phase order given in **§14**.

---

## 1. Overview

**DeeScribe** is a web-based document writing and editing application. Users write rich, multimodal documents — text, images, URLs, audio, and video — organize them into folders, and export or publish them. Think "Google Docs with first-class media embeds," built on a modern serverless stack.

- **One-liner:** A multimodal document editor where writing, media, and publishing live in one place.
- **Primary platform:** Responsive web app (desktop-first editing, fully usable on tablet and mobile).
- **Target users:** Writers, students, and creators who want to mix prose with rich media and share the result as a PDF, a markdown file, or a live web page.

---

## 2. Goals & Non-Goals

### Goals (MVP)
- Account creation, login, and session persistence via Supabase Auth (cookie-based, server-aware).
- Create, edit, organize, and delete documents.
- A document can live in multiple folders simultaneously as a **single shared source** (edits propagate everywhere).
- Rich editing: headings (1–5), subheadings, indentation, headers/footers, standard formatting.
- Multimodal content: text, URLs, images, audio embeds, video embeds.
- Custom audio and video players matching the spec in **§9**.
- Export a document to **PDF**, **Markdown**, or **Publish to Web** (shareable link).
- User profile management (display name, avatar, status).
- Trash system (soft delete; items kept indefinitely for now).
- Fully responsive UI/UX.

### Non-Goals (explicitly out of scope for MVP)
- Real-time multi-user collaboration / live cursors.
- Comments, suggestions, or version history.
- Mobile native apps (web only).
- Auto-purge of trash after 30 days — **deferred** (see §15).
- Offline editing.

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router)** + TypeScript | Server Components by default; Client Components for the editor & players. |
| Hosting | **Vercel** | Serverless functions for API routes; be mindful of the 50MB serverless bundle and execution limits for PDF generation (see §8.1). |
| Database | **Supabase Postgres** | With Row-Level Security (RLS) enabled on every table. |
| Auth | **Supabase Auth** via `@supabase/ssr` | Cookie-based sessions so Server Components & Route Handlers know the user. |
| File storage | **Supabase Storage** | Buckets for images, audio, video, and avatars. |
| Editor | **Custom, built from scratch** | No third-party editor library. A block-based editor over a custom JSON document model, using `contenteditable` + the browser **Selection/Range** APIs for inline formatting. See §4.5 and §7.4. |
| Styling | **Tailwind CSS** | Define design tokens incl. the Egg-Yolk accent (§9). |
| Markdown export | **Custom serializer** over the document model (§4.5) | No external editor-to-markdown package. |
| PDF export | `puppeteer-core` + `@sparticuz/chromium` on a serverless route **OR** browser print fallback | See §8.1 for the tradeoff and required decision. |

> **Building the editor from scratch (per the user's decision):** No editor library is used. The multimodal embeds, headings, indentation, and the "one document model that serializes to MD/PDF/HTML" requirements still need a structured document model — so we define our own (§4.5) and render it with React. A plain `<textarea>` cannot represent an embedded video, so the editor is a **block-based** `contenteditable` editor over that custom model. This is more work than adopting a library; the architecture in §4.5 is designed to keep it tractable.

---

## 4. Core Concepts & Data Model

### 4.1 Key modeling decision — "reference copies" across folders

The user requirement: *the same document can appear in multiple folders, and editing it in one folder updates it everywhere.*

**Do NOT duplicate document rows.** Model this as a **many-to-many** relationship:

- One `documents` row = one real document (the single source of truth).
- A `document_folders` join table maps a document into one or more folders.
- "Adding a document to another folder" = inserting another `document_folders` row. There is still only one underlying document, so any edit is automatically reflected in every folder it appears in. This satisfies the "dynamic reference copy" requirement by construction.
- A document with **zero** folder links is valid (it lives at the workspace root / "All Documents").

### 4.2 Schema (Postgres / Supabase)

```sql
-- USERS: Supabase manages auth.users. We mirror profile data here.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  status        text,              -- short user status / tagline
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table folders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  parent_id   uuid references folders(id) on delete cascade, -- nullable; supports nested folders
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                                    -- soft delete (trash)
);

create table documents (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Untitled',
  content     jsonb not null default '{}'::jsonb,  -- custom document model JSON (see §4.5)
  header      jsonb,                               -- optional running header content
  footer      jsonb,                               -- optional running footer content
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                          -- soft delete (trash)
);

-- The reference/many-to-many mechanism (see §4.1)
create table document_folders (
  document_id uuid not null references documents(id) on delete cascade,
  folder_id   uuid not null references folders(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (document_id, folder_id)
);

-- Media assets used inside a document (uploaded to Supabase Storage)
create table document_assets (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('image','audio','video')),
  storage_path text not null,        -- path within the Supabase Storage bucket
  mime_type    text,
  created_at   timestamptz not null default now()
);

-- Publishing: a public, shareable snapshot/link of a document
create table published_documents (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  slug          text not null unique,             -- used in /p/[slug]
  is_public     boolean not null default true,
  published_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### 4.3 Row-Level Security (apply to every table)

Enable RLS on all tables. General rule: **a user can only read/write rows they own** (`owner_id = auth.uid()`, and for `profiles`, `id = auth.uid()`).

Exception — **published documents must be publicly readable**:
- A `SELECT` policy on `published_documents` allowing `is_public = true` for anyone (including anonymous).
- The public published page must be able to read the underlying `documents.content` and its `document_assets` **only when** a public `published_documents` row points at them. Implement this either via a policy that joins to `published_documents`, or (simpler & safer) by serving published pages through a Route Handler using the Supabase **service role** key on the server, scoped strictly to published docs. Prefer the latter to avoid leaking unpublished content.

> Agent: write the RLS policies explicitly in a migration. Do not rely on "default deny" alone — every table needs intentional SELECT/INSERT/UPDATE/DELETE policies.

### 4.4 Trash model
- Trash = **soft delete**. "Delete" sets `deleted_at = now()` on `documents`/`folders`; it does not remove the row.
- All normal queries filter `deleted_at is null`.
- The Trash view queries `deleted_at is not null`.
- "Restore" sets `deleted_at = null`. "Delete forever" (hard delete) is a separate explicit action and also removes associated Storage assets.
- **For now, nothing auto-expires.** The 30-day auto-purge is deferred (§15).

### 4.5 Editor architecture & document model (built from scratch)

No editor library is used. The editor is **block-based**: a document is an ordered array of typed blocks, rendered by React. Text blocks are individually `contenteditable`; media blocks are non-editable React components (`contentEditable={false}`). This deliberately avoids stuffing embeds inside one giant `contenteditable` tree, which is the main source of contenteditable bugs.

**Document model** (stored in `documents.content` as JSON — this is *our* schema, defined by us):

```json
{
  "version": 1,
  "blocks": [
    {
      "id": "uuid",
      "type": "paragraph | heading | list | quote | image | audio | video | divider",
      "level": 1,                    // heading only: 1–5
      "listStyle": "ordered|bullet", // list only
      "indent": 0,                   // indentation level, 0+
      "align": "left|center|right",
      "inline": [                    // text blocks only — runs of text with marks
        { "text": "Hello ", "marks": [] },
        { "text": "world", "marks": ["bold", "italic"] },
        { "text": "a link", "marks": ["link"], "href": "https://example.com" }
      ],
      "assetId": "uuid"              // image/audio/video blocks → document_assets.id
    }
  ]
}
```

**Inline formatting:** within a text block, apply marks (bold / italic / underline / strikethrough / link) using the browser **Selection** and **Range** APIs. Keep the JSON model as the **source of truth**: on edit, read the contenteditable, reconcile the change back into the block's `inline` array, then re-render from the model. `document.execCommand` is deprecated and inconsistent — it may be used as a convenience to toggle a mark, but it must **not** be treated as the source of truth.

**Block operations the editor must support:** insert block, delete block, split a block on Enter, merge blocks on Backspace at the start of a block, move/reorder blocks, change block type (e.g. paragraph → heading), and increase/decrease `indent`.

**Headers and footers** use the same block model and are stored in `documents.header` / `documents.footer`.

**Paste handling:** on paste, sanitize incoming HTML into the block model (strip arbitrary styles/scripts; keep text and basic marks). Never inject raw pasted HTML into the DOM.

> **Reality check — please read.** A from-scratch ric21h-text editor with media embeds is the single hardest part of this product. `contenteditable` has many cross-browser edge cases: selection spanning blocks, paste, Backspace/Enter at block boundaries, and IME (non-Latin / composition) input. The block-based design above minimizes this by keeping each text block small and rendering all structure from the JSON model rather than trusting the DOM. Expect to iterate here. If the schedule slips, the editor — not auth, storage, or exports — is almost certainly the reason. Build it in small, testable pieces (§14, Phase 3).

---

## 5. Authentication & Sessions

- Use `@supabase/ssr` to create Supabase clients in three contexts: Client Components, Server Components, and Route Handlers / middleware.
- Sessions are stored in **cookies** so the server always knows the current user (requirement met).
- Add `middleware.ts` to refresh the auth session on every request and protect authenticated routes. Unauthenticated users hitting app routes redirect to `/login`. Public published pages (`/p/[slug]`) are exempt.
- On first successful sign-up/sign-in, ensure a matching `profiles` row exists (create it if missing — a Postgres trigger on `auth.users` insert is the cleanest approach).
- Auth methods for MVP: email + password (and magic link if trivial). Keep it simple.

---

## 6. Information Architecture & Routes

```
app/
├── layout.tsx                  # root layout, providers, theme tokens
├── (marketing)/
│   └── page.tsx                # public landing page (/)
├── login/page.tsx              # sign in
├── signup/page.tsx             # sign up
├── (app)/                      # authenticated app shell (requires session)
│   ├── layout.tsx              # sidebar (folders) + tab bar + main editor area
│   ├── workspace/page.tsx      # default view: all docs / open tabs
│   ├── doc/[docId]/page.tsx    # editor for a single document
│   ├── folders/[folderId]/page.tsx
│   ├── trash/page.tsx          # trash management
│   └── profile/page.tsx        # profile management
├── p/[slug]/page.tsx           # PUBLIC published document (no auth, embeds work)
└── api/
    ├── documents/...           # CRUD route handlers
    ├── export/pdf/route.ts     # server-side PDF generation
    ├── export/markdown/route.ts
    └── publish/route.ts        # create/update published_documents
```

### Tab behavior (requirement: "only one document in a tab")
- The app shell has a **tab bar**. Each open document occupies exactly one tab.
- Opening an already-open document focuses its existing tab rather than creating a duplicate.
- Switching tabs swaps the active document in the editor area. One document is editable at a time.
- Tab state (which docs are open) can be kept client-side for MVP; persisting it per user is a nice-to-have, not required.

---

## 7. Feature Specifications

Each feature lists behavior and **acceptance criteria** (AC) the agent can verify against.

### 7.1 Account Management
Sign up, log in, log out, session persistence.
- **AC1:** A new user can create an account and is logged in afterward.
- **AC2:** A logged-in user remains logged in across page reloads (cookie session).
- **AC3:** Logging out clears the session and redirects to `/login`.
- **AC4:** Authenticated-only routes are inaccessible when logged out.

### 7.2 Documents & Tabs
- **AC1:** A user can create a new document; it opens in a new tab.
- **AC2:** A user can have many documents but edits exactly one per tab.
- **AC3:** Reopening an open document focuses the existing tab (no duplicates).
- **AC4:** Document edits autosave to Supabase (debounced, e.g. ~1–2s after last keystroke) with a visible save state ("Saving…/Saved").
- **AC5:** A document can be renamed.

### 7.3 Folders & Reference Copies
- **AC1:** A user can create, rename, and delete folders.
- **AC2:** A document can be added to multiple folders.
- **AC3:** Editing a document reflects the change in **every** folder it appears in (because it is one underlying record — §4.1).
- **AC4:** Removing a document from one folder does NOT delete the document or affect other folders; it only removes that `document_folders` link.
- **AC5:** Deleting a document (to trash) removes it from all folder views until restored.

### 7.4 Editor & Formatting (Google-Docs-like, built from scratch — see §4.5)
- Headings **H1–H5**, subheadings, bold/italic/underline/strikethrough, ordered/unordered lists, blockquotes, links, text indentation (increase/decrease), and alignment.
- **Headers and footers**: editable running header/footer stored on the document (`documents.header` / `documents.footer`). They appear in the editor chrome and in PDF/print and published output.
- **AC1:** All listed formatting options are available via a toolbar and persist after save/reload.
- **AC2:** Indentation can be increased and decreased on blocks.
- **AC3:** Header and footer content is editable and renders in exports.

### 7.5 Multimodal Embeds
Users can insert into the document: **text, URLs, images, audio, video.**
- **Images:** uploaded to Supabase Storage; rendered inline; alt text optional.
- **URLs:** rendered as clickable links (optionally as link cards — link card is a nice-to-have, plain link is required).
- **Audio & Video:** custom players, fully specified in **§9**.
- Media files are recorded in `document_assets` and stored in Supabase Storage. The editor block stores a reference (asset id / storage path), not the binary.
- **AC1:** A user can insert each media type and it persists across reload.
- **AC2:** Audio and video render using the custom players in §9, not the raw browser default controls.

### 7.6 Export & Publish
User selects one of: **PDF**, **Markdown**, **Publish to Web**.

**Media-handling rule (applies to PDF & Markdown):** use the representation that costs the least and still preserves the content. Order of preference per medium:
- **Image:** embed directly (PDF: embedded image; Markdown: `![](url)` using a public/signed URL).
- **Audio / Video in PDF or Markdown:** a playable embed is generally **not** possible. Degrade gracefully in this order — (1) a poster/thumbnail image **plus** a labeled link to the media URL; (2) if no thumbnail, a labeled link (e.g. "▶ Watch video"); (3) if no shareable URL can be produced, render a placeholder noting the media was omitted. Never silently drop content without a visible note.

**Publish to Web** (the rich path):
- Generates a **shareable public link** at `/p/[slug]`.
- **All embeds must work** on the published page — images, audio player, and video player all fully functional, identical to the editor experience.
- The published page is server-rendered from the document content and is publicly readable (see §4.3 RLS note — serve via service role scoped to published docs).
- Re-publishing updates the existing published snapshot.

- **AC1:** Exporting to Markdown downloads a `.md` file; media degraded per the rule above.
- **AC2:** Exporting to PDF downloads a `.pdf`; media degraded per the rule above; headers/footers present.
- **AC3:** Publishing returns a working public URL viewable while logged out, with functional audio/video/image embeds.
- **AC4:** Unpublished documents are NOT publicly accessible.

### 7.7 Profile Management
Page at `/profile`. Edit **display name**, **profile picture**, **status**; **Save** persists changes.
- **AC1:** User can update each field and save.
- **AC2:** Avatar upload goes to a Supabase Storage `avatars` bucket; `profiles.avatar_url` updated.
- **AC3:** Changes persist across reload and reflect anywhere the profile is shown.

### 7.8 Trash Management
- **AC1:** Deleting a document or folder moves it to Trash (sets `deleted_at`).
- **AC2:** Trash lists all soft-deleted items.
- **AC3:** Items can be **Restored** (`deleted_at = null`).
- **AC4:** Items can be permanently deleted ("Delete forever"), which also removes their Storage assets.
- **AC5:** Trashed items stay **indefinitely** (no auto-expiry in MVP).

---

## 8. Export Implementation Notes

### 8.1 PDF generation — required decision
True server-side PDF on Vercel typically uses `puppeteer-core` + `@sparticuz/chromium` (a Chromium build sized for serverless). This is the most faithful (renders the same HTML/CSS as the published page) but adds bundle size and cold-start cost, and must respect Vercel function limits.

Simpler fallback: render a clean print-optimized HTML view and let the browser's "Save as PDF" handle it (via `window.print()` + a print stylesheet). Lower fidelity control, zero server cost.

**Agent action:** default to the **server-side puppeteer approach** for a one-click "Download PDF". If bundle/time limits on the user's Vercel plan make it impractical, fall back to the print-stylesheet approach and tell the user. Flag this in your build notes.

### 8.2 Markdown generation
Serialize the custom document model (§4.5) to Markdown with your own serializer: map each block type to its Markdown equivalent (heading levels 1–5 → `#`…`#####`, ordered/bullet lists, blockquotes → `>`, images → `![alt](url)`, divider → `---`) and inline marks → `**bold**`, `*italic*`, `[text](href)`. Map audio/video blocks to the degraded representations from §7.6. Resolve Storage paths to public or signed URLs before writing links.

---

## 9. Media Player Specifications

A custom **Audio** player and **Video** player are required. Both use an **Egg-Yolk yellow** accent.

> **Design token:** `--deescribe-yolk` ≈ `#FFB300` (a rich yolk yellow). Treat this as the single accent variable; the exact hex can be tuned, but all player accents (progress fill, sliders, active controls) must read from this one token.

### 9.1 Audio player
- A **playable embed** with a **decorative, arbitrary waveform UI** — i.e., render fake/static waveform bars; **do not** analyze or measure real audio amplitude. The bars are purely visual.
- Controls: play/pause, a seek/progress bar (yolk-filled), elapsed/total time.
- Volume control with the same range rule as video (see §9.3).

### 9.2 Video player (YouTube-like)
- A video player UI styled like YouTube but with the **Egg-Yolk yellow** accent (progress bar fill, slider handles, active states).
- Controls: play/pause, seek bar, elapsed/total time, **playback-speed control**, **volume control**, fullscreen.

### 9.3 Playback-speed & volume rules (apply to video; volume also to audio)
- **Playback speed:** range **0.25× to 2×**, in steps of **0.25** (i.e. 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0). Set via `mediaEl.playbackRate`.
- **Volume:** range **0× to 2×** of normal.

> ⚠️ **Critical technical note for the agent — volume above 1× cannot use the native HTML media element.** `HTMLMediaElement.volume` is clamped to the range `0.0–1.0`; setting `2` throws / is ignored. To reach **2× (200%)** you must route the media through the **Web Audio API**: create an `AudioContext`, a `MediaElementAudioSourceNode` from the `<video>`/`<audio>` element, connect it through a `GainNode` whose `gain.value` you drive from `0` to `2`, then to `destination`. The native element's own `volume` stays at 1; the GainNode does the 0–2 scaling. Implement volume this way for both players. (Note browser autoplay-policy: the `AudioContext` may need to be resumed on a user gesture.)

- **AC1:** Speed selector offers exactly 0.25→2.0 in 0.25 steps and changes playback rate.
- **AC2:** Volume slider spans 0–200% and audibly scales accordingly (verified via GainNode, not native volume).
- **AC3:** All accents render in the yolk-yellow token color.
- **AC4:** Audio player shows decorative (non-reactive) waveform bars.

---

## 10. Non-Functional Requirements

- **Responsive:** the entire app (editor, sidebar, tabs, players, profile, trash) must be usable and well-laid-out across desktop, tablet, and mobile. On small screens the folder sidebar collapses into a drawer; the toolbar condenses; players scale to width.
- **Security:** RLS on every table; never expose the Supabase service-role key to the client; published pages must not leak unpublished content.
- **Performance:** autosave is debounced; media uploads stream to Storage rather than through serverless function bodies where possible.
- **Accessibility:** keyboard-operable controls, focus states, alt text on images, ARIA labels on media controls.
- **Data integrity:** deleting a folder must not hard-delete shared documents — only their links to that folder (and the folder goes to trash).

---

## 11. Storage Buckets (Supabase)

| Bucket | Contents | Access |
|---|---|---|
| `images` | document inline images | private; served via signed URLs (or public if simpler for MVP) |
| `audio` | document audio | private; signed URLs |
| `video` | document video | private; signed URLs |
| `avatars` | profile pictures | public read |

Published pages need their media reachable publicly — generate long-lived signed URLs or a public-read path for assets belonging to published documents.

---

## 12. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only; NEVER exposed to the client
NEXT_PUBLIC_SITE_URL=             # used to build shareable /p/[slug] links
```

---

## 13. Assumptions & Open Questions

The agent should proceed on these assumptions but **surface them to the user** for confirmation:
1. **"Tab"** means an in-app tab bar (workspace tabs), not OS browser tabs. One document per tab.
2. **Auth method** is email/password (+ optional magic link). No social login in MVP.
3. **Nested folders** are allowed (folders have an optional `parent_id`). If the user wants flat folders only, drop `parent_id`.
4. **Egg-Yolk yellow** is taken as ≈ `#FFB300`; confirm the exact shade.
5. **Publishing** produces a server-rendered snapshot of current content; it updates on re-publish (no version history).
6. **No real-time collaboration** in MVP.
7. PDF generation approach (server puppeteer vs. print fallback) depends on the user's Vercel plan limits — confirm.
8. **The editor is built from scratch** (no Tiptap or other library), per the user's explicit instruction. This is accepted as the largest cost/risk in the project; the block-based architecture in §4.5 is the recommended way to keep it buildable.

---

## 14. Build Phases (recommended order for the agent)

1. **Foundation:** Next.js App Router + TypeScript + Tailwind scaffold; Supabase project; `@supabase/ssr` clients; `middleware.ts`; auth (signup/login/logout); `profiles` table + auto-create trigger.
2. **Data layer:** migrations for all tables in §4 with RLS policies; Storage buckets.
3. **Documents + Editor (the largest phase — budget the most time here):** build the custom block-based editor (§4.5, §7.4) — the JSON document model, rendering, `contenteditable` text blocks with inline marks via the Selection/Range API, block insert/split/merge/reorder/delete, block-type changes, headings/formatting/indentation, paste sanitization, headers/footers; then autosave and the tabbed workspace. Build and test each piece in isolation before composing them.
4. **Folders + reference model:** folder CRUD, `document_folders` many-to-many, multi-folder membership, "remove from folder" vs "delete".
5. **Multimodal embeds:** image upload; URL embeds; custom **audio** and **video** players per §9 (incl. Web Audio GainNode for 2× volume).
6. **Trash:** soft delete, trash view, restore, delete-forever (+ asset cleanup).
7. **Profile management:** display name, avatar upload, status, save.
8. **Export & Publish:** Markdown export; PDF export (§8.1); Publish to Web with working embeds at `/p/[slug]`.
9. **Responsive polish & accessibility pass** across all screens.

Each phase should end in a working, testable state before moving on.

---

## 15. Deferred / Future Work
- **Trash auto-purge after 30 days** (currently indefinite). When implemented: a scheduled job (Supabase cron / pg_cron or a Vercel Cron hitting a protected route) hard-deletes items whose `deleted_at` is older than 30 days, including their Storage assets.
- Link preview cards for URLs.
- Persisted open-tab state per user.
- Version history, comments, real-time collaboration.