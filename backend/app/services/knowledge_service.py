from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import new_session
from app.models.persistence import KnowledgeDocument, KnowledgeDocumentVersion, KnowledgeOperationLog
from app.services.vector_store import (
    ADMIN_KNOWLEDGE_DIR,
    VECTOR_STORE_PATH,
    build_knowledge_base,
    count_document_chunks,
    embed_document as embed_document_chunks,
    ensure_default_knowledge_base,
    list_knowledge_bases as list_vector_knowledge_bases,
    read_supported_document,
    retrieve_context as retrieve_vector_context,
    vector_backend_name,
)


SUPPORTED_UPLOAD_SUFFIXES = {".md", ".txt", ".csv", ".json", ".docx", ".xlsx"}
VALID_STATUSES = {"all", "draft", "active", "archived", "deleted"}


def retrieve_context(query: str, top_k: int = 2) -> list[dict]:
    """
    Retrieve scenic knowledge chunks for visitor answers.

    对应需求：
    - REQ-001 DeepSeek + 本地知识库问答闭环
    - REQ-008 后台权限、版本化知识库与数据库持久化
    - REQ-017 PostgreSQL + pgvector 知识库检索
    """
    chunks = retrieve_vector_context(query, top_k=top_k)
    if chunks:
        return chunks
    return [
        {
            "chunk_id": "fallback_service",
            "source": "fallback",
            "category": "fallback",
            "title": "服务兜底",
            "text": "景区入口设有游客服务中心，可咨询路线、开放时间、失物招领和应急服务。",
            "score": 0,
        }
    ]


def list_knowledge_bases() -> list[dict]:
    return list_vector_knowledge_bases()


def _safe_document_stem(name: str) -> str:
    stem = Path(name).stem.strip() or "knowledge"
    stem = re.sub(r"[^\w\u4e00-\u9fff.-]+", "_", stem)
    return stem[:80] or "knowledge"


def _safe_file_name(file_name: str, title: str | None = None) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix not in SUPPORTED_UPLOAD_SUFFIXES:
        suffix = ".md"
    return f"{_safe_document_stem(title or file_name)}{suffix}"


def _root_dir() -> Path:
    return Path(__file__).resolve().parents[3]


def _relative_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(_root_dir())).replace("\\", "/")
    except ValueError:
        return str(resolved)


def _storage_path(document_id: str, version: int, file_name: str) -> Path:
    return ADMIN_KNOWLEDGE_DIR / document_id / f"v{version}_{_safe_file_name(file_name)}"


def _read_preview(storage_path: str, limit: int = 1200) -> str:
    path = _root_dir() / storage_path
    if path.suffix.lower() not in {".md", ".txt", ".csv", ".json"} or not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore")[:limit]


def _hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _current_version(db: Session, document: KnowledgeDocument) -> KnowledgeDocumentVersion | None:
    if document.current_version_id:
        return db.get(KnowledgeDocumentVersion, document.current_version_id)
    return (
        db.query(KnowledgeDocumentVersion)
        .filter(KnowledgeDocumentVersion.document_id == document.id)
        .order_by(KnowledgeDocumentVersion.version.desc())
        .first()
    )


def _log(
    db: Session,
    action: str,
    actor: str,
    document: KnowledgeDocument | None = None,
    version_id: str | None = None,
    detail=None,
) -> None:
    db.add(
        KnowledgeOperationLog(
            document_id=document.id if document else None,
            version_id=version_id,
            action=action,
            actor=actor,
            detail=json.dumps(detail or {}, ensure_ascii=False),
        )
    )


def _knowledge_base_public_id() -> str:
    return settings.default_knowledge_base_id


