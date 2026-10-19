from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree

from sqlalchemy import literal
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import init_db, new_session
from app.models.persistence import KnowledgeBase, KnowledgeChunk, KnowledgeDocument, KnowledgeDocumentVersion, PgVector, new_id


ROOT_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT_DIR / "data"
VECTOR_DB_DIR = DATA_DIR / "vector_db"
VECTOR_STORE_PATH = ROOT_DIR / settings.vector_db_path
ADMIN_KNOWLEDGE_DIR = DATA_DIR / "admin_knowledge"
VECTOR_DIMENSION = settings.pgvector_dimension
DEFAULT_KNOWLEDGE_BASE_ID = settings.default_knowledge_base_id


@dataclass
class KnowledgeEntry:
    id: str
    text: str
    source: str
    category: str
    title: str


def tokenize(text: str) -> list[str]:
    normalized = text.lower()
    words = re.findall(r"[a-z0-9_]+", normalized)
    chinese_chars = re.findall(r"[\u4e00-\u9fff]", normalized)
    chinese_bigrams = [
        "".join(chinese_chars[index : index + 2])
        for index in range(max(len(chinese_chars) - 1, 0))
    ]
    return words + chinese_chars + chinese_bigrams


def vectorize(text: str, dimension: int = VECTOR_DIMENSION) -> list[float]:
    vector = [0.0] * dimension
    for token in tokenize(text):
        digest = hashlib.md5(token.encode("utf-8")).hexdigest()
        index = int(digest[:8], 16) % dimension
        vector[index] += 1.0
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def chunk_text(text: str, chunk_size: int = 420, overlap: int = 80) -> Iterable[str]:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return
    start = 0
    while start < len(compact):
        yield compact[start : start + chunk_size]
        if start + chunk_size >= len(compact):
            break
        start += chunk_size - overlap


def vector_backend_name() -> str:
    return "pgvector"


def load_faq_entries() -> list[KnowledgeEntry]:
    path = DATA_DIR / "faq.csv"
    if not path.exists():
        return []
    entries: list[KnowledgeEntry] = []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            text = f"问题：{row.get('question', '')}\n答案：{row.get('answer', '')}\n关键词：{row.get('keywords', '')}"
            entries.append(
                KnowledgeEntry(
                    id=f"faq_{row.get('id')}",
                    text=text,
                    source="data/faq.csv",
                    category=row.get("category", "faq"),
                    title=row.get("question", "FAQ"),
                )
            )
    return entries


def load_spot_entries() -> list[KnowledgeEntry]:
    path = DATA_DIR / "scenic_spots.csv"
    if not path.exists():
        return []
    entries: list[KnowledgeEntry] = []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            text = (
                f"景点：{row.get('name', '')}\n"
                f"标签：{row.get('tags', '')}\n"
                f"建议游览：{row.get('recommended_duration', '')} 分钟\n"
                f"地图坐标：x={row.get('map_x', '')}, y={row.get('map_y', '')}\n"
                f"介绍：{row.get('description', '')}"
            )
            entries.append(
                KnowledgeEntry(
                    id=f"spot_{row.get('id')}",
                    text=text,
                    source="data/scenic_spots.csv",
                    category="scenic_spot",
                    title=row.get("name", "景点"),
                )
            )
    return entries


def load_raw_document_entries() -> list[KnowledgeEntry]:
    raw_dir = DATA_DIR / "raw_documents"
    if not raw_dir.exists():
        return []
    entries: list[KnowledgeEntry] = []
    for path in sorted(raw_dir.glob("*")):
        if path.suffix.lower() not in {".md", ".txt"}:
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        for index, chunk in enumerate(chunk_text(content), start=1):
            entries.append(
                KnowledgeEntry(
                    id=f"doc_{path.stem}_{index}",
                    text=chunk,
                    source=f"data/raw_documents/{path.name}",
                    category="guide_document",
                    title=f"{path.stem}#{index}",
                )
            )
    return entries


