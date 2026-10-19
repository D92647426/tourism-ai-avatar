# Project Onboarding

## 1. 项目目标

LingTour AI 是面向中国软件杯 A5 景区导览服务 AI 数字人赛题的工程项目，当前阶段目标是跑通游客问答、PostgreSQL + pgvector RAG、版本化知识库、后台权限、游客评分、路线推荐反哺、数字人配置、真实地图和管理大屏基础数据。

## 2. 当前包含

- DeepSeek 文本问答和问答日志：[chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137)
- PostgreSQL + pgvector 知识库和向量检索：[retrieve_context backend/app/services/vector_store.py:L575-L596](../backend/app/services/vector_store.py#L575-L596)
- 灵山真实景点和评分反哺路线：[SCENIC_SPOTS backend/app/services/scenic_service.py:L14-L230](../backend/app/services/scenic_service.py#L14-L230)、[recommend_route backend/app/services/route_service.py:L152-L196](../backend/app/services/route_service.py#L152-L196)
- 游客个性化评分与大屏聚合：[VisitorSpotRating backend/app/models/persistence.py:L306-L354](../backend/app/models/persistence.py#L306-L354)、[dashboard_overview backend/app/services/analytics_service.py:L34-L89](../backend/app/services/analytics_service.py#L34-L89)
- 数字人灵灵和真实地图：[DigitalAvatar frontend/src/components/Avatar/DigitalAvatar.vue:L1-L64](../frontend/src/components/Avatar/DigitalAvatar.vue#L1-L64)、[ScenicMapView frontend/src/components/ScenicMapView.vue:L1-L101](../frontend/src/components/ScenicMapView.vue#L1-L101)
- 管理后台登录、知识库版本化和发布流转：[login backend/app/api/admin.py:L15-L16](../backend/app/api/admin.py#L15-L16)、[publish_document backend/app/services/knowledge_service.py:L265-L282](../backend/app/services/knowledge_service.py#L265-L282)
- 数据库持久化模型：[persistence models backend/app/models/persistence.py:L51-L354](../backend/app/models/persistence.py#L51-L354)
- 无 npm 依赖静态演示端：[frontend_static/index.html:L170-L218](../frontend_static/index.html#L170-L218)
- 完整栈烟测：[main scripts/smoke_full_stack.py:L30-L61](../scripts/smoke_full_stack.py#L30-L61)

## 3. 当前不包含

- 真实 ASR/TTS 音频生成仍是 P1。
- Live2D 数字人仍是 P1。
- 仓库默认只支持 PostgreSQL；本机调试统一连接 `127.0.0.1:5433`，不再保留 SQLite 兼容层。
- ChromaDB / Milvus / Qdrant 不是当前项目依赖；比赛版统一使用 PostgreSQL + pgvector。
- 图片识景接口仍是演示逻辑，真实多模态模型接入是 P1，详见 [实现缺口核查 docs/implementation_gap_audit.md:L1-L51](./implementation_gap_audit.md#L1-L51)。

## 4. 部署与运行现状

- Compose 双容器链路已完成验收，可使用 [TEST-019 docs/test_reference.md:L218-L227](./test_reference.md#L218-L227) 回归。
- All-in-One 单容器链路已完成验收，可使用 [TEST-020 docs/test_reference.md:L230-L241](./test_reference.md#L230-L241) 回归。
- 常用命令统一沉淀在 [CLI 使用说明 docs/cli_usage.md:L1-L154](./cli_usage.md#L1-L154)，不要优先手工拼接服务启动命令。

## 5. 新同事阅读顺序

1. [README](../README.md)
2. [协作规则](../AGENTS.md)
3. [架构说明](./architecture.md)
4. [需求追踪](./requirements_traceability.md)
5. [程序索引](./program_index.md)
6. [CLI 使用说明](./cli_usage.md)
7. [API 说明](./api_reference.md)
8. [配置字段](./config_reference.md)
9. [数据结构](./data_schema_reference.md)
10. [测试方式](./test_reference.md)
11. [排错经验](./troubleshooting.md)
12. [项目交互与运行指南](./user_interaction_guide.md)
13. [RAG 与知识库说明](./rag_knowledge_guide.md)

## 6. 常见任务入口

| 任务 | 先看文档 | 代码入口 |
|---|---|---|
| 修改问答逻辑 | [REQ-001](./requirements_traceability.md#req-001-deepseek--本地知识库问答闭环) | [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137) |
| 补充景区资料 | [REQ-017](./requirements_traceability.md#req-017-postgresql--pgvector-知识库迁移) | [data/raw_documents/demo_scenic_guide.md:L1-L25](../data/raw_documents/demo_scenic_guide.md#L1-L25) |
| 修改游客评分 | [REQ-021](./requirements_traceability.md#req-021-游客个性化评分路线反哺与数据大屏) | [rating_service.py:L151-L176](../backend/app/services/rating_service.py#L151-L176) |
| 修改真实地图 | [REQ-005](./requirements_traceability.md#req-005-灵山真实景点地图与路线导览) | [ScenicMapView frontend/src/components/ScenicMapView.vue:L1-L101](../frontend/src/components/ScenicMapView.vue#L1-L101) |
| 修改数字人灵灵 | [REQ-006](./requirements_traceability.md#req-006-数字人灵灵真实前端交互体验) | [DigitalAvatar frontend/src/components/Avatar/DigitalAvatar.vue:L1-L64](../frontend/src/components/Avatar/DigitalAvatar.vue#L1-L64) |
| 修改后台知识库发布机制 | [REQ-007](./requirements_traceability.md#req-007-后台知识库管理闭环) | [knowledge_service.py:L153-L324](../backend/app/services/knowledge_service.py#L153-L324) |
| 修改后台权限或数据库 | [REQ-008](./requirements_traceability.md#req-008-后台权限版本化知识库与数据库持久化) | [auth_service.py:L32-L145](../backend/app/services/auth_service.py#L32-L145)、[database.py:L38-L76](../backend/app/core/database.py#L38-L76) |
| 修改 README 或架构文档 | [架构说明](./architecture.md) | [README.md:L1-L116](../README.md#L1-L116)、[architecture.md:L1-L136](./architecture.md#L1-L136) |
| 修改运行命令 | [CLI 使用说明](./cli_usage.md) | [run_local.py:L204-L254](../scripts/run_local.py#L204-L254) |
| 启动本地演示 | [TEST-006](./test_reference.md#test-006-完整栈烟测) | [main scripts/smoke_full_stack.py:L30-L61](../scripts/smoke_full_stack.py#L30-L61) |
| 排查 npm 失败 | [TRB-001](./troubleshooting.md#trb-001-前端-npm-install-超时或-econnreset) | [frontend/.npmrc:L1-L4](../frontend/.npmrc#L1-L4) |
