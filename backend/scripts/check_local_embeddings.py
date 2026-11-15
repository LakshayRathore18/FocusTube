"""Offline CPU retrieval smoke check. No database or Gemini calls."""

import asyncio
import json
import os
from time import monotonic

from app.services.local_embeddings import MODEL, embed, load_model, windows


async def main():
    os.environ["HF_HUB_OFFLINE"] = "1"
    started = monotonic()
    documents = [
        "Python generators produce values lazily as iteration requests them, rather than computing the whole sequence in advance.",
        "Bananas contain potassium and grow in warm tropical climates.",
    ]
    vectors = await embed(documents)
    query = (await embed(["How does lazy iteration work in Python?"], query=True))[0]
    similarities = [sum(a * b for a, b in zip(query, vector)) for vector in vectors]
    assert similarities[0] > similarities[1]
    _, tokenizer = load_model()
    long_text = "An ordinary educational example. " * 1000 + "FINAL TRANSCRIPT PASSAGE"
    parts = windows(long_text, tokenizer)
    assert len(parts) > 1 and "".join(part for part, _ in parts) == long_text
    assert all(weight <= 240 for _, weight in parts)
    print(
        json.dumps(
            {
                "passed": True,
                "model": MODEL,
                "dimensions": len(query),
                "offline": True,
                "relevant_passage_ranked_first": True,
                "long_text_fully_covered": True,
                "seconds": round(monotonic() - started, 2),
            }
        )
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(json.dumps({"passed": False, "error_type": type(exc).__name__}))
        raise SystemExit(1) from None
