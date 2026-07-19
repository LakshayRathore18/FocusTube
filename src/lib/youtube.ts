/**
 * YouTube Data API v3 utility functions.
 *
 * Provides:
 *   extractPlaylistId(url) — parse any YouTube playlist URL format
 *   fetchPlaylistData(playlistId) — GET playlists (snippet, contentDetails)
 *   fetchPlaylistItems(playlistId) — GET playlistItems → video metadata
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Extract a YouTube playlist ID from various URL formats:
 *
 *   https://www.youtube.com/playlist?list=PL...
 *   https://youtube.com/playlist?list=PL...
 *   https://youtu.be/...?list=PL...
 *   https://www.youtube.com/watch?v=...&list=PL...
 *   PL... (bare ID)
 */
export function extractPlaylistId(url: string): string | null {
  const trimmed = url.trim();

  // If it's already a bare playlist ID (starts with PL, OL, etc.)
  if (/^[A-Za-z0-9_-]{13,}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const listParam = parsed.searchParams.get("list");
    if (listParam) return listParam;
  } catch {
    // Not a valid URL — return null
  }

  return null;
}

/**
 * Fetch playlist metadata (title, thumbnail) from the YouTube Data API.
 */
export async function fetchPlaylistData(playlistId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY!;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");

  const url = new URL(`${YOUTUBE_API_BASE}/playlists`);
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", playlistId);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error (${res.status}): ${body}`);
  }

  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    throw new Error("Playlist not found");
  }

  const item = data.items[0];
  const snippet = item.snippet;

  return {
    title: snippet.title,
    description: snippet.description,
    thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? null,
    videoCount: item.contentDetails?.itemCount ?? 0,
  };
}

/**
 * Fetch all videos in a playlist (handles pagination up to 500 items).
 */
export async function fetchPlaylistItems(playlistId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY!;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");

  const videos: Array<{
    youtubeVideoId: string;
    title: string;
    position: number;
    thumbnailUrl: string | null;
  }> = [];

  let pageToken: string | undefined;

  do {
    const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`YouTube API error (${res.status}): ${body}`);
    }

    const data = await res.json();

    if (data.items) {
      for (const item of data.items) {
        const snippet = item.snippet;
        // Skip private/deleted videos (no videoId or title is "Deleted video" / "Private video")
        if (!item.contentDetails?.videoId) continue;
        if (
          snippet?.title === "Deleted video" ||
          snippet?.title === "Private video"
        )
          continue;

        videos.push({
          youtubeVideoId: item.contentDetails.videoId,
          title: snippet?.title ?? "Untitled",
          position: snippet?.position ?? 0,
          thumbnailUrl:
            snippet?.thumbnails?.high?.url ??
            snippet?.thumbnails?.medium?.url ??
            snippet?.thumbnails?.default?.url ??
            null,
        });
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  // YouTube's position field resets per page — reassign sequential positions
  return videos.map((v, idx) => ({
    ...v,
    position: idx,
  }));
}