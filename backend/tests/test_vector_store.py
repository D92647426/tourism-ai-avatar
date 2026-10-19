from app.core.database import new_session, reset_database
from app.models.persistence import KnowledgeBase, KnowledgeChunk
from app.services.vector_store import build_knowledge_base, retrieve_context, vector_backend_name
from tests.postgres_test_utils import postgres_test_database_url


def test_build_knowledge_base_creates_entries():
    reset_database(postgres_test_database_url("vector_store_build"))
    result = build_knowledge_base()
    db = new_session()
    try:
        knowledge_base = db.query(KnowledgeBase).filter(KnowledgeBase.code == "default").first()
        assert knowledge_base is not None
        assert knowledge_base.vector_backend == vector_backend_name()
        assert db.query(KnowledgeChunk).filter(KnowledgeChunk.enabled.is_(True)).count() >= 8
    finally:
        db.close()
    assert result["entry_count"] >= 8


def test_retrieve_context_finds_facility_answer():
    reset_database(postgres_test_database_url("vector_store_retrieve"))
    build_knowledge_base()
    chunks = retrieve_context("附近哪里有洗手间", top_k=3)
    assert chunks
    assert any("洗手间" in chunk["text"] for chunk in chunks)
