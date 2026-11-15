import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from google.genai import errors

from app.services import gemini, transcripts, youtube
from app.services.gemini import GenerationError
from app.services.transcripts import TranscriptError

VALID = {
    "summary": {"hook": "Learn Python", "keyPoints": ["Variables"]},
    "quiz": {"questions": [{"question": "Which?", "options": ["A", "B", "C", "D"], "answer": 0}]},
}


def mock_gemini(monkeypatch, output, error=None, fallback=""):
    generate = AsyncMock(return_value=SimpleNamespace(text=output), side_effect=error)

    class Client:
        def __init__(self, **kwargs):
            self.aio = self
            self.models = SimpleNamespace(generate_content=generate)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    monkeypatch.setattr(gemini.genai, "Client", Client)
    monkeypatch.setattr(
        gemini,
        "get_settings",
        lambda: SimpleNamespace(
            gemini_api_key="test-key",
            gemini_model="test-model",
            gemini_fallback_model=fallback,
        ),
    )
    return generate


@pytest.mark.parametrize(
    "failure",
    [
        errors.APIError(503, {"error": {"message": "private details"}}),
        httpx.ReadTimeout("private URL"),
        TimeoutError(),
    ],
)
async def test_gemini_falls_back_on_unavailability(setup, monkeypatch, failure):
    generate = mock_gemini(
        monkeypatch,
        "",
        error=[failure, SimpleNamespace(text=json.dumps(VALID))],
        fallback="backup-model",
    )
    assert await gemini.generate_notes("transcript " * 10) == VALID
    assert [call.kwargs["model"] for call in generate.call_args_list] == [
        "test-model",
        "backup-model",
    ]
    assert generate.call_args.kwargs["config"].max_output_tokens == 4096


async def test_gemini_does_not_fallback_on_invalid_credentials(setup, monkeypatch):
    generate = mock_gemini(
        monkeypatch,
        "",
        error=errors.APIError(403, {"error": {"message": "private details"}}),
        fallback="backup-model",
    )
    with pytest.raises(GenerationError, match="^ai_not_configured$"):
        await gemini.generate_notes("transcript " * 10)
    assert generate.await_count == 1


@pytest.mark.parametrize("fenced", [False, True])
async def test_gemini_parses_valid_json(setup, monkeypatch, fenced):
    output = json.dumps(VALID)
    mock_gemini(monkeypatch, f"```json\n{output}\n```" if fenced else output)
    assert await gemini.generate_notes("transcript " * 10) == VALID


@pytest.mark.parametrize(
    "output,reason",
    [
        ("not JSON", "parse_error"),
        (json.dumps({**VALID, "quiz": {"questions": []}}), "invalid_quiz_shape"),
        (
            json.dumps(
                {
                    **VALID,
                    "quiz": {
                        "questions": [
                            {"question": "Which?", "options": ["A", "B"], "answer": 0},
                        ]
                    },
                }
            ),
            "invalid_quiz_shape",
        ),
        (
            json.dumps(
                {
                    **VALID,
                    "quiz": {
                        "questions": [
                            {"question": "Which?", "options": ["A", "B", "C", "D"], "answer": True},
                        ]
                    },
                }
            ),
            "invalid_quiz_shape",
        ),
    ],
)
async def test_gemini_rejects_malformed_responses(setup, monkeypatch, output, reason):
    mock_gemini(monkeypatch, output)
    with pytest.raises(GenerationError, match=reason):
        await gemini.generate_notes("transcript " * 10)


async def test_gemini_sanitizes_provider_failure(setup, monkeypatch):
    mock_gemini(monkeypatch, "", error=RuntimeError("sensitive provider response"))
    with pytest.raises(GenerationError, match="^api_error$"):
        await gemini.generate_notes("transcript " * 10)


@pytest.mark.parametrize(
    "code,reason",
    [
        (503, "service_unavailable"),
        (429, "rate_limited"),
        (404, "model_unavailable"),
        (403, "ai_not_configured"),
    ],
)
async def test_gemini_provider_error_codes(setup, monkeypatch, code, reason):
    mock_gemini(
        monkeypatch,
        "",
        error=errors.APIError(code, {"error": {"message": "private provider details"}}),
    )
    with pytest.raises(GenerationError, match=f"^{reason}$"):
        await gemini.generate_notes("transcript " * 10)


def mock_http(monkeypatch, service, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(
        service.httpx,
        "AsyncClient",
        lambda **kwargs: original(
            transport=httpx.MockTransport(handler),
            **kwargs,
        ),
    )


@pytest.mark.parametrize(
    "status,body,reason",
    [
        (429, {}, "rate_limited"),
        (402, {}, "rate_limited"),
        (404, {}, "video_unavailable"),
        (200, {"content": []}, "no_captions"),
        (200, {"content": [{"offset": 0}]}, "unknown"),
    ],
)
async def test_transcript_provider_failures(setup, monkeypatch, status, body, reason):
    monkeypatch.setattr(
        transcripts, "get_settings", lambda: SimpleNamespace(supadata_api_key="test")
    )
    mock_http(monkeypatch, transcripts, lambda request: httpx.Response(status, json=body))
    with pytest.raises(TranscriptError, match=f"^{reason}$"):
        await transcripts.get_transcript("abcdefghijk")


async def test_transcript_timeout_is_sanitized(setup, monkeypatch):
    monkeypatch.setattr(
        transcripts, "get_settings", lambda: SimpleNamespace(supadata_api_key="test")
    )

    def timeout(request):
        raise httpx.ReadTimeout("sensitive provider URL", request=request)

    mock_http(monkeypatch, transcripts, timeout)
    with pytest.raises(TranscriptError, match="^unknown$"):
        await transcripts.get_transcript("abcdefghijk")


async def test_youtube_pagination_deduplication_and_unavailable_entries(setup, monkeypatch):
    monkeypatch.setattr(youtube, "get_settings", lambda: SimpleNamespace(youtube_api_key="test"))
    pages = []

    def item(video_id, title):
        return {"snippet": {"title": title}, "contentDetails": {"videoId": video_id}}

    def respond(request):
        if request.url.path.endswith("/playlists"):
            return httpx.Response(200, json={"items": [{"snippet": {"title": "Course"}}]})
        page = request.url.params.get("pageToken")
        pages.append(page)
        if page is None:
            return httpx.Response(
                200,
                json={
                    "items": [
                        item("abcdefghijk", "Intro"),
                        item("private", "Private video"),
                    ],
                    "nextPageToken": "page-2",
                },
            )
        return httpx.Response(
            200,
            json={
                "items": [
                    item("abcdefghijk", "Duplicate"),
                    item("lmnopqrstuv", "Next"),
                ]
            },
        )

    mock_http(monkeypatch, youtube, respond)
    metadata, videos = await youtube.fetch_playlist("PLabcdefghijklm")
    assert metadata["title"] == "Course"
    assert pages == [None, "page-2"]
    assert [v["youtube_video_id"] for v in videos] == ["abcdefghijk", "lmnopqrstuv"]
    assert [v["position"] for v in videos] == [0, 1]
