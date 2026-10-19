CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS admin_user (
    id VARCHAR(32) PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    role VARCHAR(40) DEFAULT 'admin',
    enabled BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_admin_user_username ON admin_user(username);

CREATE TABLE IF NOT EXISTS scenic_spot (
    id INT PRIMARY KEY,
    name VARCHAR(120) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    guide_text TEXT DEFAULT '',
    map_x DOUBLE PRECISION DEFAULT 0,
    map_y DOUBLE PRECISION DEFAULT 0,
    tags_json JSONB DEFAULT '[]'::jsonb,
    recommended_duration INT DEFAULT 10,
    popularity_score DOUBLE PRECISION DEFAULT 0.5,
    culture_score DOUBLE PRECISION DEFAULT 0.5,
    nature_score DOUBLE PRECISION DEFAULT 0.5,
    photo_score DOUBLE PRECISION DEFAULT 0.5,
    facility_score DOUBLE PRECISION DEFAULT 0.5,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_scenic_spot_enabled ON scenic_spot(enabled);

CREATE TABLE IF NOT EXISTS facility (
    id INT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(40) NOT NULL,
    map_x DOUBLE PRECISION DEFAULT 0,
    map_y DOUBLE PRECISION DEFAULT 0,
    service_radius INT DEFAULT 10,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_facility_type ON facility(type);
CREATE INDEX IF NOT EXISTS ix_facility_enabled ON facility(enabled);

CREATE TABLE IF NOT EXISTS visitor_session (
    id VARCHAR(32) PRIMARY KEY,
    session_uuid VARCHAR(64) UNIQUE NOT NULL,
    device_type VARCHAR(40) DEFAULT 'web',
    visitor_type VARCHAR(40) DEFAULT 'anonymous',
    user_profile JSONB DEFAULT '{}'::jsonb,
    start_location JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_visitor_session_session_uuid ON visitor_session(session_uuid);

CREATE TABLE IF NOT EXISTS chat_message (
    id VARCHAR(32) PRIMARY KEY,
    session_uuid VARCHAR(64) NOT NULL REFERENCES visitor_session(session_uuid) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    intent VARCHAR(60) DEFAULT 'scenic_qa',
    latency_ms INT DEFAULT 0,
    references_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_chat_message_session_uuid ON chat_message(session_uuid);
CREATE INDEX IF NOT EXISTS ix_chat_message_role ON chat_message(role);
CREATE INDEX IF NOT EXISTS ix_chat_message_intent ON chat_message(intent);
CREATE INDEX IF NOT EXISTS ix_chat_message_created_at ON chat_message(created_at);

CREATE TABLE IF NOT EXISTS route_plan (
    id VARCHAR(32) PRIMARY KEY,
    session_uuid VARCHAR(64) NOT NULL,
    route_name VARCHAR(160) NOT NULL,
    interest_tags JSONB DEFAULT '[]'::jsonb,
    spot_ids JSONB DEFAULT '[]'::jsonb,
    total_duration INT DEFAULT 0,
    score_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_route_plan_session_uuid ON route_plan(session_uuid);
CREATE INDEX IF NOT EXISTS ix_route_plan_created_at ON route_plan(created_at);

CREATE TABLE IF NOT EXISTS knowledge_base (
    id VARCHAR(32) PRIMARY KEY,
    code VARCHAR(80) UNIQUE NOT NULL DEFAULT 'default',
    name VARCHAR(120) DEFAULT '灵山景区知识库',
    description TEXT DEFAULT '景区 FAQ、景点资料、后台上传资料和公开资料包的统一知识库。',
    vector_backend VARCHAR(40) DEFAULT 'pgvector',
    embedding_model VARCHAR(120) DEFAULT 'hash_token_256',
    embedding_dimension INT DEFAULT 256,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_knowledge_base_code ON knowledge_base(code);
CREATE INDEX IF NOT EXISTS ix_knowledge_base_enabled ON knowledge_base(enabled);

CREATE TABLE IF NOT EXISTS knowledge_document (
    id VARCHAR(32) PRIMARY KEY,
    knowledge_base_id VARCHAR(32) NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    current_version INT DEFAULT 1,
    current_version_id VARCHAR(32),
    storage_path TEXT NOT NULL,
    created_by VARCHAR(80) DEFAULT 'system',
    updated_by VARCHAR(80) DEFAULT 'system',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_knowledge_document_knowledge_base_id ON knowledge_document(knowledge_base_id);
CREATE INDEX IF NOT EXISTS ix_knowledge_document_status ON knowledge_document(status);

CREATE TABLE IF NOT EXISTS knowledge_document_version (
    id VARCHAR(32) PRIMARY KEY,
    document_id VARCHAR(32) NOT NULL REFERENCES knowledge_document(id) ON DELETE CASCADE,
    version INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    change_note TEXT DEFAULT '',
    created_by VARCHAR(80) DEFAULT 'system',
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_knowledge_document_version UNIQUE(document_id, version)
);

CREATE INDEX IF NOT EXISTS ix_knowledge_document_version_document_id ON knowledge_document_version(document_id);

CREATE TABLE IF NOT EXISTS knowledge_operation_log (
    id VARCHAR(32) PRIMARY KEY,
    document_id VARCHAR(32) REFERENCES knowledge_document(id) ON DELETE SET NULL,
    version_id VARCHAR(32),
    action VARCHAR(40) NOT NULL,
    actor VARCHAR(80) DEFAULT 'system',
    detail TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_knowledge_operation_log_document_id ON knowledge_operation_log(document_id);

CREATE TABLE IF NOT EXISTS knowledge_chunk (
    id VARCHAR(32) PRIMARY KEY,
    knowledge_base_id VARCHAR(32) NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    document_id VARCHAR(32) REFERENCES knowledge_document(id) ON DELETE CASCADE,
    version_id VARCHAR(32) REFERENCES knowledge_document_version(id) ON DELETE CASCADE,
    chunk_id VARCHAR(120) UNIQUE NOT NULL,
    chunk_index INT DEFAULT 1,
    source TEXT NOT NULL,
    category VARCHAR(80) NOT NULL,
    title VARCHAR(200) NOT NULL,
    text TEXT NOT NULL,
    token_count INT DEFAULT 0,
    embedding_payload JSONB DEFAULT '[]'::jsonb,
    embedding vector(256),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_knowledge_chunk_version_index UNIQUE(version_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS ix_knowledge_chunk_knowledge_base_id ON knowledge_chunk(knowledge_base_id);
CREATE INDEX IF NOT EXISTS ix_knowledge_chunk_document_id ON knowledge_chunk(document_id);
CREATE INDEX IF NOT EXISTS ix_knowledge_chunk_version_id ON knowledge_chunk(version_id);
CREATE INDEX IF NOT EXISTS ix_knowledge_chunk_category ON knowledge_chunk(category);
CREATE INDEX IF NOT EXISTS ix_knowledge_chunk_enabled ON knowledge_chunk(enabled);
CREATE INDEX IF NOT EXISTS ix_knowledge_chunk_embedding_hnsw ON knowledge_chunk USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS avatar_config (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) DEFAULT '灵灵',
    avatar_style VARCHAR(100) DEFAULT 'ancient',
    clothes VARCHAR(100) DEFAULT 'traditional_blue',
    voice_name VARCHAR(100) DEFAULT 'female_warm',
    voice_speed DOUBLE PRECISION DEFAULT 1.0,
    opening_text TEXT DEFAULT '您好，我是您的 AI 数字人导游灵灵。',
    expressions_json TEXT DEFAULT '["idle","listening","thinking","speaking","happy","concerned"]',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_avatar_config_enabled ON avatar_config(enabled);

CREATE TABLE IF NOT EXISTS visitor_spot_rating (
    id VARCHAR(32) PRIMARY KEY,
    session_uuid VARCHAR(64) NOT NULL,
    spot_id INT NOT NULL REFERENCES scenic_spot(id) ON DELETE CASCADE,
    overall_rating INT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    culture_rating INT CHECK (culture_rating BETWEEN 1 AND 5),
    nature_rating INT CHECK (nature_rating BETWEEN 1 AND 5),
    photo_rating INT CHECK (photo_rating BETWEEN 1 AND 5),
    facility_rating INT CHECK (facility_rating BETWEEN 1 AND 5),
    comment TEXT,
    user_tags JSONB DEFAULT '[]'::jsonb,
    visit_date TIMESTAMP,
    weather_condition VARCHAR(40),
    crowd_level VARCHAR(40),
    is_public BOOLEAN DEFAULT FALSE,
    user_profile_snapshot JSONB DEFAULT '{}'::jsonb,
    review_status VARCHAR(30) DEFAULT 'approved',
    sentiment VARCHAR(30) DEFAULT 'neutral',
    sentiment_score DOUBLE PRECISION DEFAULT 0,
    source VARCHAR(50) DEFAULT 'visitor_page',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_visitor_spot_rating UNIQUE(session_uuid, spot_id)
);

CREATE INDEX IF NOT EXISTS ix_visitor_spot_rating_session_uuid ON visitor_spot_rating(session_uuid);
CREATE INDEX IF NOT EXISTS ix_visitor_spot_rating_spot_id ON visitor_spot_rating(spot_id);
CREATE INDEX IF NOT EXISTS ix_visitor_spot_rating_is_public ON visitor_spot_rating(is_public);
CREATE INDEX IF NOT EXISTS ix_visitor_spot_rating_sentiment ON visitor_spot_rating(sentiment);
CREATE INDEX IF NOT EXISTS ix_visitor_spot_rating_created_at ON visitor_spot_rating(created_at);
CREATE INDEX IF NOT EXISTS ix_visitor_spot_rating_user_tags ON visitor_spot_rating USING GIN(user_tags);