def read_supported_document(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".md", ".txt", ".csv", ".json"}:
        return path.read_text(encoding="utf-8", errors="ignore")
    if suffix == ".docx":
        return extract_docx_text(path)
    if suffix == ".xlsx":
        return extract_xlsx_text(path)
    return ""


def load_admin_document_entries() -> list[KnowledgeEntry]:
    try:
        init_db()
        db = new_session()
        try:
            active_documents = db.query(KnowledgeDocument).filter(KnowledgeDocument.status == "active").all()
            entries: list[KnowledgeEntry] = []
            for document in active_documents:
                version = db.get(KnowledgeDocumentVersion, document.current_version_id) if document.current_version_id else None
                if not version:
                    continue
                path = ROOT_DIR / version.storage_path
                if not path.exists() or path.suffix.lower() not in {".md", ".txt", ".csv", ".json", ".docx", ".xlsx"}:
                    continue
                content = read_supported_document(path)
                for index, chunk in enumerate(chunk_text(content, chunk_size=520, overlap=100), start=1):
                    entries.append(
                        KnowledgeEntry(
                            id=f"admin_{document.id}_{version.version}_{index}",
                            text=chunk,
                            source=version.storage_path,
                            category="admin_knowledge",
                            title=f"{document.title} v{version.version}#{index}",
                        )
                    )
            return entries
        finally:
            db.close()
    except Exception:
        pass

    if not ADMIN_KNOWLEDGE_DIR.exists():
        return []
    entries: list[KnowledgeEntry] = []
    for path in sorted(ADMIN_KNOWLEDGE_DIR.glob("*")):
        if path.suffix.lower() not in {".md", ".txt", ".csv", ".json", ".docx", ".xlsx"}:
            continue
        content = read_supported_document(path)
        for index, chunk in enumerate(chunk_text(content, chunk_size=520, overlap=100), start=1):
            entries.append(
                KnowledgeEntry(
                    id=f"admin_{path.stem}_{index}",
                    text=chunk,
                    source=f"data/admin_knowledge/{path.name}",
                    category="admin_knowledge",
                    title=f"{path.stem}#{index}",
                )
            )
    return entries


def xml_text(path: Path, member: str) -> str:
    with zipfile.ZipFile(path) as archive:
        if member not in archive.namelist():
            return ""
        xml = archive.read(member)
    root = ElementTree.fromstring(xml)
    return "\n".join(node.text or "" for node in root.iter() if node.text)


def extract_docx_text(path: Path) -> str:
    return xml_text(path, "word/document.xml")


