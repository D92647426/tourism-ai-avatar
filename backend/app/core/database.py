from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for persistent backend tables."""


engine = None
SessionLocal: sessionmaker[Session]
ACTIVE_DATABASE_URL = settings.database_url


def _parse_postgres_url(database_url: str) -> URL:
    parsed = make_url(database_url)
    if not parsed.drivername.startswith("postgres"):
        raise ValueError(f"PostgreSQL-only runtime does not support database URL: {database_url}")
    if not parsed.database:
        raise ValueError(f"Database name is required in PostgreSQL URL: {database_url}")
    return parsed


def current_database_url() -> str:
    """Return the currently configured database URL."""
    if engine is not None:
        return str(engine.url)
    return ACTIVE_DATABASE_URL


def _maintenance_database_url(database_url: str) -> str:
    parsed = _parse_postgres_url(database_url)
    return parsed.set(database="postgres").render_as_string(hide_password=False)


def configure_database(database_url: str | None = None) -> None:
    """
    Configure the SQLAlchemy engine and session factory.

    对应需求：
    - REQ-008 后台权限、版本化知识库与数据库持久化
    """
    global ACTIVE_DATABASE_URL, engine, SessionLocal
    if engine is not None:
        engine.dispose()
    url = _parse_postgres_url(database_url or settings.database_url).render_as_string(hide_password=False)
    engine = create_engine(url, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
    ACTIVE_DATABASE_URL = url


def init_db() -> None:
    """Create all persistence tables if they do not exist."""
    from app.models import persistence  # noqa: F401

    if engine is None:
        configure_database()
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)
    from app.services.scenic_service import ensure_scenic_catalog

    ensure_scenic_catalog()


def reset_database(database_url: str) -> None:
    """Reset a test database. Production code should use init_db()."""
    from app.models import persistence  # noqa: F401

    parsed = _parse_postgres_url(database_url)
    database_name = parsed.database
    if database_name == "postgres":
        raise ValueError("Refusing to reset the PostgreSQL maintenance database.")
    admin_engine = create_engine(_maintenance_database_url(database_url), isolation_level="AUTOCOMMIT", pool_pre_ping=True)
    quoted_name = database_name.replace('"', '""')
    try:
        with admin_engine.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{quoted_name}" WITH (FORCE)'))
            connection.execute(text(f'CREATE DATABASE "{quoted_name}"'))
    finally:
        admin_engine.dispose()
    configure_database(parsed.render_as_string(hide_password=False))
    init_db()


def new_session() -> Session:
    """Create a database session bound to the currently configured engine."""
    return SessionLocal()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    db = new_session()
    try:
        yield db
    finally:
        db.close()


configure_database()
