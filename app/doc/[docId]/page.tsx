import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentEditor } from "./document-editor";

// In Next 16, route params arrive as a Promise — we await them.
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;

  const supabase = await createClient();
  // Local JWT verification (no network); the proxy did the authoritative check.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // RLS means this only returns the row if it's ours AND not trashed.
  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, content, updated_at")
    .eq("id", docId)
    .is("deleted_at", null)
    .maybeSingle();

  // No such doc (or not ours / trashed) → back to the desk.
  if (!doc) redirect("/workspace");

  // Is this doc already published? Load its public page row (if any) so the
  // editor's Publish panel opens in the right state (slug, "live" badge).
  const { data: published } = await supabase
    .from("published_pages")
    .select("slug, published_at")
    .eq("document_id", doc.id)
    .maybeSingle();
  const initialPublish = published
    ? { slug: published.slug, publishedAt: published.published_at as string }
    : null;

  // content is jsonb. v2 stores { html }. Older docs stored { plain } — convert
  // those to simple paragraphs so nothing is lost when the editor upgraded.
  const content = doc.content as { html?: unknown; plain?: unknown } | null;
  let initialHtml = "";
  if (content && typeof content === "object") {
    if (typeof content.html === "string") {
      initialHtml = content.html;
    } else if (typeof content.plain === "string") {
      initialHtml = content.plain
        .split(/\n+/)
        .filter((line) => line.trim().length > 0)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("");
    }
  }

  return (
    <DocumentEditor
      docId={doc.id}
      userId={String(data.claims.sub)}
      initialTitle={doc.title}
      initialHtml={initialHtml}
      initialPublish={initialPublish}
    />
  );
}

// Minimal HTML escape for migrating old plain-text docs into the editor.
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
