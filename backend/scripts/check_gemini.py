"""Send a plain-text connectivity prompt; never print API keys or error bodies."""

import json

import httpx

from app.config import get_settings


def check():
    settings = get_settings()
    models = list(
        dict.fromkeys(filter(None, [settings.gemini_model, settings.gemini_fallback_model]))
    )
    with httpx.Client(timeout=30) as client:
        for model in models:
            try:
                response = client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    headers={"x-goog-api-key": settings.gemini_api_key},
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {"text": "Reply with exactly: Hello, Gemini API is working."}
                                ]
                            }
                        ],
                        "generationConfig": {"maxOutputTokens": 128},
                    },
                )
                result = {"model": model, "http_status": response.status_code}
                if response.is_success:
                    result["reply"] = "".join(
                        part.get("text", "")
                        for candidate in response.json().get("candidates", [])
                        for part in candidate.get("content", {}).get("parts", [])
                        if not part.get("thought")
                    )
                print(json.dumps(result), flush=True)
            except Exception as exc:
                print(json.dumps({"model": model, "error_type": type(exc).__name__}), flush=True)


if __name__ == "__main__":
    check()
