# 程序索引

## 核心后端服务

| 程序 | 文件职责 | 核心符号 |
|---|---|---|
| DeepSeek 客户端 | 读取本地 API Key，调用 DeepSeek OpenAI 兼容接口 | [DeepSeekClient backend/app/services/deepseek_service.py:L9-L47](../backend/app/services/deepseek_service.py#L9-L47) |
| 游客问答编排 | 创建会话、文本/语音/图片问答，串联 RAG 与 DeepSeek，并写入问答日志供大屏聚合 | [create_session backend/app/services/chat_service.py:L32-L52](../backend/app/services/chat_service.py#L32-L52), [_log_message backend/app/services/chat_service.py:L66-L82](../backend/app/services/chat_service.py#L66-L82), [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137) |
| 数据库层 | 配置 SQLAlchemy，默认连接 PostgreSQL；记录当前活动数据库 URL，创建 `vector` 扩展并初始化景点/设施主数据 | [current_database_url backend/app/core/database.py:L30-L34](../backend/app/core/database.py#L30-L34), [configure_database backend/app/core/database.py:L42-L55](../backend/app/core/database.py#L42-L55), [init_db backend/app/core/database.py:L58-L69](../backend/app/core/database.py#L58-L69), [new_session backend/app/core/database.py:L92-L104](../backend/app/core/database.py#L92-L104) |
| 持久化模型 | 管理员、景点、设施、游客会话、问答消息、路线、知识库、知识块、评分和数字人配置 | [ScenicSpot backend/app/models/persistence.py:L64-L86](../backend/app/models/persistence.py#L64-L86), [VisitorSession backend/app/models/persistence.py:L105-L119](../backend/app/models/persistence.py#L105-L119), [ChatMessage backend/app/models/persistence.py:L122-L136](../backend/app/models/persistence.py#L122-L136), [RoutePlan backend/app/models/persistence.py:L139-L151](../backend/app/models/persistence.py#L139-L151), [KnowledgeChunk backend/app/models/persistence.py:L238-L269](../backend/app/models/persistence.py#L238-L269), [VisitorSpotRating backend/app/models/persistence.py:L306-L354](../backend/app/models/persistence.py#L306-L354) |
| 后台鉴权服务 | 管理员初始化、PBKDF2 密码校验、Bearer token 签发和依赖校验 | [ensure_admin_user backend/app/services/auth_service.py:L55-L74](../backend/app/services/auth_service.py#L55-L74), [authenticate_admin backend/app/services/auth_service.py:L110-L131](../backend/app/services/auth_service.py#L110-L131), [require_admin_user backend/app/services/auth_service.py:L134-L145](../backend/app/services/auth_service.py#L134-L145) |
| 知识库服务 | 为 API 层提供检索、知识库列表、文档上传、版本化、嵌入、发布和历史查询 | [retrieve_context backend/app/services/knowledge_service.py:L32-L53](../backend/app/services/knowledge_service.py#L32-L53), [list_knowledge_bases backend/app/services/knowledge_service.py:L56-L57](../backend/app/services/knowledge_service.py#L56-L57), [save_document backend/app/services/knowledge_service.py:L187-L259](../backend/app/services/knowledge_service.py#L187-L259), [embed_document backend/app/services/knowledge_service.py:L174-L184](../backend/app/services/knowledge_service.py#L174-L184), [publish_document backend/app/services/knowledge_service.py:L328-L353](../backend/app/services/knowledge_service.py#L328-L353), [list_versions backend/app/services/knowledge_service.py:L423-L454](../backend/app/services/knowledge_service.py#L423-L454) |
| 向量检索服务 | 基于 CSV/Markdown/真实资料包/后台版本文档生成数据库 chunk，统一走 pgvector 距离排序；调试导出 JSON 仅用于观察已启用 chunk | [vector_backend_name backend/app/services/vector_store.py:L80-L81](../backend/app/services/vector_store.py#L80-L81), [ensure_default_knowledge_base backend/app/services/vector_store.py:L301-L327](../backend/app/services/vector_store.py#L301-L327), [build_knowledge_base backend/app/services/vector_store.py:L465-L503](../backend/app/services/vector_store.py#L465-L503), [_retrieve_pgvector_chunks backend/app/services/vector_store.py:L506-L529](../backend/app/services/vector_store.py#L506-L529), [retrieve_context backend/app/services/vector_store.py:L575-L596](../backend/app/services/vector_store.py#L575-L596) |
| 数字人配置服务 | 持久化当前启用的数字人名称、风格、服装、音色、语速和欢迎语 | [get_active_avatar backend/app/services/avatar_service.py:L65-L73](../backend/app/services/avatar_service.py#L65-L73), [save_avatar_config backend/app/services/avatar_service.py:L76-L99](../backend/app/services/avatar_service.py#L76-L99) |
| 真实资料包读取 | 读取灵山公开资料包 docx/xlsx，xlsx 限量抽取避免超时 | [load_scenic_pack_entries backend/app/services/vector_store.py:L266-L290](../backend/app/services/vector_store.py#L266-L290), [extract_xlsx_text backend/app/services/vector_store.py:L227-L263](../backend/app/services/vector_store.py#L227-L263) |
| 灵山景点目录 | 提供真实灵山点位、地图坐标、标签、讲解词和推荐停留时间 | [SCENIC_SPOTS backend/app/services/scenic_service.py:L14-L225](../backend/app/services/scenic_service.py#L14-L225) |
| 评分服务 | 游客景点评分 upsert、情绪分析、评分统计、公开评论、偏好画像、后台排行与趋势 | [analyze_sentiment backend/app/services/rating_service.py:L36-L85](../backend/app/services/rating_service.py#L36-L85), [create_or_update_rating backend/app/services/rating_service.py:L151-L176](../backend/app/services/rating_service.py#L151-L176), [get_spot_statistics backend/app/services/rating_service.py:L231-L277](../backend/app/services/rating_service.py#L231-L277), [get_user_preference_profile backend/app/services/rating_service.py:L286-L327](../backend/app/services/rating_service.py#L286-L327) |
| 路线推荐服务 | 根据兴趣、时间、体力、游客评分、偏好画像和起点生成灵山推荐路线并持久化路线日志 | [_score_spot backend/app/services/route_service.py:L82-L107](../backend/app/services/route_service.py#L82-L107), [_persist_route backend/app/services/route_service.py:L118-L133](../backend/app/services/route_service.py#L118-L133), [recommend_route backend/app/services/route_service.py:L152-L196](../backend/app/services/route_service.py#L152-L196) |
| 数据大屏服务 | 从问答消息、路线、评分和景点表聚合服务量、热门问题、热门景点、评分排行、情绪趋势和标签 | [dashboard_overview backend/app/services/analytics_service.py:L34-L89](../backend/app/services/analytics_service.py#L34-L89), [sentiment_report backend/app/services/analytics_service.py:L92-L107](../backend/app/services/analytics_service.py#L92-L107) |
| v1 API 兼容层 | 提供 `/api/v1` 游客、评分、AI 能力、管理后台和系统状态 MVP 路由 | [backend/app/api/v1.py:L39-L452](../backend/app/api/v1.py#L39-L452) |
| 系统状态服务 | 汇总数据库、LLM、ASR、TTS、Avatar 和向量后端状态 | [get_system_status backend/app/services/system_service.py:L19-L33](../backend/app/services/system_service.py#L19-L33) |
| FastAPI 入口 | 注册游客端、管理端、`/api/v1` 和 SPA 静态资源入口 | [create_app backend/app/main.py:L38-L80](../backend/app/main.py#L38-L80) |

## 运行与验证脚本

| 程序 | 文件职责 | 核心符号 |
|---|---|---|
| 本地 runner | 环境检查、依赖安装、自动拉起 PostgreSQL、构建知识库、测试、服务启动和 Docker 烟测分发 | [main scripts/run_local.py:L204-L254](../scripts/run_local.py#L204-L254), [ensure_postgres_service scripts/run_local.py:L74-L86](../scripts/run_local.py#L74-L86) |
| 后端烟测 | 登录后台、上传草稿、发布、检索命中、游客问答引用、删除后不命中 | [main scripts/smoke_test.py:L77-L123](../scripts/smoke_test.py#L77-L123) |
| 完整栈烟测 | 启动后端和静态前端后运行 API 烟测 | [main scripts/smoke_full_stack.py:L32-L64](../scripts/smoke_full_stack.py#L32-L64) |
| Vue 完整栈烟测 | 复用健康服务或启动 FastAPI 与 Vite，验证真实 Vue 工程 | [main scripts/smoke_vue_full_stack.py:L69-L121](../scripts/smoke_vue_full_stack.py#L69-L121) |
| Docker pgvector 烟测 | 直接从 Git 仓库源码构建 Compose，校验 `/guide` 和 `/api/v1/admin/system/status` | [main scripts/smoke_docker_postgres.py:L58-L100](../scripts/smoke_docker_postgres.py#L58-L100) |
| Docker All-in-One 烟测 | 构建单容器镜像，校验 `/guide`、后台系统状态和 `5433` 端口 | [main scripts/smoke_docker_allinone.py:L70-L114](../scripts/smoke_docker_allinone.py#L70-L114) |
| All-in-One 启动编排 | 在单容器内初始化 PostgreSQL、启用 pgvector 并启动 FastAPI | [main deploy/start_allinone.py:L228-L240](../deploy/start_allinone.py#L228-L240) |
| GHCR 发布脚本 | 本地构建前端、构建 all-in-one 发布镜像并推送到 GHCR | [main scripts/publish_ghcr_allinone.py:L123-L160](../scripts/publish_ghcr_allinone.py#L123-L160) |
| 静态前端服务 | 用 Python http.server 服务无依赖演示端 | [main scripts/serve_static_frontend.py:L14-L23](../scripts/serve_static_frontend.py#L14-L23) |
| DeepSeek 多智能体生成器 | 生成架构、后端、前端、AI/RAG、测试文档建议 | [main scripts/deepseek_multi_agent.py:L203-L240](../scripts/deepseek_multi_agent.py#L203-L240) |
| GitHub 发布脚本 | 配置远程仓库、检查工作区、推送分支和 tag | [main scripts/publish_github.py:L56-L84](../scripts/publish_github.py#L56-L84) |

## 前端入口

| 程序 | 文件职责 | 核心位置 |
|---|---|---|
| Vue 数字人页 | 游客问答、语音输入、语音播报、知识引用、路线卡片和景点评分面板 | [ChatGuide script frontend/src/pages/visitor/ChatGuide.vue:L1-L151](../frontend/src/pages/visitor/ChatGuide.vue#L1-L151), [ChatGuide template frontend/src/pages/visitor/ChatGuide.vue:L154-L229](../frontend/src/pages/visitor/ChatGuide.vue#L154-L229) |
| 数字人灵灵 | 浏览器 3D 画布、状态预览、旋转、字幕和资源清理 | [DigitalAvatar frontend/src/components/Avatar/DigitalAvatar.vue:L1-L108](../frontend/src/components/Avatar/DigitalAvatar.vue#L1-L108) |
| 蓝鲸主题 3D 原型 | Three.js 程序建模、光照、待机/思考/讲解动作和 WebGL 生命周期 | [createWhaleAvatar frontend/src/components/Avatar/whaleAvatar3d.ts:L13-L239](../frontend/src/components/Avatar/whaleAvatar3d.ts#L13-L239) |
| 数字人状态 | 问答状态、字幕、口型定时器和打断清理 | [useAvatarStore frontend/src/store/avatar.ts:L1-L45](../frontend/src/store/avatar.ts#L1-L45) |
| 灵山地图组件 | SVG 真实景区地图、POI、路线和详情 | [ScenicMapView frontend/src/components/ScenicMapView.vue:L1-L101](../frontend/src/components/ScenicMapView.vue#L1-L101) |
| 地图导览页 | 兴趣/时间筛选并生成路线 | [ScenicMap frontend/src/pages/visitor/ScenicMap.vue:L1-L62](../frontend/src/pages/visitor/ScenicMap.vue#L1-L62) |
| 管理大屏 | 服务量、知识命中率、游客评分、负向反馈、评分排行、路线偏好、情绪趋势和高频标签 | [AdminDashboard frontend/src/pages/admin/AdminDashboard.vue:L1-L108](../frontend/src/pages/admin/AdminDashboard.vue#L1-L108) |
| 后台登录页 | 登录后保存 Bearer token 到 localStorage | [AdminLogin frontend/src/pages/admin/AdminLogin.vue:L1-L46](../frontend/src/pages/admin/AdminLogin.vue#L1-L46) |
| 知识库管理页 | 状态筛选、草稿上传、版本/历史、发布、归档、删除、重建索引和检索测试 | [KnowledgeManage script frontend/src/pages/admin/KnowledgeManage.vue:L33-L156](../frontend/src/pages/admin/KnowledgeManage.vue#L33-L156), [KnowledgeManage template frontend/src/pages/admin/KnowledgeManage.vue:L216-L265](../frontend/src/pages/admin/KnowledgeManage.vue#L216-L265) |
| 数字人配置页 | 保存当前启用数字人配置到数据库 | [AvatarManage frontend/src/pages/admin/AvatarManage.vue:L1-L62](../frontend/src/pages/admin/AvatarManage.vue#L1-L62) |
| 后台 API 客户端 | 登录、知识库版本流转、历史查询、评分排行、评分趋势和数字人配置请求封装 | [admin api frontend/src/api/admin.ts:L3-L78](../frontend/src/api/admin.ts#L3-L78) |
| 游客 API 客户端 | 统一调用 `/api/v1/guide`、`/api/v1/scenic`、`/api/v1/route` 和游客评分 API | [visitor api frontend/src/api/visitor.ts:L21-L97](../frontend/src/api/visitor.ts#L21-L97) |
| HTTP 客户端 | 自动附加 Bearer token，401 跳转登录页 | [http token frontend/src/api/http.ts:L8-L22](../frontend/src/api/http.ts#L8-L22) |
| Vue 应用入口 | 注册 Pinia 和 Router，避免未使用 Element Plus 类型污染 | [frontend/src/main.ts:L1-L9](../frontend/src/main.ts#L1-L9) |
| 静态演示端 | 在 npm 网络异常时保证端到端演示可用 | [frontend_static/index.html:L170-L218](../frontend_static/index.html#L170-L218) |

## 修改风险

- 修改 [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137) 会影响游客问答、语音问答复用逻辑、大屏问答日志和 smoke 测试。
- 修改 [SCENIC_SPOTS backend/app/services/scenic_service.py:L14-L225](../backend/app/services/scenic_service.py#L14-L225) 会影响地图点位、路线推荐、景点列表 API 和前端 POI。
- 修改 [recommend_route backend/app/services/route_service.py:L152-L196](../backend/app/services/route_service.py#L152-L196) 会影响问答路线卡片、地图路线、游客画像反哺和路线推荐接口。
- 修改 [create_or_update_rating backend/app/services/rating_service.py:L151-L176](../backend/app/services/rating_service.py#L151-L176) 会影响游客评分、景点评分统计、路线排序和后台大屏评分指标。
- 修改 [retrieve_context backend/app/services/vector_store.py:L575-L596](../backend/app/services/vector_store.py#L575-L596) 会影响知识库命中率、PostgreSQL pgvector 查询和游客端问答依据。
- 修改 [embed_document backend/app/services/vector_store.py:L436-L466](../backend/app/services/vector_store.py#L436-L466) 会影响后台文档切片是否真正落入 `knowledge_chunk`。
- 修改 [run_local.py 命令分发 scripts/run_local.py:L204-L254](../scripts/run_local.py#L204-L254) 会影响部署、测试、Docker pgvector 烟测、Docker All-in-One 烟测和服务器运行流程。
- 修改 [publish_github.py 发布流程 scripts/publish_github.py:L56-L84](../scripts/publish_github.py#L56-L84) 会影响 GitHub 远程发布、分支映射和 tag 推送。
- 修改 [publish_ghcr_allinone.py 发布流程 scripts/publish_ghcr_allinone.py:L123-L160](../scripts/publish_ghcr_allinone.py#L123-L160) 会影响 GHCR 镜像标签、本地构建和容器仓库推送。
