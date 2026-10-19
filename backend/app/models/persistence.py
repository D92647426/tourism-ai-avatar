from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import UserDefinedType

from app.core.database import Base
from app.core.config import settings


def new_id() -> str:
    return uuid4().hex


class PgVector(UserDefinedType):
    cache_ok = True

    def __init__(self, dimension: int):
        self.dimension = dimension

    def get_col_spec(self, **kw) -> str:
        return f"vector({self.dimension})"

    def bind_processor(self, dialect):
        def process(value):
            if value is None:
                return None
            return "[" + ",".join(f"{float(item):.12g}" for item in value) + "]"

        return process

    def result_processor(self, dialect, coltype):
        def process(value):
            if value is None or isinstance(value, list):
                return value
            stripped = value.strip("[]")
            if not stripped:
                return []
            return [float(item) for item in stripped.split(",")]

        return process


EMBEDDING_DIMENSION = settings.pgvector_dimension
EmbeddingType = PgVector(EMBEDDING_DIMENSION)


class AdminUser(Base):
    __tablename__ = "admin_user"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(40), default="admin")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ScenicSpot(Base):
    """Persisted scenic spot catalog used by routes, ratings and analytics."""

    __tablename__ = "scenic_spot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    guide_text: Mapped[str] = mapped_column(Text, default="")
    map_x: Mapped[float] = mapped_column(Float, default=0)
    map_y: Mapped[float] = mapped_column(Float, default=0)
    tags_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    recommended_duration: Mapped[int] = mapped_column(Integer, default=10)
    popularity_score: Mapped[float] = mapped_column(Float, default=0.5)
    culture_score: Mapped[float] = mapped_column(Float, default=0.5)
    nature_score: Mapped[float] = mapped_column(Float, default=0.5)
    photo_score: Mapped[float] = mapped_column(Float, default=0.5)
    facility_score: Mapped[float] = mapped_column(Float, default=0.5)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ratings: Mapped[list["VisitorSpotRating"]] = relationship("VisitorSpotRating", back_populates="spot")


class Facility(Base):
    """Persisted service facility catalog for maps and nearby queries."""

    __tablename__ = "facility"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)
    map_x: Mapped[float] = mapped_column(Float, default=0)
    map_y: Mapped[float] = mapped_column(Float, default=0)
    service_radius: Mapped[int] = mapped_column(Integer, default=10)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VisitorSession(Base):
    """Anonymous visitor session for personalization and analytics."""

    __tablename__ = "visitor_session"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    session_uuid: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    device_type: Mapped[str] = mapped_column(String(40), default="web")
    visitor_type: Mapped[str] = mapped_column(String(40), default="anonymous")
    user_profile: Mapped[dict] = mapped_column(JSON, default=dict)
    start_location: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    messages: Mapped[list["ChatMessage"]] = relationship("ChatMessage", back_populates="session")


class ChatMessage(Base):
    """Persisted visitor question/answer message for dashboard aggregation."""

    __tablename__ = "chat_message"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    session_uuid: Mapped[str] = mapped_column(ForeignKey("visitor_session.session_uuid"), index=True)
    role: Mapped[str] = mapped_column(String(20), index=True)
    content: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(60), default="scenic_qa", index=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    references_json: Mapped[list[dict]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped[VisitorSession] = relationship("VisitorSession", back_populates="messages")


class RoutePlan(Base):
    """Persisted generated route summary for personalization and analytics."""

    __tablename__ = "route_plan"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    session_uuid: Mapped[str] = mapped_column(String(64), index=True)
    route_name: Mapped[str] = mapped_column(String(160))
    interest_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    spot_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    total_duration: Mapped[int] = mapped_column(Integer, default=0)
    score_summary: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_document"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    knowledge_base_id: Mapped[str] = mapped_column(ForeignKey("knowledge_base.id"), default=settings.default_knowledge_base_id, index=True)
    title: Mapped[str] = mapped_column(String(200))
    file_name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    current_version_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    storage_path: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(80), default="system")
    updated_by: Mapped[str] = mapped_column(String(80), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    versions: Mapped[list["KnowledgeDocumentVersion"]] = relationship(
        "KnowledgeDocumentVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        foreign_keys="KnowledgeDocumentVersion.document_id",
    )
    logs: Mapped[list["KnowledgeOperationLog"]] = relationship(
        "KnowledgeOperationLog",
        back_populates="document",
        cascade="all, delete-orphan",
        foreign_keys="KnowledgeOperationLog.document_id",
    )
    knowledge_base: Mapped["KnowledgeBase"] = relationship("KnowledgeBase", back_populates="documents")
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        "KnowledgeChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        foreign_keys="KnowledgeChunk.document_id",
    )


