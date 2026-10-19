from app.schemas.visitor import ChatTextRequest
from app.services.chat_service import chat_with_text


def test_chat_with_text_uses_references_and_latency(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("TEXT_MODEL_API_KEY", raising=False)
    result = chat_with_text(ChatTextRequest(session_uuid="test", message="灵山大佛有什么特色？"))
    assert result["answer"]
    assert result["references"]
    assert result["latency_ms"] >= 0
    assert result["model_used"]
    assert all(not ref["document"].lower().endswith(".xlsx") for ref in result["references"])
