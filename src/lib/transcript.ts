/**
 * YouTube transcript fetching utility.
 *
 * Wraps youtube-transcript-plus into a simple typed function that the AI pipeline
 * can use without worrying about library-specific error classes.
 *
 * Usage (server-side only — requires Node fetch):
 *   const result = await getTranscript("dQw4w9WgXcQ");
 *   if (result.success) { console.log(result.transcript); }
 */

import { fetchTranscript } from "youtube-transcript-plus";
import {
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
} from "youtube-transcript-plus";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TranscriptFailureReason =
  | "no_captions"
  | "video_unavailable"
  | "rate_limited"
  | "unknown";

export type TranscriptResult =
  | { success: true; transcript: string }
  | { success: false; reason: TranscriptFailureReason };

// ─── Transcript fetcher ──────────────────────────────────────────────────────

/**
 * Fetch the transcript for a YouTube video.
 *
 * Concatenates transcript segments into a single plain-text string
 * (timestamps stripped, segments joined with spaces, extra whitespace collapsed).
 *
 * Does NOT touch Prisma or AIContent — this is a pure fetch utility.
 */
export async function getTranscript(
  youtubeVideoId: string
): Promise<TranscriptResult> {
  try {
    const segments = await fetchTranscript(youtubeVideoId);

    // Concatenate segments: strip timestamps, join with spaces, collapse whitespace
    const transcript = segments
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return { success: true, transcript };
  } catch (err: unknown) {
    if (err instanceof YoutubeTranscriptNotAvailableError || err instanceof YoutubeTranscriptDisabledError) {
      return { success: false, reason: "no_captions" };
    }

    if (err instanceof YoutubeTranscriptVideoUnavailableError) {
      return { success: false, reason: "video_unavailable" };
    }

    if (err instanceof YoutubeTranscriptTooManyRequestError) {
      return { success: false, reason: "rate_limited" };
    }

    // Unknown error — log server-side so we can identify new failure modes
    console.error(
      `[transcript] Unexpected error for video ${youtubeVideoId}:`,
      err
    );
    return { success: false, reason: "unknown" };
  }
}
