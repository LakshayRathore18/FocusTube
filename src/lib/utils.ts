/**
 * Shared utility functions for FocusTube.
 */

// ─── Time Formatting ────────────────────────────────────────────────────────

/**
 * Formats a date (string or Date object) as a human-readable relative time string.
 *
 * Examples: "just now", "5m ago", "2h ago", "3d ago", "1mo ago"
 */
export function formatTimeAgo(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - dateObj.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── HTML / Rich-text Helpers ───────────────────────────────────────────────

/**
 * Strips all HTML tags from a string. Does NOT decode entities.
 * Useful for quick previews where entity decoding is not needed.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Decodes common HTML entities, strips tags, and returns clean plain text.
 */
export function getPlainText(html: string): string {
  const decoded = html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  const stripped = decoded.replace(/<[^>]*>/g, " ");
  return stripped.replace(/\s+/g, " ").trim();
}

/**
 * Returns true if the HTML content is effectively empty after stripping tags.
 * Handles: "<p></p>", "<p><br></p>", whitespace-only, blank lines, etc.
 */
export function isNoteContentEmpty(html: string): boolean {
  const plain = getPlainText(html);
  return plain.length === 0;
}

// ─── Format Duration ────────────────────────────────────────────────────────

/**
 * Formats a duration in seconds to "m:ss" format.
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Progress ───────────────────────────────────────────────────────────────

/**
 * Calculates a percentage from completed/total.
 */
export function progressPercent(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}
