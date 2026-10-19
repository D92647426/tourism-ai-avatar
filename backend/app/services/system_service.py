from __future__ import annotations

from sqlalchemy import text

from app.core.database import current_database_url, new_session
from app.services.deepseek_service import DeepSeekClient
from app.services.vector_store import vector_backend_name


def _database_status() -> tuple[str, str]:
    db = new_session()
    try:
        db.execute(text("SELECT 1"))
    finally:
        db.close()
    return "ok", "postgresql"


def get_system_status() -> dict:
    """Return a lightweight MVP system status summary for the admin console."""
    postgres_status, database_backend = _database_status()
    llm_status = "ok" if DeepSeekClient().enabled() else "degraded"
    vector_backend = vector_backend_name()
    return {
        "backend": "ok",
        "postgres": postgres_status,
        "llm": llm_status,
        "asr": "degraded",
        "tts": "degraded",
        "avatar": "ok",
        "database_backend": database_backend,
        "vector_backend": vector_backend,
    }
