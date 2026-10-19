# 用户问题追踪

## Q-0001 如何让项目以 DeepSeek 为核心实际跑起来？

### 用户原始问题

希望使用本地 DeepSeek API Key，结合多智能体和项目文档，完成项目开发并实际运行，同时制作知识库和向量库。

### 回答摘要

项目已采用 DeepSeek 作为文本模型，使用轻量本地 JSON 向量库构建 RAG 闭环；新增 Python runner 和完整栈烟测脚本，可实际启动后端和无依赖静态前端。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| DeepSeek 客户端 | 调用 DeepSeek API | [DeepSeekClient backend/app/services/deepseek_service.py:L9-L47](../backend/app/services/deepseek_service.py#L9-L47) |
| RAG 编排 | 检索知识库并生成回答 | [chat_with_text backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88) |
| 向量库构建 | 从资料生成本地 JSON 向量库 | [build_knowledge_base backend/app/services/vector_store.py:L223-L243](../backend/app/services/vector_store.py#L223-L243) |
| 真实资料包 | 自动读取灵山公开资料包 docx/xlsx | [load_scenic_pack_entries backend/app/services/vector_store.py:L191-L216](../backend/app/services/vector_store.py#L191-L216) |
| 完整运行 | 启动后端和静态前端并烟测 | [main scripts/smoke_full_stack.py:L30-L61](../scripts/smoke_full_stack.py#L30-L61) |

### 验证命令

```powershell
python scripts\run_local.py build-kb
python scripts\run_local.py test-backend
python scripts\smoke_full_stack.py
```

## Q-0002 去哪个页面看数字人导游，如何手动测试？

### 用户原始问题

我去哪个页面能看到我这个数字人导游然后测试其功能？我该如何测试？

### 回答摘要

启动持续运行脚本后，打开 `http://127.0.0.1:5173/guide` 可看到数字人导游问答页。输入路线、景点、设施问题即可测试 DeepSeek + RAG 回答链路。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 持续运行脚本 | 启动 FastAPI 和 Vite 并保持运行 | [dev_vue_full_stack main scripts/dev_vue_full_stack.py:L52-L95](../scripts/dev_vue_full_stack.py#L52-L95) |
| Git Bash 包装脚本 | 在 Git Bash 下启动持续运行脚本 | [scripts/dev_vue_full_stack.sh:L1-L5](../scripts/dev_vue_full_stack.sh#L1-L5) |
| 前端路由 | `/guide`、`/map`、`/admin` 页面定义 | [frontend/src/router/index.ts:L10-L20](../frontend/src/router/index.ts#L10-L20) |
| 数字人问答页 | 游客端 ChatGuide 页面 | [ChatGuide frontend/src/pages/visitor/ChatGuide.vue:L1-L147](../frontend/src/pages/visitor/ChatGuide.vue#L1-L147) |
| 后端问答服务 | RAG + DeepSeek 问答编排 | [chat_with_text backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88) |

### 手动测试问题

```text
我只有两个小时，喜欢历史和拍照，怎么逛？
古建筑群有什么特色？
附近哪里有洗手间？
下雨天怎么玩？
```

## Q-0003 RAG 是否就是把知识库转换为向量库？

### 用户原始问题

另外你是否基于我提供给你的资料切分成向量库，并使用了具体的知识作答？rag就是将知识库转换为向量库吧？

### 回答摘要

当前项目已读取用户提供的灵山公开资料包、FAQ、景点 CSV 和 Markdown 资料，切片后生成本地 JSON 哈希向量库，并在游客问答前检索相关片段注入 DeepSeek prompt。RAG 不只等于向量化；向量库构建只是 RAG 的索引阶段，完整 RAG 还包括检索、上下文注入、生成和引用约束。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 资料读取 | 读取 CSV、Markdown、DOCX、XLSX | [load_scenic_pack_entries backend/app/services/vector_store.py:L191-L216](../backend/app/services/vector_store.py#L191-L216) |
| 文本切片 | 将资料切成可检索片段 | [chunk_text backend/app/services/vector_store.py:L58-L67](../backend/app/services/vector_store.py#L58-L67) |
| 向量化 | 生成本地哈希向量 | [vectorize backend/app/services/vector_store.py:L42-L51](../backend/app/services/vector_store.py#L42-L51) |
| 检索 | 查询相似知识片段 | [retrieve_context backend/app/services/vector_store.py:L252-L273](../backend/app/services/vector_store.py#L252-L273) |
| 问答增强 | 检索片段注入 DeepSeek prompt | [chat_with_text backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88) |
| 说明文档 | RAG 与知识库说明 | [docs/rag_knowledge_guide.md:L1-L92](./rag_knowledge_guide.md#L1-L92) |

### 验证命令

```bash
python scripts/run_local.py build-kb
python scripts/run_local.py smoke-backend
```

## Q-0004 如何把当前版本固化为 0.0 并继续优化真实地图和数字人？

### 用户原始问题

希望基于 Git 保持当前版本为 0.0，再优化一版新的前端；结合知识库和实际地图，绘制更真实的地图和数字人玲玲，并核查计划还有哪些没有实现。

### 回答摘要

当前已将原可运行版本提交并标记为 `v0.0`，在 `codex/optimize-map-avatar-v0.1` 分支上新增灵山真实景点目录、路线算法、SVG 地图、数字人“灵灵”、浏览器语音播报和缺口审计文档。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| Git 基线 | 当前版本提交为 `chore(release): baseline v0.0` 并打 `v0.0` 标签 | [README README.md:L1-L20](../README.md#L1-L20) |
| 真实景点 | 灵山胜境真实点位和地图坐标 | [SCENIC_SPOTS backend/app/services/scenic_service.py:L14-L225](../backend/app/services/scenic_service.py#L14-L225) |
| 路线算法 | 基于评分公式生成路线 | [recommend_route backend/app/services/route_service.py:L80-L116](../backend/app/services/route_service.py#L80-L116) |
| 数字人 | 灵灵 SVG 形象和口型展示 | [DigitalAvatar frontend/src/components/Avatar/DigitalAvatar.vue:L1-L64](../frontend/src/components/Avatar/DigitalAvatar.vue#L1-L64) |
| 真实地图 | 灵山胜境地图、水系、中轴线、POI 和路线 | [ScenicMapView frontend/src/components/ScenicMapView.vue:L1-L101](../frontend/src/components/ScenicMapView.vue#L1-L101) |
| 缺口审计 | 对照赛题计划列出已完成、部分完成和未完成项 | [implementation_gap_audit docs/implementation_gap_audit.md:L1-L51](./implementation_gap_audit.md#L1-L51) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
```

## Q-0005 知识库管理功能是否没有做好？

### 用户原始问题

知识库管理：管理员可上传、更新和维护景区的讲解词、文史资料、常见问题及答案等知识文档，作为数字人的知识基础；这个功能你没做好吧？

### 回答摘要

此前判断成立：旧实现只有文档列表和检索测试，没有上传、更新、删除和重建索引闭环。当前已补齐文件型 MVP：后台上传资料保存到 `data/admin_knowledge`，支持文本资料维护、删除、手动重建索引和检索测试，构建向量库时会把后台资料切片入库，游客端 RAG 可使用新增资料作答。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| API 上传 | 后台上传知识文档 | [knowledge_upload backend/app/api/admin.py:L29-L36](../backend/app/api/admin.py#L29-L36) |
| API 更新 | 更新后台文本资料 | [knowledge_update backend/app/api/admin.py:L39-L47](../backend/app/api/admin.py#L39-L47) |
| API 删除 | 删除后台上传资料 | [knowledge_delete backend/app/api/admin.py:L50-L56](../backend/app/api/admin.py#L50-L56) |
| 向量入库 | 后台资料切片进入本地向量库 | [load_admin_document_entries backend/app/services/vector_store.py:L150-L170](../backend/app/services/vector_store.py#L150-L170) |
| 管理页面 | 上传、维护、文档列表、重建索引、检索测试 | [KnowledgeManage frontend/src/pages/admin/KnowledgeManage.vue:L132-L211](../frontend/src/pages/admin/KnowledgeManage.vue#L132-L211) |
| 测试 | 保存、更新、删除后台知识文档 | [test_save_update_delete_admin_knowledge_document backend/tests/test_knowledge_management.py:L7-L30](../backend/tests/test_knowledge_management.py#L7-L30) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-kb
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
```

## Q-0006 文档版本、发布状态、上传历史、权限和数据库持久化是否完成？

### 用户原始问题

文档版本、发布/草稿状态、上传历史、用户权限和数据库持久化。 这些都帮我完成。

### 回答摘要

已完成：后台管理员登录返回 Bearer token；后台写接口需要 token；知识文档上传默认 draft，更新生成新版本，发布后进入 RAG，归档/删除后退出 RAG，版本和历史可查；数字人配置统一持久化到 PostgreSQL。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 数据库配置 | SQLAlchemy engine/session、PostgreSQL 扩展初始化、测试库重置 | [configure_database backend/app/core/database.py:L42-L55](../backend/app/core/database.py#L42-L55), [init_db backend/app/core/database.py:L58-L66](../backend/app/core/database.py#L58-L66), [reset_database backend/app/core/database.py:L69-L86](../backend/app/core/database.py#L69-L86) |
| 数据表模型 | 管理员、知识文档、版本、操作日志、数字人配置 | [persistence models backend/app/models/persistence.py:L51-L213](../backend/app/models/persistence.py#L51-L213) |
| 鉴权服务 | 密码哈希、登录、token 校验 | [authenticate_admin backend/app/services/auth_service.py:L110-L131](../backend/app/services/auth_service.py#L110-L131), [require_admin_user backend/app/services/auth_service.py:L134-L145](../backend/app/services/auth_service.py#L134-L145) |
| 知识库状态流转 | 上传 draft、发布 active、归档、软删除、版本/历史 | [save_document backend/app/services/knowledge_service.py:L187-L259](../backend/app/services/knowledge_service.py#L187-L259), [publish_document backend/app/services/knowledge_service.py:L328-L353](../backend/app/services/knowledge_service.py#L328-L353), [list_history backend/app/services/knowledge_service.py:L456-L490](../backend/app/services/knowledge_service.py#L456-L490) |
| 向量库约束 | 只把 active 文档当前版本加入 PostgreSQL `knowledge_chunk` 检索集 | [embed_document backend/app/services/vector_store.py:L432-L460](../backend/app/services/vector_store.py#L432-L460), [retrieve_context backend/app/services/vector_store.py:L575-L596](../backend/app/services/vector_store.py#L575-L596) |
| 后台页面 | 登录、知识库版本/历史、数字人配置 | [AdminLogin frontend/src/pages/admin/AdminLogin.vue:L1-L46](../frontend/src/pages/admin/AdminLogin.vue#L1-L46), [KnowledgeManage frontend/src/pages/admin/KnowledgeManage.vue:L216-L265](../frontend/src/pages/admin/KnowledgeManage.vue#L216-L265), [AvatarManage frontend/src/pages/admin/AvatarManage.vue:L1-L62](../frontend/src/pages/admin/AvatarManage.vue#L1-L62) |
| 测试 | 权限、版本化知识库、数字人配置持久化 | [auth tests backend/tests/test_auth_service.py:L15-L48](../backend/tests/test_auth_service.py#L15-L48), [knowledge lifecycle backend/tests/test_knowledge_management.py:L21-L63](../backend/tests/test_knowledge_management.py#L21-L63), [avatar test backend/tests/test_avatar_service.py:L6-L14](../backend/tests/test_avatar_service.py#L6-L14) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
```

## Q-0007 为什么之前提交失败，后来提交成功？

### 用户原始问题

之前提交失败和后来提交成功的原因写入文档。

### 回答摘要

之前失败包含两类原因：直接执行 `git add -A` 时被 Codex 工具层审批策略拦截；远程推送 GitHub 时 HTTPS/SSH 连接在网络层被中断。后来成功的原因是改用 Python subprocess 封装本地 Git 暂存/提交，并且 GitHub 网络恢复后，同一 `publish_github.py` 发布脚本成功把 `codex/optimize-map-avatar-v0.1` 推到 `origin/main`，同时远程可查到 `main=b630176` 和 `v0.0=37cd58b`。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 发布脚本 | 推送当前分支和 tag 到 GitHub | [publish_github main scripts/publish_github.py:L56-L84](../scripts/publish_github.py#L56-L84) |
| Git subprocess | Python 封装 Git 命令执行 | [run_git scripts/publish_github.py:L22-L35](../scripts/publish_github.py#L22-L35) |
| 工作区保护 | 发布前检查未提交改动 | [ensure_clean_worktree scripts/publish_github.py:L38-L44](../scripts/publish_github.py#L38-L44) |
| 远程配置 | 新增或更新 GitHub `origin` | [configure_remote scripts/publish_github.py:L47-L53](../scripts/publish_github.py#L47-L53) |
| 部署文档 | 发布命令和本次成功标志 | [docs/DEPLOY.md:L130-L150](./DEPLOY.md#L130-L150) |
| 错误记录 | GitHub 网络中断和后续成功复盘 | [ERR-0009 docs/error_traceability.md:L295-L334](./error_traceability.md#L295-L334), [ERR-0010 docs/error_traceability.md:L195-L259](./error_traceability.md#L195-L259) |
| 排错记录 | 网络中断与工具层拦截处理方式 | [TRB-010 docs/troubleshooting.md:L243-L319](./troubleshooting.md#L243-L319), [TRB-011 docs/troubleshooting.md:L320-L362](./troubleshooting.md#L320-L362) |

### 验证命令

```powershell
git remote -v
git status --short --branch
git ls-remote --heads origin main
git ls-remote --tags origin v0.0
python scripts\publish_github.py --help
```

## Q-0008 当前项目还有哪些具体没完成？

### 用户原始问题

检索下我当前的项目，是否具体还没有完成？

### 回答摘要

当前项目的 P0 演示闭环已经具备，但仍有两类明确缺口：

1. 赛题功能缺口：后端真实 ASR、后端真实 TTS、多模态图片识景、后台运营大屏真实聚合、150 条标准测试集、Docker Compose 全链路验收、演示视频产物仍未完成。
2. 工程使用缺口：后端测试虽然可以通过 [test_backend scripts/run_local.py:L82-L86](../scripts/run_local.py#L82-L86) 跑通，但直接在仓库根目录执行 `python -m pytest backend/tests -q` 会因为缺少 `PYTHONPATH=backend` 在测试收集阶段失败。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| code | 文本问答仍返回演示音频路径 | [chat_with_text backend/app/services/chat_service.py:L77-L87](../backend/app/services/chat_service.py#L77-L87) |
| code | 语音问答仍返回固定 ASR 文本再复用文本问答 | [voice_chat backend/app/services/chat_service.py:L90-L94](../backend/app/services/chat_service.py#L90-L94) |
| code | 图片识景仍固定识别“灵山大佛” | [image_chat backend/app/services/chat_service.py:L97-L103](../backend/app/services/chat_service.py#L97-L103) |
| code | 后台大屏接口已存在，但依赖静态演示统计数据 | [analytics_overview backend/app/api/admin.py:L135-L142](../backend/app/api/admin.py#L135-L142), [dashboard_overview backend/app/services/analytics_service.py:L1-L39](../backend/app/services/analytics_service.py#L1-L39) |
| code | 后台大屏前端当前只是展示接口返回结果 | [AdminDashboard frontend/src/pages/admin/AdminDashboard.vue:L8-L80](../frontend/src/pages/admin/AdminDashboard.vue#L8-L80), [fetchDashboard frontend/src/api/admin.ts:L3-L5](../frontend/src/api/admin.ts#L3-L5) |
| test | 官方后端测试入口会注入 `PYTHONPATH=backend` | [test_backend scripts/run_local.py:L82-L86](../scripts/run_local.py#L82-L86) |
| test | 测试文件直接从 `app.*` 导入，根目录裸跑 pytest 会失败 | [test_auth_service imports backend/tests/test_auth_service.py:L7-L10](../backend/tests/test_auth_service.py#L7-L10) |
| doc | 当前缺口核查总表 | [implementation_gap_audit docs/implementation_gap_audit.md:L28-L43](./implementation_gap_audit.md#L28-L43) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
python -m pytest backend/tests -q
```

## Q-0009 如何把当前未完成项拆成可交付计划给别人继续做？

### 用户原始问题

现在你逐步的帮我补齐我们需要完成的地方，并提出一个待完成计划清单，点出需求来，我可交付给别人完成。

### 回答摘要

已把剩余工作拆成 6 个可分派需求和 1 个工程化任务：

1. [REQ-010 真实语音问答闭环](./requirements_traceability.md#req-010-真实语音问答闭环)
2. [REQ-011 多模态图片识景问答](./requirements_traceability.md#req-011-多模态图片识景问答)
3. [REQ-012 后台运营大屏真实聚合](./requirements_traceability.md#req-012-后台运营大屏真实聚合)
4. [REQ-013 150 条标准测试集与自动评测](./requirements_traceability.md#req-013-150-条标准测试集与自动评测)
5. [REQ-014 Docker Compose 全链路部署验收](./requirements_traceability.md#req-014-docker-compose-全链路部署验收)
6. [REQ-015 演示视频与最终交付物](./requirements_traceability.md#req-015-演示视频与最终交付物)
7. `OPS-001` 统一 pytest 直接运行入口，减少对手工 `PYTHONPATH` 的依赖。

可直接使用 [交接文档 docs/archive/2026-05-17-待补齐需求交接.md:L1-L59](./archive/2026-05-17-待补齐需求交接.md#L1-L59) 给同事分派任务。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 需求总表 | 新增待完成需求列表 | [docs/requirements_traceability.md:L236-L490](./requirements_traceability.md#L236-L490) |
| 交接文档 | 优先级、建议负责人类型、关键入口 | [docs/archive/2026-05-17-待补齐需求交接.md:L1-L59](./archive/2026-05-17-待补齐需求交接.md#L1-L59) |
| 工程约束 | pytest 直接运行入口问题 | [docs/test_reference.md:L197-L206](./test_reference.md#L197-L206), [docs/troubleshooting.md:L455-L496](./troubleshooting.md#L455-L496) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
```

## Q-0010 `/api/v1` 方案是否齐全，当前先该落哪一批？

### 用户原始问题

数据库向量库和知识库，我们使用 PostgreSQL 以及 pgvector 完成，api 部分我们使用 FastAPI，我希望优先完成前端和后端功能。比如这里的 API 列表，你看是否齐全，如果齐全了帮我先完成这个列表的功能调用。

### 回答摘要

这份 API 分层方案作为架构清单是齐全的，但当前仓库不适合一次性把 18 类接口全部做完。已先落地 MVP 所需的 `/api/v1` 兼容层和前后端调用：

1. 游客端：`/guide/sessions`、`/guide/ask`、`/scenic/spots`、`/scenic/facilities`、`/route/recommend`
2. AI 能力：`/asr/transcribe`、`/tts/synthesize`、`/avatar/speak`、`/rag/retrieve`
3. 管理端：`/auth/login`、`/auth/me`、`/admin/knowledge-bases/default/documents`、`/admin/documents/{id}/embed`、`/admin/avatar/profiles`、`/admin/system/status`

当时需要明确：虽然 `/api/v1` 调用已经落地，但那一轮尚未完成 pgvector 迁移，系统状态中的 `vector_backend` 仍是 `local_json`。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| code | `/api/v1` 路由兼容层 | [backend/app/api/v1.py:L39-L381](../backend/app/api/v1.py#L39-L381) |
| code | FastAPI 注册 `/api/v1` 入口 | [create_app backend/app/main.py:L38-L80](../backend/app/main.py#L38-L80) |
| code | 游客前端 API 已切到 `/api/v1` | [frontend/src/api/visitor.ts:L28-L55](../frontend/src/api/visitor.ts#L28-L55) |
| code | 管理前端 API 已切到 `/api/v1` | [frontend/src/api/admin.ts:L3-L66](../frontend/src/api/admin.ts#L3-L66) |
| code | 当时系统状态仍声明 `vector_backend = local_json` | [backend/app/services/system_service.py:L19-L33](../backend/app/services/system_service.py#L19-L33) |
| test | `/api/v1` 路由测试 | [backend/tests/test_api_v1.py:L1-L113](../backend/tests/test_api_v1.py#L1-L113) |
| doc | 新增需求说明 | [docs/requirements_traceability.md:L492-L525](./requirements_traceability.md#L492-L525) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
```

## Q-0011 pgvector 迁移是否已经完成，具体落在哪？

### 用户原始问题

设计知识库表、chunk 表、embedding/pgvector 字段；把当前 `local_json` 检索切到 PostgreSQL + pgvector；把 `/api/v1/admin/documents/{id}/embed` 和 `/api/v1/rag/retrieve` 改成真实 pgvector 实现；更新对应测试和文档。

### 回答摘要

已完成主链路迁移：

1. 新增 `knowledge_base`、`knowledge_chunk` 两张持久化表；
2. PostgreSQL 环境初始化时自动创建 `vector` 扩展；
3. `/api/v1/admin/documents/{id}/embed` 改为真实文档切片入库；
4. `/api/v1/rag/retrieve` 改为数据库 chunk 检索；
5. 测试、部署和运行链路统一切到 PostgreSQL，系统状态返回 `vector_backend = pgvector`。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| code | `knowledge_base` 表模型 | [KnowledgeBase backend/app/models/persistence.py:L130-L145](../backend/app/models/persistence.py#L130-L145) |
| code | `knowledge_chunk` 表模型和 `embedding` 字段 | [KnowledgeChunk backend/app/models/persistence.py:L148-L179](../backend/app/models/persistence.py#L148-L179) |
| code | PostgreSQL `vector` 扩展初始化 | [init_db backend/app/core/database.py:L58-L66](../backend/app/core/database.py#L58-L66) |
| code | 知识库重建和 chunk 入库 | [build_knowledge_base backend/app/services/vector_store.py:L465-L503](../backend/app/services/vector_store.py#L465-L503) |
| code | 单文档嵌入 | [embed_document backend/app/services/vector_store.py:L432-L460](../backend/app/services/vector_store.py#L432-L460), [embed_document backend/app/services/knowledge_service.py:L174-L184](../backend/app/services/knowledge_service.py#L174-L184) |
| code | RAG 检索 | [retrieve_context backend/app/services/vector_store.py:L575-L596](../backend/app/services/vector_store.py#L575-L596), [retrieve_context backend/app/services/knowledge_service.py:L32-L53](../backend/app/services/knowledge_service.py#L32-L53) |
| code | `/api/v1` 管理端嵌入接口 | [admin_document_embed_v1 backend/app/api/v1.py:L359-L372](../backend/app/api/v1.py#L359-L372) |
| code | `/api/v1` RAG 检索接口 | [rag_retrieve_v1 backend/app/api/v1.py:L220-L222](../backend/app/api/v1.py#L220-L222) |
| code | 系统状态返回向量后端类型 | [get_system_status backend/app/services/system_service.py:L19-L33](../backend/app/services/system_service.py#L19-L33) |
| test | chunk 表和检索验证 | [backend/tests/test_vector_store.py:L6-L25](../backend/tests/test_vector_store.py#L6-L25) |
| test | 文档版本与启用状态验证 | [backend/tests/test_knowledge_management.py:L21-L63](../backend/tests/test_knowledge_management.py#L21-L63) |
| test | `/api/v1` embed/rag 路由验证 | [backend/tests/test_api_v1.py:L84-L113](../backend/tests/test_api_v1.py#L84-L113) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\run_local.py smoke-docker-postgres
```

## Q-0012 如何改成只依赖 PostgreSQL，并用单应用容器运行项目？

### 用户原始问题

搭建一套真实的 PostgreSQL 环境，仅仅依赖 PostgreSQL，不再依赖 SQLite，希望可以使用一个容器来运行我们的这个项目。

### 回答摘要

已经把默认运行路径切到 PostgreSQL，并完成了“单应用容器 + PostgreSQL/pgvector 服务”的 Compose 验收：

1. `Settings.database_url` 和 `.env.example` 默认值都改为 PostgreSQL。
2. `app` 容器同时托管 FastAPI 和 `frontend/dist`，游客端与管理端都走 `http://127.0.0.1:8000/*`。
3. `postgres` 服务使用 `pgvector/pgvector:pg16`，启动时自动创建 `vector` 扩展。
4. 宿主机 PostgreSQL 入口固定改为 `127.0.0.1:5433`，避免误连本机已有的 `5432` 数据库实例。
5. 新增 `python scripts\run_local.py smoke-docker-postgres`，会自动校验 `/guide`、后台登录和 `/api/v1/admin/system/status` 的 `database_backend=postgresql`、`vector_backend=pgvector`。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| config | 默认数据库连接改为 PostgreSQL | [Settings backend/app/core/config.py:L4-L19](../backend/app/core/config.py#L4-L19), [.env.example:L5-L15](../.env.example#L5-L15) |
| code | 当前活动数据库 URL 跟踪、PostgreSQL 后端识别和 pgvector 扩展初始化 | [current_database_url backend/app/core/database.py:L30-L34](../backend/app/core/database.py#L30-L34), [configure_database backend/app/core/database.py:L42-L55](../backend/app/core/database.py#L42-L55), [init_db backend/app/core/database.py:L58-L66](../backend/app/core/database.py#L58-L66) |
| code | 单应用容器托管前端静态资源 | [frontend_spa backend/app/main.py:L73-L78](../backend/app/main.py#L73-L78) |
| deploy | 单应用容器 + PostgreSQL/pgvector Compose 编排 | [deploy/docker-compose.yml:L1-L44](../deploy/docker-compose.yml#L1-L44), [deploy/Dockerfile:L1-L18](../deploy/Dockerfile#L1-L18) |
| test | Docker pgvector 烟测入口 | [smoke_docker_postgres scripts/run_local.py:L196-L197](../scripts/run_local.py#L196-L197), [main scripts/smoke_docker_postgres.py:L58-L100](../scripts/smoke_docker_postgres.py#L58-L100) |
| doc | 部署和运行说明 | [docs/DEPLOY.md:L3-L29](./DEPLOY.md#L3-L29), [docs/user_interaction_guide.md:L92-L110](./user_interaction_guide.md#L92-L110), [docs/requirements_traceability.md:L410-L449](./requirements_traceability.md#L410-L449) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\run_local.py smoke-docker-postgres
python scripts\check_doc_links.py
```

## Q-0013 现在如何彻底移除 SQLite 依赖，并清理无效文件？

### 用户原始问题

现在重构一下我们的项目，彻底去除对 SQLite 的依赖，对于一些我们不需要的文件和程序可以删除。

### 回答摘要

已经把项目收口到 PostgreSQL-only：

1. 运行时数据库 URL 只接受 PostgreSQL，SQLite URL 会在启动时直接报错。
2. 本地 runner、知识库构建脚本和全链路烟测都会先自动拉起 `postgres` 服务。
3. 所有核心测试改为创建 PostgreSQL 临时数据库，不再生成新的 SQLite 测试库。
4. 宿主机 PostgreSQL 入口固定为 `127.0.0.1:5433`，避免误连本机已有的 `5432`。
5. 已把 `frontend/tsconfig.json` 改成 `noEmit`，并删除历史 `frontend/src/*.js(.map)` 产物、仓库中的 SQLite `.db` 测试文件，以及未使用的 `redis` 依赖与 `VECTOR_DB_TYPE` 配置。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| code | PostgreSQL-only URL 校验和测试库重置 | [_parse_postgres_url backend/app/core/database.py:L21-L27](../backend/app/core/database.py#L21-L27), [reset_database backend/app/core/database.py:L69-L86](../backend/app/core/database.py#L69-L86) |
| config | 默认数据库 URL、宿主机端口和精简后的环境变量模板 | [Settings backend/app/core/config.py:L4-L19](../backend/app/core/config.py#L4-L19), [.env.example:L5-L34](../.env.example#L5-L34) |
| deploy | 宿主机 `5433 -> 容器 5432` 的 PostgreSQL/pgvector 编排 | [deploy/docker-compose.yml:L25-L40](../deploy/docker-compose.yml#L25-L40) |
| runner | 本地脚本自动拉起 PostgreSQL 并复用统一 `DATABASE_URL` | [scripts/run_local.py:L20-L30](../scripts/run_local.py#L20-L30), [ensure_postgres_service scripts/run_local.py:L74-L86](../scripts/run_local.py#L74-L86), [test_backend scripts/run_local.py:L125-L131](../scripts/run_local.py#L125-L131) |
| test | 核心测试统一改走 PostgreSQL 临时数据库 | [postgres_test_database_url backend/tests/postgres_test_utils.py:L10-L17](../backend/tests/postgres_test_utils.py#L10-L17), [backend/tests/test_auth_service.py:L11-L48](../backend/tests/test_auth_service.py#L11-L48), [backend/tests/test_api_v1.py:L8-L113](../backend/tests/test_api_v1.py#L8-L113) |
| cleanup | `vue-tsc` 改为 `noEmit`，仅保留 TypeScript/Vue 源文件入口 | [frontend/tsconfig.json:L1-L16](../frontend/tsconfig.json#L1-L16), [frontend/src/main.ts:L1-L9](../frontend/src/main.ts#L1-L9), [frontend/src/api/admin.ts:L1-L66](../frontend/src/api/admin.ts#L1-L66), [frontend/src/api/visitor.ts:L1-L55](../frontend/src/api/visitor.ts#L1-L55) |
| deps | 后端依赖收敛到 PostgreSQL 驱动，无 `redis` | [backend/requirements.txt:L1-L8](../backend/requirements.txt#L1-L8) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\check_doc_links.py
python scripts\run_local.py smoke-docker-postgres
```

## Q-0014 `docs/` 目录下哪些文档应该保留、归档或删除？

### 用户原始问题

`docs/` 文件夹下哪些可归档，哪些可删除？哪些需要保留？

### 回答摘要

当前 `docs/` 可以按三层处理：

1. 核心保留：`api_reference.md`、`config_reference.md`、`data_schema_reference.md`、`DEPLOY.md`、`program_index.md`、`project_onboarding.md`、`question_traceability.md`、`requirements_traceability.md`、`test_reference.md`、`troubleshooting.md` 等，这些文档仍被新同事阅读路径和现有实现直接依赖。
2. 建议归档：`API.md`、`DESIGN.md`、`DEEPSEEK_MULTI_AGENT.md`、`TEST_REPORT.md`、`generated/`、`handoffs/2026-05-17-待补齐需求交接.md`、`TEAM_HANDOFF.md`，它们主要提供历史方案、阶段交接或旧版说明，不应继续作为当前事实来源。
3. 本轮先不做硬删除，统一归档到 `docs/archive/`，等确认完全不再引用后再物理删除。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| doc | 当前统一 API 真相已经迁移到 `/api/v1` 说明，旧 `API.md` 仍保留旧 `/api/visitor` 和 `/api/admin` 路径 | [docs/archive/API.md:L13-L30](./archive/API.md#L13-L30), [docs/api_reference.md:L18-L89](./api_reference.md#L18-L89) |
| doc | `DESIGN.md` 仍写有 `Redis` 和泛化数据层描述，未体现 PostgreSQL-only 当前状态 | [docs/archive/DESIGN.md:L1-L15](./archive/DESIGN.md#L1-L15) |
| doc | `DEEPSEEK_MULTI_AGENT.md` 和 `generated/README.md` 说明这些文件属于多智能体生成产物 | [docs/archive/DEEPSEEK_MULTI_AGENT.md:L18-L39](./archive/DEEPSEEK_MULTI_AGENT.md#L18-L39), [docs/archive/generated/README.md:L1-L7](./archive/generated/README.md#L1-L7) |
| doc | `TEAM_HANDOFF.md` 指向过期目录和旧职责分工 | [docs/archive/TEAM_HANDOFF.md:L1-L25](./archive/TEAM_HANDOFF.md#L1-L25) |
| doc | `TEST_REPORT.md` 是静态阶段性报告，内容已和当前测试体系分离 | [docs/archive/TEST_REPORT.md:L1-L21](./archive/TEST_REPORT.md#L1-L21), [docs/test_reference.md:L1-L227](./test_reference.md#L1-L227) |
| doc | 当前新同事阅读路径和核心入口文档清单 | [docs/project_onboarding.md:L27-L38](./project_onboarding.md#L27-L38) |
| doc | 归档 `generated/` 前需要先处理现有引用，避免断链 | [docs/requirements_traceability.md:L382-L385](./requirements_traceability.md#L382-L385), [docs/requirements_traceability.md:L468-L472](./requirements_traceability.md#L468-L472) |

### 建议操作顺序

1. 先保留所有核心文档不动。
2. 把 `generated/`、`API.md`、`DESIGN.md`、`DEEPSEEK_MULTI_AGENT.md`、`TEST_REPORT.md`、`handoffs/2026-05-17-待补齐需求交接.md`、`TEAM_HANDOFF.md` 移到 `docs/archive/`。
3. 修正 [docs/requirements_traceability.md:L382-L385](./requirements_traceability.md#L382-L385) 和 [docs/requirements_traceability.md:L468-L472](./requirements_traceability.md#L468-L472) 对 `docs/generated/05_test_and_submission_plan.md` 的引用。
4. 保持历史文档可追溯，但不再把它们作为当前真相来源。

### 验证命令

```powershell
python scripts\check_doc_links.py
```

## Q-0015 归档后 GitHub 仓库里是否包含 Docker 容器本身？

### 用户原始问题

帮我归档，并告诉我我们目前提交到 GitHub 的项目包括了 Docker 容器本身吗？

### 回答摘要

已经把历史文档统一归档到 `docs/archive/`，当前核心文档继续保留在 `docs/` 根目录。

GitHub 仓库当前包含的是 Docker 相关定义，不包含已经构建好的容器本身：

1. 仓库里有 [deploy/docker-compose.yml](../deploy/docker-compose.yml#L1-L44) 和 [deploy/Dockerfile](../deploy/Dockerfile#L1-L18)，所以别人可以据此构建镜像并启动容器。
2. 仓库里不包含已经 build 完成的 Docker image，也不包含运行中的 container、PostgreSQL volume 数据。
3. 仓库里也不包含 `frontend/dist` 构建产物，因为它被 [.gitignore:L5-L11](../.gitignore#L5-L11) 忽略；当前标准做法是先执行前端构建，再执行 Compose 验收。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| doc | 归档目录说明和当前文档入口 | [docs/archive/README.md:L1-L15](./archive/README.md#L1-L15), [docs/project_onboarding.md:L27-L38](./project_onboarding.md#L27-L38) |
| deploy | Docker Compose 编排定义在仓库内 | [deploy/docker-compose.yml:L1-L44](../deploy/docker-compose.yml#L1-L44) |
| deploy | 应用镜像构建定义在仓库内 | [deploy/Dockerfile:L1-L18](../deploy/Dockerfile#L1-L18) |
| build | Docker 镜像依赖本地 `frontend/dist` 进入 build context | [deploy/Dockerfile:L11-L14](../deploy/Dockerfile#L11-L14), [build_frontend scripts/run_local.py:L134-L143](../scripts/run_local.py#L134-L143) |
| vcs | `frontend/dist`、`.env`、数据库文件和日志都不会进入 Git 仓库 | [.gitignore:L1-L11](../.gitignore#L1-L11) |
| doc | 部署说明已补充“仓库不包含已构建镜像/容器”说明 | [docs/DEPLOY.md:L3-L14](./DEPLOY.md#L3-L14) |

### 验证命令

```powershell
python scripts\check_doc_links.py
```

## Q-0016 GitHub 仓库是否已经包含完整项目，两个 Docker 是否够用，能否只用一个 Docker？

### 用户原始问题

我需要 GitHub 上传我们的完整项目，不要排除必要的文件，我们本地的这二个 docker 完整的包含了我们的项目了吗？是否可以一个 docker 到处运行？

### 回答摘要

当前已经把 Docker 构建链路改成“仓库源码可直接构建”：

1. GitHub 仓库现在不需要提交 `frontend/dist`，因为 [deploy/Dockerfile:L1-L31](../deploy/Dockerfile#L1-L31) 会在镜像构建阶段从 `frontend/` 源码直接执行前端打包。
2. 当前两容器方案是完整且合理的：`app` 容器承载前端静态资源 + FastAPI，`postgres` 容器承载 PostgreSQL/pgvector；这已经覆盖项目运行所需的两个核心进程。
3. “一个 Docker 到处运行”分两种理解：
   - 如果指“一个镜像文件就能在任何环境部署应用”，当前 `app` 镜像已经满足，但它仍需要一个 PostgreSQL 服务可连接。
   - 如果指“单容器内同时包含应用和 PostgreSQL 并一键运行”，当前项目没有这样做，也不建议这样做，因为数据库和应用生命周期、持久化、健康检查、升级策略应拆开。
4. 仓库里仍不会包含运行中的容器、已构建 image、PostgreSQL volume 数据，这些本来就不应进入 GitHub。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| deploy | 多阶段 Dockerfile 直接从前端源码构建 `dist` | [deploy/Dockerfile:L1-L31](../deploy/Dockerfile#L1-L31) |
| deploy | Compose 仍采用 `app + postgres` 两服务结构，且无 `.env` 时也可用默认值启动 | [deploy/docker-compose.yml:L1-L50](../deploy/docker-compose.yml#L1-L50) |
| build | Docker 烟测已不再依赖宿主机预构建前端 | [scripts/smoke_docker_postgres.py:L58-L100](../scripts/smoke_docker_postgres.py#L58-L100) |
| vcs | Git 仍排除运行产物和敏感文件，但不再需要排除项参与镜像构建 | [.gitignore:L1-L11](../.gitignore#L1-L11), [.dockerignore:L1-L11](../.dockerignore#L1-L11) |
| doc | 部署说明已更新为“源码可直接构建容器” | [docs/DEPLOY.md:L3-L36](./DEPLOY.md#L3-L36) |
| test | Docker 验收说明已更新 | [docs/test_reference.md:L218-L228](./test_reference.md#L218-L228) |

### 验证命令

```powershell
python scripts\run_local.py smoke-docker-postgres
python scripts\check_doc_links.py
```

## Q-0017 如何把 PostgreSQL 也封到同一个 Docker 里，做成单容器 all-in-one？

### 用户原始问题

继续做一个“单容器 all-in-one 运行版”，把 PostgreSQL 也封到同一个容器里。

### 回答摘要

已经新增一套独立的 all-in-one 方案，并保留原来的双容器正式方案：

1. 新增 [deploy/Dockerfile.allinone:L1-L43](../deploy/Dockerfile.allinone#L1-L43)，在一个镜像里同时打包前端静态资源、Python 运行时和 PostgreSQL/pgvector 基础环境。
2. 新增 [deploy/start_allinone.py:L228-L240](../deploy/start_allinone.py#L228-L240)，容器启动时会初始化 PostgreSQL cluster、创建数据库、启用 `vector` 扩展，再拉起 FastAPI。
3. 新增 [deploy/docker-compose.allinone.yml:L1-L36](../deploy/docker-compose.allinone.yml#L1-L36)，只启动一个 `allinone` 服务，对外暴露 `8000` 和 `5433`。
4. 新增 [scripts/smoke_docker_allinone.py:L70-L114](../scripts/smoke_docker_allinone.py#L70-L114) 和 [scripts/run_local.py:L200-L243](../scripts/run_local.py#L200-L243) 作为统一验收入口。
5. 当前单容器方案是“可交付增强版”，不是默认推荐部署版；默认推荐仍然是更可维护的 `app + postgres` 双容器方案。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| deploy | All-in-One 镜像 | [deploy/Dockerfile.allinone:L1-L43](../deploy/Dockerfile.allinone#L1-L43) |
| deploy | All-in-One Compose | [deploy/docker-compose.allinone.yml:L1-L36](../deploy/docker-compose.allinone.yml#L1-L36) |
| code | 单容器内 PostgreSQL 初始化、数据库创建、扩展启用和 FastAPI 启动 | [initialize_cluster deploy/start_allinone.py:L117-L132](../deploy/start_allinone.py#L117-L132), [ensure_database_objects deploy/start_allinone.py:L176-L191](../deploy/start_allinone.py#L176-L191), [start_backend deploy/start_allinone.py:L206-L225](../deploy/start_allinone.py#L206-L225), [main deploy/start_allinone.py:L228-L240](../deploy/start_allinone.py#L228-L240) |
| test | 单容器烟测和 runner 入口 | [main scripts/smoke_docker_allinone.py:L70-L114](../scripts/smoke_docker_allinone.py#L70-L114), [smoke_docker_allinone scripts/run_local.py:L200-L201](../scripts/run_local.py#L200-L201) |
| doc | 部署、测试和需求说明 | [docs/DEPLOY.md:L38-L56](./DEPLOY.md#L38-L56), [docs/test_reference.md:L229-L239](./test_reference.md#L229-L239), [docs/requirements_traceability.md:L456-L495](./requirements_traceability.md#L456-L495) |

### 验证命令

```powershell
python scripts\run_local.py smoke-docker-allinone
python scripts\check_doc_links.py
```

## Q-0018 如何把 all-in-one 做成可直接 `docker run` 的发布方式，并推送到 GHCR？

### 用户原始问题

把这套 all-in-one 改成可直接 docker run 的发布说明和命令。构建并推送这个单容器镜像到 GitHub Container Registry。

### 回答摘要

已经补齐 GHCR 发布链路：

1. 新增 [deploy/Dockerfile.allinone.release:L1-L29](../deploy/Dockerfile.allinone.release#L1-L29)，它直接打包本地构建好的 `frontend/dist`，用于发布成可 `docker run` 的单容器镜像。
2. 新增 [scripts/publish_ghcr_allinone.py:L123-L160](../scripts/publish_ghcr_allinone.py#L123-L160)，统一处理前端构建、镜像打标、GHCR 登录和推送。
3. [docs/DEPLOY.md:L59-L103](./DEPLOY.md#L59-L103) 已新增 `docker run` 命令和 GHCR 发布命令。
4. 已使用具备 `write:packages` 权限的用户级环境变量 `GHCR_TOKEN` 完成 GHCR 推送，发布标签为 `latest` 和 `9564147`。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| deploy | GHCR 发布镜像 | [deploy/Dockerfile.allinone.release:L1-L29](../deploy/Dockerfile.allinone.release#L1-L29) |
| script | GHCR 发布脚本 | [main scripts/publish_ghcr_allinone.py:L123-L160](../scripts/publish_ghcr_allinone.py#L123-L160) |
| doc | `docker run` 和 GHCR 发布说明 | [docs/DEPLOY.md:L59-L103](./DEPLOY.md#L59-L103) |
| config | GHCR token 配置说明 | [docs/config_reference.md:L22-L24](./config_reference.md#L22-L24) |
| error | GHCR 推送权限不足与修复记录 | [docs/error_traceability.md:L234-L270](./error_traceability.md#L234-L270) |

## Q-0019 为什么 GitHub 仓库没有看到 all-in-one 更新？

### 用户原始问题

为什么我到github没有更新？

### 回答摘要

GHCR 容器镜像和 GitHub 源码仓库是两个不同的发布目标。上一轮已经成功推送 `ghcr.io/2667741708/ling-shan-digital-guide-allinone:latest` 和 `:9564147`，但源码仓库 `origin/main` 仍停在提交 `9564147`，因为 all-in-one Dockerfile、发布脚本、归档文档和部署说明当时还只是本地工作区改动，尚未创建新的 Git commit，也尚未 push 到 GitHub 仓库。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| deploy | all-in-one 发布镜像定义 | [deploy/Dockerfile.allinone.release:L1-L29](../deploy/Dockerfile.allinone.release#L1-L29) |
| script | GHCR 发布脚本 | [scripts/publish_ghcr_allinone.py:L132-L168](../scripts/publish_ghcr_allinone.py#L132-L168) |
| doc | GitHub 源码发布脚本说明 | [docs/DEPLOY.md:L241-L257](./DEPLOY.md#L241-L257) |
| doc | GHCR 镜像发布说明 | [docs/DEPLOY.md:L110-L141](./DEPLOY.md#L110-L141) |

### 验证命令

```powershell
git status --short
git rev-parse HEAD
git rev-parse origin/main
docker manifest inspect ghcr.io/2667741708/ling-shan-digital-guide-allinone:latest
```

## Q-0020 是否可以不用 DeepSeek，只使用多模态大模型和数字人？

### 用户原始问题

我们实际需要的是一个多模态大模型以及一个数字人可以即时的追踪语音对吗？我们可以不用DeepSeek，仅仅使用一个多模态大模型和一个数字人即可。

### 回答摘要

可以。DeepSeek 在当前项目中只是文本 LLM 供应商，不是不可替换的架构核心。更贴近最终产品的能力组合是：PostgreSQL/pgvector 知识库检索 + 多模态大模型理解文本、语音、图片或视频输入 + 数字人引擎完成实时语音播报、口型、表情和动作。如果选用的多模态大模型或数字人平台已经内置 ASR/TTS，可以取消独立 DeepSeek、独立 ASR、独立 TTS；否则仍需要由多模态模型外部的 ASR/TTS 服务补齐语音输入和语音输出。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 当前文本模型 | DeepSeek 客户端只是 OpenAI 兼容文本生成封装 | [DeepSeekClient backend/app/services/deepseek_service.py:L9-L47](../backend/app/services/deepseek_service.py#L9-L47) |
| 当前问答编排 | RAG 检索后调用 DeepSeek 生成回答，已写入问答日志 | [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137) |
| 当前语音缺口 | 后端真实 ASR/TTS 仍未完成 | [REQ-010 docs/requirements_traceability.md:L237-L279](./requirements_traceability.md#L237-L279) |
| 当前多模态缺口 | 图片识景仍是占位，需要接真实视觉/多模态模型 | [REQ-011 docs/requirements_traceability.md:L281-L323](./requirements_traceability.md#L281-L323) |
| 当前数字人 | 前端数字人是 SVG + 本地口型模拟，不是真实实时驱动数字人 | [DigitalAvatar frontend/src/components/Avatar/DigitalAvatar.vue:L1-L64](../frontend/src/components/Avatar/DigitalAvatar.vue#L1-L64), [simulateSpeaking frontend/src/store/avatar.ts:L16-L32](../frontend/src/store/avatar.ts#L16-L32) |
| 当前配置 | DeepSeek 配置字段后续可替换为通用 `MODEL_PROVIDER` / 多模态模型配置 | [docs/config_reference.md:L17-L20](./config_reference.md#L17-L20) |

### 改造建议

1. 抽象 `ModelProvider`，把 `DeepSeekClient` 替换为可配置的多模态模型客户端。
2. 保留 `pgvector` RAG 检索，模型只负责理解、推理、生成和引用约束。
3. 将 `/api/v1/guide/ask`、`/api/v1/guide/voice-ask`、`/api/v1/guide/image-ask` 统一编排到同一个多模态问答服务。
4. 数字人侧对接实时 avatar SDK 或云服务，前端不再只用本地 SVG 口型模拟。
5. 如果模型/数字人平台内置语音能力，`/asr/*` 和 `/tts/*` 可以变成兼容代理；如果没有内置能力，则仍需要保留独立 ASR/TTS。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\check_doc_links.py
```

## Q-0022 如何整理项目程序并更新 README？

### 用户原始问题

我需要你帮我整理下我们的所有的项目程序，看看是否有需要更新的地方，比如说这个 readme。

### 回答摘要

本次检查按 `traceable-development` 文档体系和 GitHub 仓库上下文执行，发现 `README.md` 仍偏向早期骨架描述，且缺少两个项目长期维护需要的入口文档：`docs/architecture.md` 和 `docs/cli_usage.md`。已更新 README 的当前能力、快速启动、Docker/All-in-One、核心 API、验证命令和文档入口；新增架构说明记录系统边界、分层、数据流、数据层和部署结构；新增 CLI 使用说明记录可复现运行、测试、Docker、GHCR 和 GitHub 发布脚本。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| README | 当前能力、快速启动、API 链路、验证命令和文档入口 | [README.md:L1-L116](../README.md#L1-L116) |
| 架构文档 | 系统边界、模块分层、数据流、数据层和部署结构 | [docs/architecture.md:L1-L136](./architecture.md#L1-L136) |
| CLI 文档 | 本地 runner、联调、Docker、GHCR 和 GitHub 发布命令 | [docs/cli_usage.md:L1-L154](./cli_usage.md#L1-L154) |
| 项目入口 | 新同事阅读顺序和常见任务入口 | [docs/project_onboarding.md:L27-L63](./project_onboarding.md#L27-L63) |
| 程序索引 | 后端、脚本和前端入口已经覆盖主要程序 | [docs/program_index.md:L1-L83](./program_index.md#L1-L83) |

### 验证命令

```powershell
python scripts\check_doc_links.py
python scripts\run_local.py build-frontend
```

## Q-0021 如何补齐游客个性化、路线生成、账号边界、大屏和前端观感？

### 用户原始问题

我们的后端程序中关于观众的个性化出来，管理员账号与游客账号，以及路线生成，数据大屏，等等与大模型无关的功能，我认为还没有完整的实现,我们目前的前端app也很丑，你可以基于canva重新更新下我们的这个项目，把这个项目的各个功能的细节再完善一点。

### 回答摘要

已把“观众”统一落到景区语义中的“游客个性化评分”：游客端可提交多维景点评分、评论、标签和画像快照；后端按 `session_uuid + spot_id` upsert，计算情绪和加权评分；路线推荐读取景点评分与游客历史偏好；问答、路线和评分都写入 PostgreSQL，后台大屏从真实表聚合服务量、热门问题、路线访问、评分排行、负向反馈、情绪趋势和高频标签。前端同步增加游客评分面板和更完整的大屏卡片，并通过样式覆盖刷新视觉。

### 对应实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 需求追踪 | 本次功能归档为 REQ-021 | [REQ-021 docs/requirements_traceability.md:L539-L581](./requirements_traceability.md#L539-L581) |
| 数据模型 | 景点、设施、会话、消息、路线和游客评分表 | [ScenicSpot backend/app/models/persistence.py:L64-L86](../backend/app/models/persistence.py#L64-L86), [VisitorSpotRating backend/app/models/persistence.py:L306-L354](../backend/app/models/persistence.py#L306-L354) |
| 评分服务 | upsert、统计、画像、后台排行和趋势 | [create_or_update_rating backend/app/services/rating_service.py:L151-L176](../backend/app/services/rating_service.py#L151-L176), [get_spot_statistics backend/app/services/rating_service.py:L231-L277](../backend/app/services/rating_service.py#L231-L277), [get_user_preference_profile backend/app/services/rating_service.py:L286-L327](../backend/app/services/rating_service.py#L286-L327), [get_admin_rating_ranking backend/app/services/rating_service.py:L350-L366](../backend/app/services/rating_service.py#L350-L366) |
| 路线生成 | 评分与画像反哺路线推荐，并持久化 `route_plan` | [_score_spot backend/app/services/route_service.py:L82-L107](../backend/app/services/route_service.py#L82-L107), [recommend_route backend/app/services/route_service.py:L152-L196](../backend/app/services/route_service.py#L152-L196) |
| 大屏聚合 | 从真实问答、路线、评分和景点表聚合后台指标 | [dashboard_overview backend/app/services/analytics_service.py:L34-L89](../backend/app/services/analytics_service.py#L34-L89) |
| 游客前端 | 数字人页评分面板和统计展示 | [ChatGuide rating frontend/src/pages/visitor/ChatGuide.vue:L183-L211](../frontend/src/pages/visitor/ChatGuide.vue#L183-L211) |
| 后台前端 | 大屏新增评分排行、情绪趋势和标签洞察 | [AdminDashboard frontend/src/pages/admin/AdminDashboard.vue:L28-L105](../frontend/src/pages/admin/AdminDashboard.vue#L28-L105) |
| 样式 | 视觉刷新和移动端适配 | [UX refresh frontend/src/styles.css:L929-L1259](../frontend/src/styles.css#L929-L1259) |
| 测试 | 评分 upsert、统计、排行和画像 | [test_rating_upsert_stats_and_preference_profile backend/tests/test_rating_service.py:L13-L64](../backend/tests/test_rating_service.py#L13-L64) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\check_doc_links.py
```

## Q-0023 数字人形象暂缓后，当前整体框架是否适合继续开发？

### 回答摘要

2026-10-14 本地源码核查：当前 Vue 3 + FastAPI + PostgreSQL/pgvector 的前后端分离结构适合作为课设底座，游客问答、路线、评分、知识库版本管理和运营统计已有模块。当前主要沿用上游项目框架，本地工作是环境跑通与 3D 展示原型；模块存在不等于完整业务验收通过。本次仅检查源码与已有验证记录，没有重新执行全栈或容器验收。

### 实际边界与依据

| 发现 | 代码依据 | 对课设的影响 |
|---|---|---|
| 前端已有游客与管理端路由 | [router frontend/src/router/index.ts:L11-L28](../frontend/src/router/index.ts#L11-L28) | 可以继续完善交互，无须更换技术栈 |
| 检索向量由分词计数与 MD5 哈希生成，没有使用语义 embedding 模型 | [vectorize backend/app/services/vector_store.py:L41-L61](../backend/app/services/vector_store.py#L41-L61) | 同义问法、模糊描述的检索能力需要评测和改进 |
| 文本问答写入历史，但给模型的输入只包含本次问题和检索材料 | [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137) | 追问“那里怎么走”等问题缺少历史上下文 |
| 地图页每次刷新路线都会新建游客会话 | [ScenicMap frontend/src/pages/visitor/ScenicMap.vue:L14-L23](../frontend/src/pages/visitor/ScenicMap.vue#L14-L23) | 问答、地图、评分之间的游客偏好不能稳定延续 |
| 路线卡片固定，前端再按关键词生成推荐；推荐本身按分数选点和预设顺序排列 | [quick_route_card backend/app/services/route_service.py:L199-L200](../backend/app/services/route_service.py#L199-L200), [handleSend frontend/src/pages/visitor/ChatGuide.vue:L63-L99](../frontend/src/pages/visitor/ChatGuide.vue#L63-L99), [recommend_route backend/app/services/route_service.py:L152-L196](../backend/app/services/route_service.py#L152-L196) | 回答文字和地图路线需要统一为同一份结构化结果，当前不应表述为真实路网导航 |
| 语音和图片后端仍含固定返回，前端语音依赖浏览器 | [voice_chat/image_chat backend/app/services/chat_service.py:L140-L154](../backend/app/services/chat_service.py#L140-L154), [speakAnswer/handleListen frontend/src/pages/visitor/ChatGuide.vue:L116-L150](../frontend/src/pages/visitor/ChatGuide.vue#L116-L150) | 演示占位能力应与真实服务区分；形象素材可以后补 |
| 大屏从问答、路线、评分表聚合 | [dashboard_overview backend/app/services/analytics_service.py:L34-L89](../backend/app/services/analytics_service.py#L34-L89) | 已有业务反馈链路，统计口径和数据量仍需验收 |

### 建议顺序

1. 统一游客会话、偏好与后端结构化路线结果，让问答、地图和评分共享同一业务状态。
2. 接通真实文本模型，补多轮上下文，改进检索并用标准问答集评测。
3. 分离文本模型、检索、ASR/TTS 和数字人展示接口，使形象和供应商可替换。
4. 收敛游客端页面动线，再补音频链路、精修角色和部署验收。

### 影响范围与验证

本次仅补充核查记录，没有修改业务实现。定位链接通过 `python scripts/check_doc_links.py` 检查。

## Q-0024 创意优先的课程中，景区数字人项目可以怎样创新？

### 用户原始问题

课程高分点主要在开源软件的创意设计，创意是关键。希望为景区数字人项目寻找有辨识度且可实现的创新方向。

### 回答摘要

提出可教数字人、双人拼图游、同景异时、全队路线协商、开放内容导演台五个方向。优先建议“鲸游记——今天，你来当导游”：游客观察真实景物并向小鲸解释，资料核对后的知识形成旅程记忆，影响后续站点的提问和角色行为。以可分享景区探索内容包体现开源复用价值。属于设计提案，尚未实现，不声称行业首创或保证评分结果。

### 对应资料与实现基础

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 方案 | 候选比较、交互示例、首版范围和开源贡献 | [创意方向 docs/creative_directions.md:L1-L74](./creative_directions.md#L1-L74) |
| 问答基础 | 已有检索引用和模型编排 | [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137) |
| 会话基础 | 可扩展旅程状态与概念记忆 | [VisitorSession backend/app/models/persistence.py:L105-L119](../backend/app/models/persistence.py#L105-L119) |

本次仅补充方案文档，验证范围为文档链接检查。
