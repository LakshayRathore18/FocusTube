"""CPU-only MiniLM embeddings. Runtime reads cached weights; setup downloads explicitly."""

import asyncio
from functools import lru_cache
from pathlib import Path
from threading import Lock

from ..config import get_settings

MODEL = "sentence-transformers/all-MiniLM-L6-v2"
WINDOW_TOKENS = 240
CACHE = Path(__file__).resolve().parents[2] / ".cache" / "embeddings"
_inference = Lock()


@lru_cache(maxsize=1)
def load_model():
    from fastembed import TextEmbedding
    from tokenizers import Tokenizer

    model = TextEmbedding(
        model_name=MODEL,
        cache_dir=str(CACHE),
        threads=1,
        providers=["CPUExecutionProvider"],
        local_files_only=True,
        max_length=256,
    )
    # Clone the model's tokenizer to count the complete text without changing
    # FastEmbed's inference tokenizer, which retains its 256-token bound.
    tokenizer = Tokenizer.from_str(model.model.tokenizer.to_str())
    tokenizer.no_truncation()
    tokenizer.no_padding()
    return model, tokenizer


def windows(text: str, tokenizer) -> list[tuple[str, int]]:
    offsets = tokenizer.encode(text, add_special_tokens=False).offsets
    if not offsets:
        raise ValueError("empty_embedding_input")
    result = []
    start = 0
    # Reserve room for model special tokens.
    for index in range(0, len(offsets), WINDOW_TOKENS):
        stop = min(index + WINDOW_TOKENS, len(offsets))
        end = len(text) if stop == len(offsets) else offsets[stop - 1][1]
        result.append((text[start:end], stop - index))
        start = end
    return result


def encode(texts: list[str], query: bool) -> list[list[float]]:
    from .rag_provider import RagError, normalize

    if get_settings().rag_embedding_model != MODEL:
        raise RagError("embedding_not_configured")
    # Keep CPU/memory use bounded, even if a timed-out request's native work
    # has not yet returned. No waiting thread queue or provider fallback.
    if not _inference.acquire(blocking=False):
        raise RagError("embedding_busy")
    try:
        try:
            model, tokenizer = load_model()
        except Exception:
            raise RagError("embedding_model_unavailable") from None
        output = []
        for text in texts:
            parts = windows(text, tokenizer)
            inputs = [part for part, _ in parts]
            vectors = list(model.embed(inputs, batch_size=1, parallel=None))
            if len(vectors) != len(parts):
                raise RagError("invalid_embedding")
            # Long passages use every token, rather than silently embedding
            # only their first 256. Weight each window by its token count.
            total = sum(weight for _, weight in parts)
            pooled = [0.0] * 384
            for vector, (_, weight) in zip(vectors, parts):
                values = normalize(vector.tolist())
                for index, value in enumerate(values):
                    pooled[index] += value * weight / total
            output.append(normalize(pooled))
        return output
    except RagError:
        raise
    except Exception:
        raise RagError("local_embedding_failed") from None
    finally:
        _inference.release()


async def embed(texts: list[str], *, query: bool = False) -> list[list[float]]:
    return await asyncio.to_thread(encode, texts, query)
