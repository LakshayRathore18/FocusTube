import re
from urllib.parse import parse_qs, urlsplit

import httpx
from fastapi import HTTPException

from ..config import get_settings

API = "https://www.googleapis.com/youtube/v3"


def extract_playlist_id(value: str) -> str:
    value = value.strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{13,}", value):
        return value
    parsed = urlsplit(value)
    if parsed.scheme in {"https", "http"} and parsed.hostname in {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
    }:
        playlist_id = parse_qs(parsed.query).get("list", [""])[0]
        if re.fullmatch(r"[A-Za-z0-9_-]{13,}", playlist_id):
            return playlist_id
    raise HTTPException(400, "Could not extract a valid YouTube playlist ID from the provided URL")


def thumbnail(snippet: dict) -> str | None:
    choices = snippet.get("thumbnails", {})
    return next((choices[k]["url"] for k in ("high", "medium", "default") if k in choices), None)


async def fetch_playlist(playlist_id: str) -> tuple[dict, list[dict]]:
    key = get_settings().youtube_api_key
    if not key:
        raise HTTPException(503, "YouTube API is not configured")
    try:
        async with httpx.AsyncClient(timeout=20) as client:

            async def get(resource, **params):
                response = await client.get(f"{API}/{resource}", params={"key": key, **params})
                response.raise_for_status()
                return response.json()

            data = await get("playlists", part="snippet,contentDetails", id=playlist_id)
            if not data.get("items"):
                raise HTTPException(502, "Playlist not found")
            snippet = data["items"][0]["snippet"]
            metadata = {"title": snippet["title"], "thumbnail_url": thumbnail(snippet)}
            videos, seen, page = [], set(), None
            while True:
                params = {
                    "part": "snippet,contentDetails",
                    "playlistId": playlist_id,
                    "maxResults": 50,
                }
                if page:
                    params["pageToken"] = page
                items = await get("playlistItems", **params)
                for item in items.get("items", []):
                    s = item["snippet"]
                    video_id = item.get("contentDetails", {}).get("videoId")
                    if (
                        not video_id
                        or video_id in seen
                        or s.get("title") in {"Private video", "Deleted video"}
                    ):
                        continue
                    seen.add(video_id)
                    videos.append(
                        {
                            "youtube_video_id": video_id,
                            "title": s["title"],
                            "position": len(videos),
                            "thumbnail_url": thumbnail(s),
                        }
                    )
                page = items.get("nextPageToken")
                if not page:
                    break
            return metadata, videos
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        # Provider responses and request URLs may contain credentials; never expose them.
        raise HTTPException(502, "Failed to fetch playlist from YouTube") from exc
