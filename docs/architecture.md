# 架构说明

## 1. 系统边界

LingTour AI 当前定位是比赛演示级全栈系统，重点完成景区数字人导览闭环，而不是千万级向量检索或生产级用户中心。

### 当前包含

- 游客问答、RAG 检索、路线推荐、景点评分、地图导览和数字人展示。
- 管理员登录、知识库文档维护、数字人配置、评分运营和数据大屏。
- PostgreSQL + pgvector 单库数据层。
- Docker Compose 双容器运行和 All-in-One 单容器运行。

### 当前不包含

- 生产级实名游客账号体系。
- 真实流式 ASR/TTS 音频链路。
- 真实多模态识图模型。
- 完整 VRM 骨骼模型、专业表情捕捉或商业数字人 SDK；目前的蓝鲸主题角色是浏览器端 Three.js 程序建模的 3D 概念原型，见 [createWhaleAvatar frontend/src/components/Avatar/whaleAvatar3d.ts:L13-L239](../frontend/src/components/Avatar/whaleAvatar3d.ts#L13-L239)。
- Chroma、Milvus、Qdrant、SQLite 运行依赖。

## 2. 分层结构

```text
Vue 3 前端
  ├── 游客导览 / 地图 / 评分
  └── 管理后台 / 知识库 / 大屏 / 数字人配置
        ↓
FastAPI API 层
  ├── /api/v1/guide/*
  ├── /api/v1/scenic/*
  ├── /api/v1/route/*
  ├── /api/v1/rag/*
  ├── /api/v1/visitor/*
  └── /api/v1/admin/*
        ↓
服务层
  ├── chat_service
  ├── vector_store / knowledge_service
  ├── route_service
  ├── rating_service
  ├── analytics_service
  ├── auth_service
  └── avatar_service
        ↓
PostgreSQL + pgvector
```

## 3. 核心模块定位

| 模块 | 职责 | 代码入口 |
|---|---|---|
| FastAPI 应用入口 | 注册游客端、管理端、`/api/v1` 和静态资源 | [create_app backend/app/main.py:L38-L80](../backend/app/main.py#L38-L80) |
| v1 API 层 | 对外统一暴露 `/api/v1` 兼容接口 | [backend/app/api/v1.py:L39-L452](../backend/app/api/v1.py#L39-L452) |
| 游客问答 | 会话创建、RAG 引用、模型回答和问答日志 | [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137) |
| 知识库检索 | PostgreSQL + pgvector chunk 写入和检索 | [retrieve_context backend/app/services/vector_store.py:L575-L596](../backend/app/services/vector_store.py#L575-L596) |
| 路线推荐 | 基于兴趣、时间、体力、评分和画像生成路线 | [recommend_route backend/app/services/route_service.py:L152-L196](../backend/app/services/route_service.py#L152-L196) |
| 游客评分 | 评分 upsert、情绪、统计、画像、排行和趋势 | [create_or_update_rating backend/app/services/rating_service.py:L151-L176](../backend/app/services/rating_service.py#L151-L176) |
| 数据大屏 | 聚合问答、路线、评分、景点数据 | [dashboard_overview backend/app/services/analytics_service.py:L34-L89](../backend/app/services/analytics_service.py#L34-L89) |
| 数据库初始化 | 创建 pgvector 扩展、表结构和景区主数据 | [init_db backend/app/core/database.py:L58-L69](../backend/app/core/database.py#L58-L69) |

## 4. 数据流

### 4.1 游客问答

```text
游客输入问题
  → /api/v1/guide/ask
  → chat_service
  → knowledge_service / vector_store
  → PostgreSQL knowledge_chunk.embedding pgvector 检索
  → DeepSeek/OpenAI 兼容模型
  → chat_message 写日志
  → 前端展示答案、引用和数字人状态
```

### 4.2 游客评分反哺路线

```text
游客提交景点评分
  → /api/v1/visitor/ratings
  → visitor_spot_rating upsert
  → rating_service 聚合景点评分和游客画像
  → /api/v1/route/recommend
  → route_service 将评分维度纳入路线打分
  → route_plan 持久化 score_summary
```

### 4.3 后台大屏

```text
chat_message + route_plan + visitor_spot_rating + scenic_spot
  → analytics_service.dashboard_overview
  → /api/v1/admin/analytics/overview
  → AdminDashboard.vue 渲染服务量、评分、排行、情绪和标签
```

## 5. 数据层

项目统一使用 PostgreSQL + pgvector：

| 数据类型 | 表/模型 | 说明 |
|---|---|---|
| 景区主数据 | `scenic_spot`, `facility` | 景点、设施和地图点位 |
| 游客会话 | `visitor_session`, `chat_message` | 会话、问答日志和知识引用 |
| 路线日志 | `route_plan` | 路线推荐结果与评分摘要 |
| 知识库 | `knowledge_base`, `knowledge_document`, `knowledge_chunk` | 文档、版本、chunk 和 embedding |
| 评分反馈 | `visitor_spot_rating` | 多维评分、评论、标签、情绪和画像快照 |
| 后台配置 | `admin_user`, `avatar_config` | 管理员与数字人配置 |

数据结构详见 [数据结构 docs/data_schema_reference.md:L1-L164](./data_schema_reference.md#L1-L164)。

## 6. 部署结构

| 方式 | 文件 | 用途 |
|---|---|---|
| 本地开发 | [dev_vue_full_stack.py scripts/dev_vue_full_stack.py:L52-L95](../scripts/dev_vue_full_stack.py#L52-L95) | 启动 FastAPI 与 Vite |
| Compose 双容器 | [deploy/docker-compose.yml:L1-L44](../deploy/docker-compose.yml#L1-L44) | Web 容器 + PostgreSQL/pgvector 容器 |
| All-in-One 单容器 | [deploy/docker-compose.allinone.yml:L1-L36](../deploy/docker-compose.allinone.yml#L1-L36) | 单容器内运行 Web + PostgreSQL |
| GHCR 发布 | [publish_ghcr_allinone.py scripts/publish_ghcr_allinone.py:L123-L160](../scripts/publish_ghcr_allinone.py#L123-L160) | 构建并推送发布镜像 |

## 7. 主要设计决策

- 使用 `/api/v1` 作为比赛演示的稳定 API 前缀。
- PostgreSQL + pgvector 同时承担结构化数据和向量检索，减少部署复杂度。
- 游客端使用匿名 `session_uuid`，管理员端使用 Bearer token。
- 游客评分不仅用于展示，也反哺路线推荐和后台运营分析。
- All-in-One 镜像用于评审或移交时快速运行，Compose 双容器用于更接近常规服务部署。

## 8. 验证入口

- 后端测试：[TEST-022 docs/test_reference.md:L254-L264](./test_reference.md#L254-L264)
- 前端构建：[TEST-023 docs/test_reference.md:L267-L276](./test_reference.md#L267-L276)
- PostgreSQL 初始化：[TEST-024 docs/test_reference.md:L278-L289](./test_reference.md#L278-L289)
- Docker Compose：[TEST-019 docs/test_reference.md:L218-L227](./test_reference.md#L218-L227)
- All-in-One：[TEST-020 docs/test_reference.md:L230-L241](./test_reference.md#L230-L241)
