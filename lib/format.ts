// Deterministic date formatting for SSR.
//
// We intentionally do NOT use `toLocaleDateString`: it depends on the runtime's
// default locale *and* timezone, which differ between the Node server (renders
// the initial HTML) and the browser (hydrates it). That mismatch throws a React
// hydration error. Building the string from fixed parts guarantees the server
// and client always produce the exact same text.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// Formats an ISO timestamp as e.g. "15 Jun 2026" (UTC, locale-independent).
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}
