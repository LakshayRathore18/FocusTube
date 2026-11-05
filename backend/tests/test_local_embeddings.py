import re
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.config import get_settings
from app.services import local_embeddings as local
from app.services.rag_provider import RagError


class Tokenizer:
    def encode(self, text, **kwargs):
        return SimpleNamespace(offsets=[match.span() for match in re.finditer(r"\S+", text)])


def test_windows_keep_all_text_without_truncation():
    text = "first " + "passage " * 1100 + "THE_END"
    parts = local.windows(text, Tokenizer())
    assert "".join(part for part, _ in parts) == text
    assert all(weight <= 240 for _, weight in parts)
    assert parts[-1][0].endswith("THE_END")


def test_empty_text_is_rejected():
    with pytest.raises(ValueError):
        local.windows("   ", Tokenizer())


def test_local_model_no_prefix_normalized_pooling_and_complete_coverage(monkeypatch):
    calls = []

    def embed(inputs, **kwargs):
        assert kwargs == {"batch_size": 1, "parallel": None}
        calls.extend(inputs)
        return [SimpleNamespace(tolist=lambda: [2.0] * 384) for _ in inputs]

    model = SimpleNamespace(embed=embed)
    monkeypatch.setattr(local, "load_model", lambda: (model, Tokenizer()))
    text = "word " * 1000 + "final_example"
    vectors = local.encode([text], False)
    assert "".join(calls) == text
    assert len(vectors[0]) == 384
    assert sum(value * value for value in vectors[0]) == pytest.approx(1)
    calls.clear()
    local.encode(["What is the example?"], True)
    assert calls == ["What is the example?"]


def test_no_silent_fallback_or_unknown_model(monkeypatch):
    monkeypatch.setattr(get_settings(), "rag_embedding_model", "unconfigured-model")
    loader = Mock()
    monkeypatch.setattr(local, "load_model", loader)
    with pytest.raises(RagError, match="embedding_not_configured"):
        local.encode(["text"], False)
    loader.assert_not_called()


def test_missing_cache_is_safe_and_releases_lock(monkeypatch):
    monkeypatch.setattr(local, "load_model", Mock(side_effect=RuntimeError("sensitive path")))
    with pytest.raises(RagError, match="embedding_model_unavailable") as error:
        local.encode(["text"], False)
    assert "sensitive" not in str(error.value)
    assert not local._inference.locked()


def test_concurrent_inference_is_bounded():
    local._inference.acquire()
    try:
        with pytest.raises(RagError, match="embedding_busy"):
            local.encode(["text"], False)
    finally:
        local._inference.release()


async def test_inference_runs_off_event_loop(monkeypatch):
    import threading

    main_thread = threading.get_ident()

    def encode(texts, query):
        assert threading.get_ident() != main_thread
        assert texts == ["text"] and query is True
        return [[1.0] * 384]

    monkeypatch.setattr(local, "encode", encode)
    assert len((await local.embed(["text"], query=True))[0]) == 384
