/**
 * YouTube transcript fetching utility.
 *
 * Uses Supadata.ai's managed transcript API instead of scraping YouTube
 * directly. youtube-transcript-plus gets IP-blocked by YouTube when run
 * from Vercel / other cloud datacenter IPs. Supadata handles IP rotation
 * transparently and includes AI-generated fallback transcripts for videos
 * without native captions.
 *
 * API docs: https://supadata.ai
 * Env var required: SUPADATA_API_KEY
 *
 * Usage (server-side only):
 *   const result = await getTranscript("dQw4w9WgXcQ");
 *   if (result.success) { console.log(result.transcript); }
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type TranscriptFailureReason =
  | "no_captions"
  | "video_unavailable"
  | "rate_limited"
  | "no_api_key"
  | "unknown";

export type TranscriptResult =
  | { success: true; transcript: string }
  | { success: false; reason: TranscriptFailureReason };

// Supadata response shape
type SupadataSegment = { text: string; offset?: number; duration?: number };
type SupadataResponse = {
  content: SupadataSegment[] | string;
  lang?: string;
  availableLangs?: string[];
};

// ─── Transcript fetcher ──────────────────────────────────────────────────────

/**
 * Fetch the transcript for a YouTube video via Supadata.ai.
 *
 * Concatenates transcript segments into a single plain-text string
 * (timestamps stripped, segments joined with spaces, extra whitespace collapsed).
 */
export async function getTranscript(
  youtubeVideoId: string
): Promise<TranscriptResult> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    console.error("[transcript] SUPADATA_API_KEY is not set");
    return { success: false, reason: "no_api_key" };
  }

  const url = `https://api.supadata.ai/v1/transcript?url=https://www.youtube.com/watch?v=${youtubeVideoId}&mode=native`;

  try {
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
    });

    if (res.status === 402 || res.status === 429) {
      return { success: false, reason: "rate_limited" };
    }

    if (res.status === 404) {
      return { success: false, reason: "video_unavailable" };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[transcript] Supadata error ${res.status}:`, body.slice(0, 300));
      return { success: false, reason: "unknown" };
    }

    const data: SupadataResponse = await res.json();

    // content can be a string (plain text) or an array of segments
    let transcript: string;
    if (typeof data.content === "string") {
      transcript = data.content;
    } else if (Array.isArray(data.content)) {
      transcript = data.content
        .map((s) => s.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    } else {
      console.error("[transcript] Unexpected Supadata response shape", data);
      return { success: false, reason: "no_captions" };
    }

    if (!transcript || transcript.trim().length < 10) {
      return { success: false, reason: "no_captions" };
    }

    return { success: true, transcript };
  } catch (err: unknown) {
    console.error(
      `[transcript] Unexpected error for video ${youtubeVideoId}:`,
      err
    );
    return { success: false, reason: "unknown" };
  }
}

