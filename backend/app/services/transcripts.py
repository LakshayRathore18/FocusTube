import httpx

from ..config import get_settings


class TranscriptError(Exception):
    pass


async def get_transcript(youtube_video_id: str) -> str:
    key = get_settings().supadata_api_key
    if not key:
        raise TranscriptError("no_api_key")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://api.supadata.ai/v1/transcript",
                params={
                    "url": f"https://www.youtube.com/watch?v={youtube_video_id}",
                    "mode": "native",
                },
                headers={"x-api-key": key},
            )
            if response.status_code in {402, 429}:
                raise TranscriptError("rate_limited")
            if response.status_code == 404:
                raise TranscriptError("video_unavailable")
            response.raise_for_status()
            content = response.json().get("content")
            if isinstance(content, str):
                transcript = content.strip()
            elif isinstance(content, list):
                transcript = " ".join(" ".join(str(s["text"]) for s in content).split())
            else:
                raise TranscriptError("no_captions")
            if len(transcript) < 10:
                raise TranscriptError("no_captions")
            return transcript
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise TranscriptError("unknown") from exc