class KnowledgeDocumentVersion(Base):
    __tablename__ = "knowledge_document_version"
    __table_args__ = (UniqueConstraint("document_id", "version", name="uq_knowledge_document_version"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("knowledge_document.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    file_name: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64))
    change_note: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str] = mapped_column(String(80), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    document: Mapped[KnowledgeDocument] = relationship(
        "KnowledgeDocument",
        back_populates="versions",
        foreign_keys=[document_id],
    )
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        "KnowledgeChunk",
        back_populates="version",
        cascade="all, delete-orphan",
        foreign_keys="KnowledgeChunk.version_id",
    )


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True, default=settings.default_knowledge_base_id)
    name: Mapped[str] = mapped_column(String(120), default="灵山景区知识库")
    description: Mapped[str] = mapped_column(Text, default="景区 FAQ、景点资料、后台上传资料和公开资料包的统一知识库。")
    vector_backend: Mapped[str] = mapped_column(String(40), default="pgvector")
    embedding_model: Mapped[str] = mapped_column(String(120), default="hash_token_256")
    embedding_dimension: Mapped[int] = mapped_column(Integer, default=EMBEDDING_DIMENSION)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    documents: Mapped[list[KnowledgeDocument]] = relationship("KnowledgeDocument", back_populates="knowledge_base")
    chunks: Mapped[list["KnowledgeChunk"]] = relationship("KnowledgeChunk", back_populates="knowledge_base")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunk"
    __table_args__ = (UniqueConstraint("version_id", "chunk_index", name="uq_knowledge_chunk_version_index"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    knowledge_base_id: Mapped[str] = mapped_column(ForeignKey("knowledge_base.id"), index=True)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("knowledge_document.id"), nullable=True, index=True)
    version_id: Mapped[str | None] = mapped_column(ForeignKey("knowledge_document_version.id"), nullable=True, index=True)
    chunk_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=1)
    source: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(200))
    text: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    embedding_payload: Mapped[list[float]] = mapped_column(JSON, default=list)
    embedding: Mapped[list[float]] = mapped_column(EmbeddingType)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    knowledge_base: Mapped[KnowledgeBase] = relationship("KnowledgeBase", back_populates="chunks")
    document: Mapped[KnowledgeDocument | None] = relationship(
        "KnowledgeDocument",
        back_populates="chunks",
        foreign_keys=[document_id],
    )
    version: Mapped[KnowledgeDocumentVersion | None] = relationship(
        "KnowledgeDocumentVersion",
        back_populates="chunks",
        foreign_keys=[version_id],
    )


class KnowledgeOperationLog(Base):
    __tablename__ = "knowledge_operation_log"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    document_id: Mapped[str | None] = mapped_column(ForeignKey("knowledge_document.id"), nullable=True, index=True)
    version_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(40))
    actor: Mapped[str] = mapped_column(String(80), default="system")
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    document: Mapped[KnowledgeDocument | None] = relationship(
        "KnowledgeDocument",
        back_populates="logs",
        foreign_keys=[document_id],
    )


class AvatarConfig(Base):
    __tablename__ = "avatar_config"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(100), default="灵灵")
    avatar_style: Mapped[str] = mapped_column(String(100), default="ancient")
    clothes: Mapped[str] = mapped_column(String(100), default="traditional_blue")
    voice_name: Mapped[str] = mapped_column(String(100), default="female_warm")
    voice_speed: Mapped[float] = mapped_column(Float, default=1.0)
    opening_text: Mapped[str] = mapped_column(Text, default="您好，我是您的 AI 数字人导游灵灵。")
    expressions_json: Mapped[str] = mapped_column(Text, default='["idle","listening","thinking","speaking","happy","concerned"]')
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VisitorSpotRating(Base):
    """Visitor personalized rating for scenic spots."""

    __tablename__ = "visitor_spot_rating"
    __table_args__ = (
        UniqueConstraint("session_uuid", "spot_id", name="uq_visitor_spot_rating"),
        CheckConstraint("overall_rating BETWEEN 1 AND 5", name="ck_rating_overall_range"),
        CheckConstraint("culture_rating IS NULL OR culture_rating BETWEEN 1 AND 5", name="ck_rating_culture_range"),
        CheckConstraint("nature_rating IS NULL OR nature_rating BETWEEN 1 AND 5", name="ck_rating_nature_range"),
        CheckConstraint("photo_rating IS NULL OR photo_rating BETWEEN 1 AND 5", name="ck_rating_photo_range"),
        CheckConstraint("facility_rating IS NULL OR facility_rating BETWEEN 1 AND 5", name="ck_rating_facility_range"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    session_uuid: Mapped[str] = mapped_column(String(64), index=True)
    spot_id: Mapped[int] = mapped_column(Integer, ForeignKey("scenic_spot.id", ondelete="CASCADE"), nullable=False)
    
    # 综合评分 (1-5 分)
    overall_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # 细分维度评分 (1-5 分，可选)
    culture_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nature_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    facility_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # 文字反馈
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # 用户标签 (用于个性化推荐)
    user_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    user_profile_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # 访问时的上下文信息
    visit_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    weather_condition: Mapped[str | None] = mapped_column(String(40), nullable=True)
    crowd_level: Mapped[str | None] = mapped_column(String(40), nullable=True)
    
    # 是否公开分享
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    review_status: Mapped[str] = mapped_column(String(30), default="approved", index=True)
    sentiment: Mapped[str] = mapped_column(String(30), default="neutral", index=True)
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(String(50), default="visitor_page", index=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    spot: Mapped[ScenicSpot] = relationship("ScenicSpot", back_populates="ratings")