def extract_xlsx_text(path: Path, max_cells: int = 2500) -> str:
    texts: list[str] = []
    collected = 0
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in names:
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = ["".join(node.itertext()) for node in root]
        sheet_names = [name for name in names if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")]
        for sheet_name in sheet_names:
            root = ElementTree.fromstring(archive.read(sheet_name))
            values = []
            for cell in root.iter():
                if collected >= max_cells:
                    break
                if not cell.tag.endswith("}c"):
                    continue
                cell_type = cell.attrib.get("t")
                value_node = next((child for child in cell if child.tag.endswith("}v")), None)
                if value_node is None or value_node.text is None:
                    inline_text = "".join(cell.itertext()).strip()
                    if inline_text:
                        values.append(inline_text)
                        collected += 1
                    continue
                if cell_type == "s" and shared_strings:
                    index = int(value_node.text)
                    if 0 <= index < len(shared_strings):
                        values.append(shared_strings[index])
                        collected += 1
                elif re.search(r"[\u4e00-\u9fffA-Za-z]", value_node.text):
                    values.append(value_node.text)
                    collected += 1
            if values:
                texts.append("\n".join(values))
    return "\n\n".join(texts)


def load_scenic_pack_entries() -> list[KnowledgeEntry]:
    pack_dir = ROOT_DIR / "灵山" / "示范景区公开资料包"
    if not pack_dir.exists():
        return []
    entries: list[KnowledgeEntry] = []
    for path in sorted(pack_dir.glob("*")):
        if path.suffix.lower() == ".docx":
            content = extract_docx_text(path)
            category = "scenic_pack"
        elif path.suffix.lower() == ".xlsx":
            content = extract_xlsx_text(path)
            category = "behavior_data"
        else:
            continue
        for index, chunk in enumerate(chunk_text(content, chunk_size=520, overlap=100), start=1):
            entries.append(
                KnowledgeEntry(
                    id=f"pack_{path.stem}_{index}",
                    text=chunk,
                    source=f"灵山/示范景区公开资料包/{path.name}",
                    category=category,
                    title=f"{path.stem}#{index}",
                )
            )
    return entries


def load_static_knowledge_entries() -> list[KnowledgeEntry]:
    return load_faq_entries() + load_spot_entries() + load_raw_document_entries() + load_scenic_pack_entries()


def load_knowledge_entries() -> list[KnowledgeEntry]:
    return load_static_knowledge_entries() + load_admin_document_entries()


def ensure_default_knowledge_base(db: Session | None = None) -> KnowledgeBase:
    owns_session = db is None
    db = db or new_session()
    try:
        knowledge_base = db.query(KnowledgeBase).filter(KnowledgeBase.code == DEFAULT_KNOWLEDGE_BASE_ID).first()
        if knowledge_base:
            knowledge_base.vector_backend = vector_backend_name()
            knowledge_base.embedding_dimension = VECTOR_DIMENSION
            knowledge_base.updated_at = datetime.utcnow()
            db.flush()
            return knowledge_base
        knowledge_base = KnowledgeBase(
            code=DEFAULT_KNOWLEDGE_BASE_ID,
            name="灵山景区知识库",
            description="景区 FAQ、景点资料、后台上传资料和公开资料包的统一知识库。",
            vector_backend=vector_backend_name(),
            embedding_model=f"hash_token_{VECTOR_DIMENSION}",
            embedding_dimension=VECTOR_DIMENSION,
            enabled=True,
        )
        db.add(knowledge_base)
        db.flush()
        return knowledge_base
    finally:
        if owns_session:
            db.commit()
            db.close()


def _row_to_hit(row: KnowledgeChunk, query_vector: list[float], query: str) -> dict:
    embedding = list(row.embedding_payload or [])
    score = cosine_similarity(query_vector, embedding)
    if query and query in row.text:
        score += 0.25
    return {
        "chunk_id": row.chunk_id,
        "source": row.source,
        "category": row.category,
        "title": row.title,
        "text": row.text,
        "score": round(score, 4),
    }


def _persist_static_entries(db: Session, knowledge_base_id: str, entries: list[KnowledgeEntry]) -> int:
    db.query(KnowledgeChunk).filter(
        KnowledgeChunk.knowledge_base_id == knowledge_base_id,
        KnowledgeChunk.document_id.is_(None),
    ).delete(synchronize_session=False)
    for index, entry in enumerate(entries, start=1):
        embedding = vectorize(entry.text)
        db.add(
            KnowledgeChunk(
                id=new_id(),
                knowledge_base_id=knowledge_base_id,
                document_id=None,
                version_id=None,
                chunk_id=entry.id,
                chunk_index=index,
                source=entry.source,
                category=entry.category,
                title=entry.title,
                text=entry.text,
                token_count=len(tokenize(entry.text)),
                embedding_payload=embedding,
                embedding=embedding,
                enabled=True,
            )
        )
    return len(entries)


def _document_version_chunks(document: KnowledgeDocument, version: KnowledgeDocumentVersion) -> list[KnowledgeEntry]:
    path = ROOT_DIR / version.storage_path
    if not path.exists() or path.suffix.lower() not in {".md", ".txt", ".csv", ".json", ".docx", ".xlsx"}:
        return []
    content = read_supported_document(path)
    return [
        KnowledgeEntry(
            id=f"admin_{document.id}_{version.version}_{index}",
            text=chunk,
            source=version.storage_path,
            category="admin_knowledge",
            title=f"{document.title} v{version.version}#{index}",
        )
        for index, chunk in enumerate(chunk_text(content, chunk_size=520, overlap=100), start=1)
    ]


def _upsert_document_version_chunks(
    db: Session,
    knowledge_base_id: str,
    document: KnowledgeDocument,
    version: KnowledgeDocumentVersion,
    enabled: bool,
) -> int:
    db.query(KnowledgeChunk).filter(KnowledgeChunk.version_id == version.id).delete(synchronize_session=False)
    entries = _document_version_chunks(document, version)
    for index, entry in enumerate(entries, start=1):
        embedding = vectorize(entry.text)
        db.add(
            KnowledgeChunk(
                id=new_id(),
                knowledge_base_id=knowledge_base_id,
                document_id=document.id,
                version_id=version.id,
                chunk_id=entry.id,
                chunk_index=index,
                source=entry.source,
                category=entry.category,
                title=entry.title,
                text=entry.text,
                token_count=len(tokenize(entry.text)),
                embedding_payload=embedding,
                embedding=embedding,
                enabled=enabled,
            )
        )
    return len(entries)


def _sync_document_chunk_flags(db: Session, document: KnowledgeDocument) -> int:
    enabled_count = 0
    for row in db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == document.id).all():
        row.enabled = document.status == "active" and row.version_id == document.current_version_id
        row.updated_at = datetime.utcnow()
        if row.enabled:
            enabled_count += 1
    return enabled_count


