# 数据结构与持久化说明

## DS-001 后台管理员表 `admin_user`

| 项目 | 内容 |
|---|---|
| 用途 | 保存后台管理员账号、PBKDF2 密码哈希、角色、启用状态和最近登录时间 |
| 模型 | [AdminUser backend/app/models/persistence.py:L51-L62](../backend/app/models/persistence.py#L51-L62) |
| 初始化 | [ensure_admin_user backend/app/services/auth_service.py:L55-L74](../backend/app/services/auth_service.py#L55-L74) |
| 初始化方式 | [init_db backend/app/core/database.py:L67-L76](../backend/app/core/database.py#L67-L76) |

## DS-002 知识文档表 `knowledge_document`

| 项目 | 内容 |
|---|---|
| 用途 | 保存知识文档主记录、所属知识库、当前版本、发布状态、存储路径、创建/更新人和软删除时间 |
| 状态 | `draft`、`active`、`archived`、`deleted` |
| 模型 | [KnowledgeDocument backend/app/models/persistence.py:L154-L190](../backend/app/models/persistence.py#L154-L190) |
| 列表查询 | [list_documents backend/app/services/knowledge_service.py:L410-L420](../backend/app/services/knowledge_service.py#L410-L420) |
| 当前版本嵌入状态 | [_document_payload backend/app/services/knowledge_service.py:L134-L159](../backend/app/services/knowledge_service.py#L134-L159) |

## DS-003 知识文档版本表 `knowledge_document_version`

| 项目 | 内容 |
|---|---|
| 用途 | 每次上传或编辑创建不可覆盖版本，保存版本号、内容哈希、版本文件路径、变更说明和创建人 |
| 模型 | [KnowledgeDocumentVersion backend/app/models/persistence.py:L192-L217](../backend/app/models/persistence.py#L192-L217) |
| 创建版本 | [save_document backend/app/services/knowledge_service.py:L187-L259](../backend/app/services/knowledge_service.py#L187-L259), [update_document backend/app/services/knowledge_service.py:L262-L325](../backend/app/services/knowledge_service.py#L262-L325) |
| 版本查询 | [list_versions backend/app/services/knowledge_service.py:L423-L454](../backend/app/services/knowledge_service.py#L423-L454) |
| 与 chunk 关联 | [KnowledgeChunk backend/app/models/persistence.py:L238-L269](../backend/app/models/persistence.py#L238-L269) |

## DS-004 知识操作日志表 `knowledge_operation_log`

| 项目 | 内容 |
|---|---|
| 用途 | 记录上传、更新、发布、归档、删除、重建索引等操作历史 |
| 模型 | [KnowledgeOperationLog backend/app/models/persistence.py:L272-L287](../backend/app/models/persistence.py#L272-L287) |
| 写入日志 | [_log backend/app/services/knowledge_service.py:L111-L128](../backend/app/services/knowledge_service.py#L111-L128) |
| 历史查询 | [list_history backend/app/services/knowledge_service.py:L457-L481](../backend/app/services/knowledge_service.py#L457-L481) |
| 关键动作 | `upload`、`update`、`publish`、`archive`、`delete`、`embed`、`reindex` |

## DS-005 数字人配置表 `avatar_config`

| 项目 | 内容 |
|---|---|
| 用途 | 保存当前启用的数字人名称、风格、服装、音色、语速、欢迎语和表情枚举 |
| 模型 | [AvatarConfig backend/app/models/persistence.py:L290-L303](../backend/app/models/persistence.py#L290-L303) |
| 默认配置 | [ensure_default_avatar backend/app/services/avatar_service.py:L35-L62](../backend/app/services/avatar_service.py#L35-L62) |
| 保存配置 | [save_avatar_config backend/app/services/avatar_service.py:L76-L99](../backend/app/services/avatar_service.py#L76-L99) |
| 初始化方式 | [init_db backend/app/core/database.py:L67-L76](../backend/app/core/database.py#L67-L76) |

## DS-006 知识库表 `knowledge_base`

| 项目 | 内容 |
|---|---|
| 用途 | 保存知识库元数据、向量后端、embedding 维度和启用状态 |
| 模型 | [KnowledgeBase backend/app/models/persistence.py:L220-L235](../backend/app/models/persistence.py#L220-L235) |
| 默认知识库创建 | [ensure_default_knowledge_base backend/app/services/vector_store.py:L303-L329](../backend/app/services/vector_store.py#L303-L329) |
| 后台列表接口 | [admin_knowledge_bases_v1 backend/app/api/v1.py:L245-L247](../backend/app/api/v1.py#L245-L247) |

## DS-007 知识块表 `knowledge_chunk`

| 项目 | 内容 |
|---|---|
| 用途 | 保存切片文本、来源、类别、token 数、embedding 向量以及是否启用到检索中 |
| PostgreSQL 列 | `embedding` 使用 `pgvector` 的 `vector(256)`，`embedding_payload` 仅保留调试导出所需的 JSON 向量副本 |
| 自定义列类型 | [PgVector / EmbeddingType backend/app/models/persistence.py:L18-L48](../backend/app/models/persistence.py#L18-L48) |
| 模型 | [KnowledgeChunk backend/app/models/persistence.py:L238-L269](../backend/app/models/persistence.py#L238-L269) |
| 静态资料入库 | [_persist_static_entries backend/app/services/vector_store.py:L347-L372](../backend/app/services/vector_store.py#L347-L372) |
| 文档版本嵌入 | [_upsert_document_version_chunks backend/app/services/vector_store.py:L392-L421](../backend/app/services/vector_store.py#L392-L421) |
| 文档嵌入入口 | [embed_document backend/app/services/vector_store.py:L434-L464](../backend/app/services/vector_store.py#L434-L464) |
| RAG 检索入口 | [retrieve_context backend/app/services/vector_store.py:L591-L614](../backend/app/services/vector_store.py#L591-L614) |
| 管理端嵌入接口 | [admin_document_embed_v1 backend/app/api/v1.py:L359-L372](../backend/app/api/v1.py#L359-L372) |

## DS-008 导出索引文件

| 项目 | 内容 |
|---|---|
| 文件 | `data/vector_db/scenic_vector_store.json` |
| 用途 | 当前作为数据库已启用 chunk 的导出视图，便于调试、审计和兼容旧脚本 |
| 导出入口 | [load_vector_store backend/app/services/vector_store.py:L548-L586](../backend/app/services/vector_store.py#L548-L586) |
| 重建入口 | [build_knowledge_base backend/app/services/vector_store.py:L467-L505](../backend/app/services/vector_store.py#L467-L505) |

## DS-009 景点主数据表 `scenic_spot`

| 项目 | 内容 |
|---|---|
| 用途 | 保存灵山核心景点主数据，作为评分外键、路线推荐和后台大屏景点名称来源 |
| 模型 | [ScenicSpot backend/app/models/persistence.py:L64-L86](../backend/app/models/persistence.py#L64-L86) |
| 初始化 | [ensure_scenic_catalog backend/app/services/scenic_service.py:L255-L280](../backend/app/services/scenic_service.py#L255-L280) |
| 使用位置 | [get_spot_statistics backend/app/services/rating_service.py:L231-L277](../backend/app/services/rating_service.py#L231-L277), [dashboard_overview backend/app/services/analytics_service.py:L41-L87](../backend/app/services/analytics_service.py#L41-L87) |

## DS-010 设施主数据表 `facility`

| 项目 | 内容 |
|---|---|
| 用途 | 保存厕所、停车场、游客中心、医疗点、母婴室等设施点位，后续支持附近设施查询 |
| 模型 | [Facility backend/app/models/persistence.py:L89-L102](../backend/app/models/persistence.py#L89-L102) |
| 初始化 | [ensure_scenic_catalog backend/app/services/scenic_service.py:L282-L298](../backend/app/services/scenic_service.py#L282-L298) |
| 当前 API | [scenic_facilities_v1 backend/app/api/v1.py:L221-L223](../backend/app/api/v1.py#L221-L223) |

## DS-011 游客会话与问答日志表 `visitor_session` / `chat_message`

| 项目 | 内容 |
|---|---|
| 用途 | 保存匿名游客会话、用户画像、问答消息、意图、响应时间和知识库引用，用于大屏服务量、热门问题和知识命中率 |
| 会话模型 | [VisitorSession backend/app/models/persistence.py:L105-L119](../backend/app/models/persistence.py#L105-L119) |
| 消息模型 | [ChatMessage backend/app/models/persistence.py:L122-L136](../backend/app/models/persistence.py#L122-L136) |
| 写入位置 | [create_session backend/app/services/chat_service.py:L32-L52](../backend/app/services/chat_service.py#L32-L52), [_log_message backend/app/services/chat_service.py:L66-L82](../backend/app/services/chat_service.py#L66-L82) |
| 聚合位置 | [dashboard_overview backend/app/services/analytics_service.py:L41-L87](../backend/app/services/analytics_service.py#L41-L87) |

## DS-012 路线日志表 `route_plan`

| 项目 | 内容 |
|---|---|
| 用途 | 保存每次路线推荐结果、兴趣标签、景点序列、时长和评分摘要，供后台大屏分析热门景点和路线偏好 |
| 模型 | [RoutePlan backend/app/models/persistence.py:L139-L151](../backend/app/models/persistence.py#L139-L151) |
| 写入位置 | [_persist_route backend/app/services/route_service.py:L118-L133](../backend/app/services/route_service.py#L118-L133) |
| 聚合位置 | [dashboard_overview backend/app/services/analytics_service.py:L44-L63](../backend/app/services/analytics_service.py#L44-L63) |

## DS-013 游客景点评分表 `visitor_spot_rating`

| 项目 | 内容 |
|---|---|
| 用途 | 保存游客对景点的综合、文化、自然、拍照、设施评分，评论、标签、访问上下文、公开状态、审核状态、情绪分析和画像快照 |
| 唯一约束 | `session_uuid + spot_id` 唯一，用于提交即更新的评分体验 |
| 模型 | [VisitorSpotRating backend/app/models/persistence.py:L306-L354](../backend/app/models/persistence.py#L306-L354) |
| 请求模型 | [SpotRatingRequest backend/app/schemas/visitor.py:L25-L41](../backend/app/schemas/visitor.py#L25-L41) |
| 写入位置 | [create_or_update_rating backend/app/services/rating_service.py:L151-L176](../backend/app/services/rating_service.py#L151-L176) |
| 统计位置 | [get_spot_statistics backend/app/services/rating_service.py:L231-L277](../backend/app/services/rating_service.py#L231-L277), [get_admin_rating_ranking backend/app/services/rating_service.py:L350-L366](../backend/app/services/rating_service.py#L350-L366), [get_admin_rating_trend backend/app/services/rating_service.py:L369-L385](../backend/app/services/rating_service.py#L369-L385) |
| 初始化 SQL | [scripts/init_db.sql:L207-L231](../scripts/init_db.sql#L207-L231) |
