# LingTour AI 数字人导游平台

LingTour AI 是面向中国软件杯 A5「景区导览服务 AI 数字人」赛题的全栈项目。当前版本已经跑通游客导览、PostgreSQL + pgvector 知识库、游客个性化评分、路线推荐反哺、管理后台大屏、数字人配置和 Docker 容器化运行。

当前远程仓库：

```text
https://github.com/2667741708/ling-shan-digital-guide.git
```

当前开发分支：

```text
codex/optimize-map-avatar-v0.1
```

## 当前能力

| 模块 | 当前状态 | 入口 |
|---|---|---|
| 游客问答 | 支持 `/api/v1/guide/ask`，写入问答日志并返回引用和数字人指令 | [API-015 docs/api_reference.md:L25-L34](docs/api_reference.md#L25-L34) |
| 知识库/RAG | 统一使用 PostgreSQL + pgvector，不依赖 Chroma/Milvus/Qdrant/SQLite | [REQ-017 docs/requirements_traceability.md:L401-L436](docs/requirements_traceability.md#L401-L436) |
| 游客评分 | 支持多维评分、公开评论、游客画像、后台排行和趋势 | [REQ-021 docs/requirements_traceability.md:L539-L581](docs/requirements_traceability.md#L539-L581) |
| 路线推荐 | 接入兴趣、时间、体力、游客评分和偏好画像，并持久化路线日志 | [路线推荐 backend/app/services/route_service.py:L152-L196](backend/app/services/route_service.py#L152-L196) |
| 数据大屏 | 从问答、路线、评分、景点表聚合真实运营数据 | [数据大屏 backend/app/services/analytics_service.py:L34-L89](backend/app/services/analytics_service.py#L34-L89) |
| 前端 App | Vue 3 游客端、地图页、后台登录、知识库管理、评分面板和管理大屏 | [前端入口 docs/program_index.md:L54-L68](docs/program_index.md#L54-L68) |
| Docker 部署 | 支持 Compose 双容器和 All-in-One 单容器，单容器内包含 PostgreSQL + pgvector | [TEST-019 docs/test_reference.md:L218-L227](docs/test_reference.md#L218-L227), [TEST-020 docs/test_reference.md:L230-L241](docs/test_reference.md#L230-L241) |

## 技术栈

- 前端：Vue 3、TypeScript、Vite、Pinia、Element Plus、ECharts。
- 后端：FastAPI、SQLAlchemy、Pydantic。
- 数据层：PostgreSQL + pgvector 单库架构。
- AI 能力：RAG 检索、DeepSeek/OpenAI 兼容模型适配、ASR/TTS/Avatar 演示接口。
- 部署：Docker Compose、All-in-One Docker、GHCR 发布脚本。

## 快速启动

本地开发演示：

```powershell
python scripts\dev_vue_full_stack.py
```

访问地址：

```text
游客导览：http://127.0.0.1:5173/guide
灵山地图：http://127.0.0.1:5173/map
管理后台：http://127.0.0.1:5173/admin
后端健康：http://127.0.0.1:8000/api/v1/health
```

Docker Compose 运行：

```powershell
Copy-Item .env.example .env
docker compose -f deploy/docker-compose.yml up --build
```

All-in-One 单容器运行：

```powershell
docker compose -f deploy/docker-compose.allinone.yml up --build
```

更多命令见 [CLI 使用说明 docs/cli_usage.md:L1-L154](docs/cli_usage.md#L1-L154)。

## 核心 API 链路

1. 创建游客会话：`POST /api/v1/guide/sessions`
2. 游客问答：`POST /api/v1/guide/ask`
3. RAG 检索：`POST /api/v1/rag/retrieve`
4. 路线推荐：`POST /api/v1/route/recommend`
5. 游客评分：`POST /api/v1/visitor/ratings`
6. 后台评分运营：`GET /api/v1/admin/ratings/ranking`
7. 后台数据大屏：`GET /api/v1/admin/analytics/overview`
8. 系统状态：`GET /api/v1/admin/system/status`

完整接口说明见 [API 说明 docs/api_reference.md:L1-L188](docs/api_reference.md#L1-L188)。

## 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\check_doc_links.py
```

Docker 验证：

```powershell
python scripts\run_local.py smoke-docker-postgres
python scripts\run_local.py smoke-docker-allinone
```

测试清单见 [测试方式 docs/test_reference.md:L1-L290](docs/test_reference.md#L1-L290)。

## 文档入口

| 文档 | 用途 |
|---|---|
| [项目入口 docs/project_onboarding.md:L1-L61](docs/project_onboarding.md#L1-L61) | 新同事 10 到 30 分钟理解项目 |
| [架构说明 docs/architecture.md:L1-L136](docs/architecture.md#L1-L136) | 系统边界、模块、数据流、部署结构 |
| [需求追踪 docs/requirements_traceability.md:L1-L581](docs/requirements_traceability.md#L1-L581) | 需求到代码、API、测试的映射 |
| [程序索引 docs/program_index.md:L1-L83](docs/program_index.md#L1-L83) | 后端、脚本、前端入口 |
| [配置说明 docs/config_reference.md:L1-L116](docs/config_reference.md#L1-L116) | 环境变量、数据库、模型与部署配置 |
| [数据结构 docs/data_schema_reference.md:L1-L164](docs/data_schema_reference.md#L1-L164) | PostgreSQL 表、pgvector 字段和约束 |
| [排错手册 docs/troubleshooting.md:L1-L324](docs/troubleshooting.md#L1-L324) | npm、PostgreSQL、Docker、API、模型排错 |

## 参考项目

- [uezo/aiavatarkit](https://github.com/uezo/aiavatarkit)：数字人语音对话与角色编排参考。
- [Azure-Samples/rag-postgres-openai-python](https://github.com/Azure-Samples/rag-postgres-openai-python)：FastAPI + PostgreSQL + RAG 工程组织参考。
- [SengokuCola/Magic-Voice-Chat](https://github.com/SengokuCola/Magic-Voice-Chat)：语音角色聊天交互链路参考。
- [guansss/pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)：后续 Live2D Web 展示增强参考。