def embed_document(document_id: str) -> dict:
    init_db()
    db = new_session()
    try:
        knowledge_base = ensure_default_knowledge_base(db)
        document = db.get(KnowledgeDocument, document_id)
        if not document or document.status == "deleted":
            raise FileNotFoundError(f"knowledge document not found: {document_id}")
        version = db.get(KnowledgeDocumentVersion, document.current_version_id) if document.current_version_id else None
        if not version:
            raise FileNotFoundError(f"knowledge document has no current version: {document_id}")
        chunk_count = _upsert_document_version_chunks(
            db,
            knowledge_base.id,
            document,
            version,
            enabled=document.status == "active",
        )
        enabled_chunk_count = _sync_document_chunk_flags(db, document)
        db.commit()
        return {
            "knowledge_base_id": knowledge_base.code,
            "document_id": document.id,
            "version_id": version.id,
            "version": version.version,
            "chunk_count": chunk_count,
            "enabled_chunk_count": enabled_chunk_count,
            "vector_backend": vector_backend_name(),
        }
    finally:
        db.close()


def build_knowledge_base(output_path: Path = VECTOR_STORE_PATH) -> dict:
    init_db()
    db = new_session()
    try:
        knowledge_base = ensure_default_knowledge_base(db)
        static_entry_count = _persist_static_entries(db, knowledge_base.id, load_static_knowledge_entries())
        documents = db.query(KnowledgeDocument).all()
        embedded_document_count = 0
        for document in documents:
            version = db.get(KnowledgeDocumentVersion, document.current_version_id) if document.current_version_id else None
            if version:
                has_current_chunks = (
                    db.query(KnowledgeChunk)
                    .filter(KnowledgeChunk.version_id == version.id)
                    .count()
                )
                if has_current_chunks == 0:
                    _upsert_document_version_chunks(
                        db,
                        knowledge_base.id,
                        document,
                        version,
                        enabled=document.status == "active",
                    )
                    embedded_document_count += 1
            _sync_document_chunk_flags(db, document)
        db.commit()
        payload = load_vector_store(output_path=output_path, rebuild=False)
        return {
            "path": str(output_path),
            "knowledge_base_id": knowledge_base.code,
            "vector_backend": vector_backend_name(),
            "entry_count": payload["entry_count"],
            "static_entry_count": static_entry_count,
            "embedded_document_count": embedded_document_count,
            "active_chunk_count": payload["entry_count"],
        }
    finally:
        db.close()


def _retrieve_pgvector_chunks(
    db: Session,
    knowledge_base_id: str,
    query_vector: list[float],
    query: str,
    top_k: int,
) -> list[dict]:
    rows = (
        db.query(KnowledgeChunk)
        .filter(
            KnowledgeChunk.knowledge_base_id == knowledge_base_id,
            KnowledgeChunk.enabled.is_(True),
        )
        .order_by(
            KnowledgeChunk.embedding.op("<=>")(
                literal(query_vector, type_=PgVector(VECTOR_DIMENSION))
            )
        )
        .limit(max(top_k * 4, 12))
        .all()
    )
    scored = [_row_to_hit(row, query_vector, query) for row in rows]
    scored.sort(key=lambda item: item["score"], reverse=True)
    return [item for item in scored[:top_k] if item["score"] > 0]


