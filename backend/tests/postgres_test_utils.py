from __future__ import annotations

import re

from sqlalchemy.engine import make_url

from app.core.config import settings


def postgres_test_database_url(label: str) -> str:
    """Build a deterministic PostgreSQL test database URL for one test module."""
    base_url = make_url(settings.database_url)
    if not base_url.drivername.startswith("postgres"):
        raise RuntimeError(f"PostgreSQL test database required, got: {settings.database_url}")
    base_name = base_url.database or "lingtour"
    safe_label = re.sub(r"[^a-z0-9_]+", "_", label.lower()).strip("_") or "test"
    return base_url.set(database=f"{base_name}_{safe_label}").render_as_string(hide_password=False)