def _document_payload(db: Session, document: KnowledgeDocument, include_preview: bool = True) -> dict:
    version = _current_version(db, document)
    version_count = db.query(KnowledgeDocumentVersion).filter(KnowledgeDocumentVersion.document_id == document.id).count()
    history_count = db.query(KnowledgeOperationLog).filter(KnowledgeOperationLog.document_id == document.id).count()
    current_chunk_count = count_document_chunks(document.id, document.current_version_id)
    enabled_chunk_count = count_document_chunks(document.id, document.current_version_id, enabled_only=True)
    return {
        "id": document.id,
        "knowledge_base_id": _knowledge_base_public_id(),
        "title": document.title,
        "file_name": document.file_name,
        "source": document.storage_path,
        "status": document.status,
        "editable": document.status != "deleted",
        "current_version": document.current_version,
        "current_version_id": document.current_version_id,
        "version_count": version_count,
        "history_count": history_count,
        "chunk_count": current_chunk_count,
        "enabled_chunk_count": enabled_chunk_count,
        "updated_at": document.updated_at.isoformat(timespec="seconds"),
        "created_at": document.created_at.isoformat(timespec="seconds"),
        "preview": _read_preview(version.storage_path) if include_preview and version else "",
        "vector_store": str(VECTOR_STORE_PATH),
        "vector_backend": vector_backend_name(),
    }


def rebuild_index(actor: str = "system") -> dict:
    """Rebuild the database-backed knowledge chunk index after active knowledge changes."""
    result = build_knowledge_base()
    db = new_session()
    try:
        _log(db, "reindex", actor, detail=result)
        db.commit()
    finally:
        db.close()
    return result


def embed_document(document_id: str, actor: str = "system") -> dict:
    """Embed the current version of a knowledge document into the database chunk store."""
    result = embed_document_chunks(document_id)
    db = new_session()
    try:
        document = db.get(KnowledgeDocument, document_id)
        _log(db, "embed", actor, document, result.get("version_id"), result)
        db.commit()
    finally:
        db.close()
    return result


