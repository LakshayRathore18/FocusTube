"""Download open-source model weights once. No database or Gemini calls."""

import json
import os

from app.services.local_embeddings import CACHE, MODEL, encode
from app.services.rag_provider import RagError


def main():
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    from fastembed import TextEmbedding

    TextEmbedding(
        model_name=MODEL,
        cache_dir=str(CACHE),
        threads=1,
        providers=["CPUExecutionProvider"],
        local_files_only=False,
        max_length=256,
    )
    vectors = encode(["An educational transcript about programming."], False)
    print(
        json.dumps(
            {"ready": True, "model": MODEL, "dimensions": len(vectors[0]), "runtime": "local_cpu"}
        )
    )


if __name__ == "__main__":
    try:
        main()
    except RagError as exc:
        print(json.dumps({"ready": False, "reason": exc.code}))
        raise SystemExit(1) from None
    except Exception as exc:
        print(json.dumps({"ready": False, "error_type": type(exc).__name__}))
        raise SystemExit(1) from None