def load_vector_store(path: Path = VECTOR_STORE_PATH, output_path: Path | None = None, rebuild: bool = True) -> dict:
    if rebuild:
        build_knowledge_base(path)
    init_db()
    db = new_session()
    try:
        knowledge_base = ensure_default_knowledge_base(db)
        entries = []
        for row in (
            db.query(KnowledgeChunk)
            .filter(
                KnowledgeChunk.knowledge_base_id == knowledge_base.id,
                KnowledgeChunk.enabled.is_(True),
            )
            .order_by(KnowledgeChunk.source.asc(), KnowledgeChunk.chunk_index.asc())
            .all()
        ):
            entries.append(
                {
                    "id": row.chunk_id,
                    "text": row.text,
                    "source": row.source,
                    "category": row.category,
                    "title": row.title,
                    "vector": list(row.embedding_payload or []),
                }
            )
        payload = {
            "version": 2,
            "dimension": VECTOR_DIMENSION,
            "vector_backend": vector_backend_name(),
            "knowledge_base_id": knowledge_base.code,
            "entry_count": len(entries),
            "entries": entries,
        }
        target = output_path or path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return payload
    finally:
        db.close()


def retrieve_context(query: str, top_k: int = 5) -> list[dict]:
    init_db()
    query_vector = vectorize(query)
    db = new_session()
    try:
        knowledge_base = ensure_default_knowledge_base(db)
        active_chunk_count = (
            db.query(KnowledgeChunk)
            .filter(
                KnowledgeChunk.knowledge_base_id == knowledge_base.id,
                KnowledgeChunk.enabled.is_(True),
            )
            .count()
        )
        if active_chunk_count == 0:
            db.close()
            build_knowledge_base()
            db = new_session()
            knowledge_base = ensure_default_knowledge_base(db)
        return _retrieve_pgvector_chunks(db, knowledge_base.id, query_vector, query, top_k)
    finally:
        db.close()


def list_knowledge_bases() -> list[dict]:
    init_db()
    db = new_session()
    try:
        ensure_default_knowledge_base(db)
        db.commit()
        rows = db.query(KnowledgeBase).order_by(KnowledgeBase.created_at.asc()).all()
        result = []
        for row in rows:
            document_count = db.query(KnowledgeDocument).filter(KnowledgeDocument.knowledge_base_id == row.id).count()
            active_document_count = (
                db.query(KnowledgeDocument)
                .filter(
                    KnowledgeDocument.knowledge_base_id == row.id,
                    KnowledgeDocument.status == "active",
                )
                .count()
            )
            active_chunk_count = (
                db.query(KnowledgeChunk)
                .filter(
                    KnowledgeChunk.knowledge_base_id == row.id,
                    KnowledgeChunk.enabled.is_(True),
                )
                .count()
            )
            result.append(
                {
                    "id": row.code,
                    "db_id": row.id,
                    "name": row.name,
                    "description": row.description,
                    "vector_backend": row.vector_backend,
                    "embedding_model": row.embedding_model,
                    "embedding_dimension": row.embedding_dimension,
                    "document_count": document_count,
                    "active_document_count": active_document_count,
                    "active_chunk_count": active_chunk_count,
                }
            )
        return result
    finally:
        db.close()


def count_document_chunks(document_id: str, version_id: str | None = None, enabled_only: bool = False) -> int:
    init_db()
    db = new_session()
    try:
        query = db.query(KnowledgeChunk).filter(KnowledgeChunk.document_id == document_id)
        if version_id:
            query = query.filter(KnowledgeChunk.version_id == version_id)
        if enabled_only:
            query = query.filter(KnowledgeChunk.enabled.is_(True))
        return query.count()
    finally:
        db.close()