def save_document(
    file_name: str,
    content: bytes,
    title: str | None = None,
    actor: str = "system",
    status: str = "draft",
    change_note: str = "initial upload",
) -> dict:
    """
    Save an uploaded knowledge document as a versioned draft.

    输入：上传文件名、字节内容、可选标题、操作者。
    输出：文档元信息。
    异常：文件类型不支持或文件为空时抛出 ValueError。
    """
    if not content:
        raise ValueError("uploaded knowledge document is empty")
    target_name = _safe_file_name(file_name, title)
    if Path(target_name).suffix.lower() not in SUPPORTED_UPLOAD_SUFFIXES:
        raise ValueError(f"unsupported knowledge document type: {file_name}")
    if status not in {"draft", "active"}:
        raise ValueError("knowledge document status must be draft or active")

    db = new_session()
    try:
        knowledge_base = ensure_default_knowledge_base(db)
        document = KnowledgeDocument(
            knowledge_base_id=knowledge_base.id,
            title=_safe_document_stem(title or file_name),
            file_name=target_name,
            status=status,
            current_version=1,
            storage_path="",
            created_by=actor,
            updated_by=actor,
        )
        db.add(document)
        db.flush()
        path = _storage_path(document.id, 1, target_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        version = KnowledgeDocumentVersion(
            document_id=document.id,
            version=1,
            title=document.title,
            file_name=target_name,
            storage_path=_relative_path(path),
            content_hash=_hash(content),
            change_note=change_note,
            created_by=actor,
        )
        db.add(version)
        db.flush()
        document.storage_path = version.storage_path
        document.current_version_id = version.id
        _log(db, "upload", actor, document, version.id, {"status": status, "change_note": change_note})
        db.commit()
        db.refresh(document)
    finally:
        db.close()

    embed_result = embed_document(document.id, actor)
    if status == "active":
        rebuild_index(actor)

    db = new_session()
    try:
        refreshed = db.get(KnowledgeDocument, document.id)
        payload = _document_payload(db, refreshed)
        payload["embed_result"] = embed_result
        return payload
    finally:
        db.close()


def update_document(
    document_id: str,
    title: str | None = None,
    content: str | None = None,
    actor: str = "system",
    change_note: str = "browser edit",
) -> dict:
    """Create a new draft version for an editable text knowledge document."""
    db = new_session()
    try:
        document = db.get(KnowledgeDocument, document_id)
        if not document or document.status == "deleted":
            raise FileNotFoundError(f"knowledge document not found: {document_id}")
        current = _current_version(db, document)
        if not current:
            raise FileNotFoundError(f"knowledge document has no version: {document_id}")
        current_path = _root_dir() / current.storage_path
        if current_path.suffix.lower() not in {".md", ".txt", ".csv", ".json"}:
            raise ValueError("only text knowledge documents can be edited in browser")
        new_title = _safe_document_stem(title or document.title)
        new_content = content if content is not None else current_path.read_text(encoding="utf-8", errors="ignore")
        new_bytes = new_content.encode("utf-8")
        next_version = document.current_version + 1
        next_name = _safe_file_name(document.file_name, new_title)
        path = _storage_path(document.id, next_version, next_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(new_bytes)
        version = KnowledgeDocumentVersion(
            document_id=document.id,
            version=next_version,
            title=new_title,
            file_name=next_name,
            storage_path=_relative_path(path),
            content_hash=_hash(new_bytes),
            change_note=change_note,
            created_by=actor,
        )
        db.add(version)
        db.flush()
        document.title = new_title
        document.file_name = next_name
        document.status = "draft"
        document.current_version = next_version
        document.current_version_id = version.id
        document.storage_path = version.storage_path
        document.updated_by = actor
        document.updated_at = datetime.utcnow()
        _log(db, "update", actor, document, version.id, {"change_note": change_note})
        db.commit()
        db.refresh(document)
    finally:
        db.close()

    embed_result = embed_document(document_id, actor)
    index_result = rebuild_index(actor)
    db = new_session()
    try:
        refreshed = db.get(KnowledgeDocument, document_id)
        payload = _document_payload(db, refreshed)
        payload["embed_result"] = embed_result
        payload["index_result"] = index_result
        return payload
    finally:
        db.close()


def publish_document(document_id: str, actor: str = "system") -> dict:
    db = new_session()
    try:
        document = db.get(KnowledgeDocument, document_id)
        if not document or document.status == "deleted":
            raise FileNotFoundError(f"knowledge document not found: {document_id}")
        document.status = "active"
        document.updated_by = actor
        document.updated_at = datetime.utcnow()
        _log(db, "publish", actor, document, document.current_version_id)
        db.commit()
        db.refresh(document)
    finally:
        db.close()

    embed_result = embed_document(document_id, actor)
    index_result = rebuild_index(actor)
    db = new_session()
    try:
        refreshed = db.get(KnowledgeDocument, document_id)
        payload = _document_payload(db, refreshed)
        payload["embed_result"] = embed_result
        payload["index_result"] = index_result
        return payload
    finally:
        db.close()


def archive_document(document_id: str, actor: str = "system") -> dict:
    db = new_session()
    try:
        document = db.get(KnowledgeDocument, document_id)
        if not document or document.status == "deleted":
            raise FileNotFoundError(f"knowledge document not found: {document_id}")
        document.status = "archived"
        document.updated_by = actor
        document.updated_at = datetime.utcnow()
        _log(db, "archive", actor, document, document.current_version_id)
        db.commit()
        db.refresh(document)
    finally:
        db.close()

    index_result = rebuild_index(actor)
    db = new_session()
    try:
        refreshed = db.get(KnowledgeDocument, document_id)
        payload = _document_payload(db, refreshed)
        payload["index_result"] = index_result
        return payload
    finally:
        db.close()


def delete_document(document_id: str, actor: str = "system") -> dict:
    """Soft delete an admin uploaded knowledge document and rebuild the vector index."""
    db = new_session()
    try:
        document = db.get(KnowledgeDocument, document_id)
        if not document:
            raise FileNotFoundError(f"knowledge document not found: {document_id}")
        document.status = "deleted"
        document.deleted_at = datetime.utcnow()
        document.updated_by = actor
        document.updated_at = datetime.utcnow()
        _log(db, "delete", actor, document, document.current_version_id)
        db.commit()
        db.refresh(document)
    finally:
        db.close()

    index_result = rebuild_index(actor)
    db = new_session()
    try:
        refreshed = db.get(KnowledgeDocument, document_id)
        payload = _document_payload(db, refreshed)
        payload["index_result"] = index_result
        return payload
    finally:
        db.close()


def list_documents(status: str = "all") -> list[dict]:
    if status not in VALID_STATUSES:
        raise ValueError(f"invalid knowledge document status: {status}")
    db = new_session()
    try:
        query = db.query(KnowledgeDocument).order_by(KnowledgeDocument.updated_at.desc())
        if status != "all":
            query = query.filter(KnowledgeDocument.status == status)
        return [_document_payload(db, document) for document in query.all()]
    finally:
        db.close()


def list_versions(document_id: str) -> list[dict]:
    db = new_session()
    try:
        document = db.get(KnowledgeDocument, document_id)
        if not document:
            raise FileNotFoundError(f"knowledge document not found: {document_id}")
        versions = (
            db.query(KnowledgeDocumentVersion)
            .filter(KnowledgeDocumentVersion.document_id == document_id)
            .order_by(KnowledgeDocumentVersion.version.desc())
            .all()
        )
        return [
            {
                "id": version.id,
                "document_id": version.document_id,
                "version": version.version,
                "title": version.title,
                "file_name": version.file_name,
                "storage_path": version.storage_path,
                "content_hash": version.content_hash,
                "change_note": version.change_note,
                "created_by": version.created_by,
                "created_at": version.created_at.isoformat(timespec="seconds"),
                "is_current": version.id == document.current_version_id,
                "chunk_count": count_document_chunks(document_id, version.id),
                "enabled_chunk_count": count_document_chunks(document_id, version.id, enabled_only=True),
            }
            for version in versions
        ]
    finally:
        db.close()


def list_history(document_id: str) -> list[dict]:
    db = new_session()
    try:
        if not db.get(KnowledgeDocument, document_id):
            raise FileNotFoundError(f"knowledge document not found: {document_id}")
        logs = (
            db.query(KnowledgeOperationLog)
            .filter(KnowledgeOperationLog.document_id == document_id)
            .order_by(KnowledgeOperationLog.created_at.desc())
            .all()
        )
        return [
            {
                "id": item.id,
                "document_id": item.document_id,
                "version_id": item.version_id,
                "action": item.action,
                "actor": item.actor,
                "detail": json.loads(item.detail or "{}"),
                "created_at": item.created_at.isoformat(timespec="seconds"),
            }
            for item in logs
        ]
    finally:
        db.close()


def search_test(query: str) -> dict:
    return {
        "query": query,
        "vector_backend": vector_backend_name(),
        "chunks": retrieve_context(query),
    }


def migrate_existing_admin_documents(actor: str = "system") -> None:
    """Import legacy files under data/admin_knowledge as active documents once."""
    if not ADMIN_KNOWLEDGE_DIR.exists():
        return
    db = new_session()
    try:
        existing_paths = {version.storage_path for version in db.query(KnowledgeDocumentVersion).all()}
    finally:
        db.close()
    for path in sorted(ADMIN_KNOWLEDGE_DIR.glob("*")):
        if path.is_dir() or path.name == ".gitkeep" or path.suffix.lower() not in SUPPORTED_UPLOAD_SUFFIXES:
            continue
        relative = _relative_path(path)
        if relative in existing_paths:
            continue
        save_document(path.name, path.read_bytes(), path.stem, actor=actor, status="active")
