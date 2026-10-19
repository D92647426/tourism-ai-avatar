# 测试方式和验证命令

## TEST-001 健康检查

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-003 |
| 测试函数 | [test_health backend/tests/test_health.py:L6-L10](../backend/tests/test_health.py#L6-L10) |
| 被测接口 | [health backend/app/main.py:L51-L53](../backend/app/main.py#L51-L53) |
| 运行命令 | `python scripts\run_local.py test-backend` |

## TEST-002 知识库构建

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-002 |
| 测试函数 | [test_build_knowledge_base_creates_entries backend/tests/test_vector_store.py:L6-L17](../backend/tests/test_vector_store.py#L6-L17) |
| 被测函数 | [build_knowledge_base backend/app/services/vector_store.py:L469-L507](../backend/app/services/vector_store.py#L469-L507) |
| 运行命令 | `python scripts\run_local.py build-kb` |

## TEST-003 知识库检索命中

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-002 |
| 测试函数 | [test_retrieve_context_finds_facility_answer backend/tests/test_vector_store.py:L20-L25](../backend/tests/test_vector_store.py#L20-L25) |
| 被测函数 | [retrieve_context backend/app/services/vector_store.py:L589-L612](../backend/app/services/vector_store.py#L589-L612) |
| 预期结果 | 查询“附近哪里有洗手间”可命中包含“洗手间”的知识片段 |

## TEST-004 问答服务单元测试

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-001 |
| 测试函数 | [test_chat_with_text_uses_references_and_latency backend/tests/test_chat_service.py:L5-L12](../backend/tests/test_chat_service.py#L5-L12) |
| 被测函数 | [chat_with_text backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88) |
| 预期结果 | 返回答案、引用来源、模型标记和真实延迟 |

## TEST-005 后端烟测

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-001、REQ-002、REQ-003 |
| 烟测脚本 | [smoke_test scripts/smoke_test.py:L41-L57](../scripts/smoke_test.py#L41-L57) |
| 启动脚本 | [smoke_backend scripts/run_local.py:L136-L146](../scripts/run_local.py#L136-L146) |
| 运行命令 | `python scripts\run_local.py smoke-backend` |

## TEST-006 完整栈烟测

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-003 |
| 烟测脚本 | [main scripts/smoke_full_stack.py:L30-L61](../scripts/smoke_full_stack.py#L30-L61) |
| 静态前端 | [frontend_static/index.html:L170-L218](../frontend_static/index.html#L170-L218) |
| 运行命令 | `python scripts\smoke_full_stack.py` |

## TEST-007 Vue 前端安装与构建

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-003 |
| 安装入口 | [install_frontend_deps scripts/run_local.py:L70-L71](../scripts/run_local.py#L70-L71) |
| 构建入口 | [build_frontend scripts/run_local.py:L74-L75](../scripts/run_local.py#L74-L75) |
| Vue 入口 | [frontend/src/main.ts:L1-L9](../frontend/src/main.ts#L1-L9) |
| 运行命令 | `python scripts\run_local.py install-frontend` 和 `python scripts\run_local.py build-frontend` |
| 预期结果 | `npm install` 成功，`vite build` 输出 `dist/` |

## TEST-008 Vue 完整栈烟测

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-003 |
| 烟测脚本 | [main scripts/smoke_vue_full_stack.py:L67-L122](../scripts/smoke_vue_full_stack.py#L67-L122) |
| 进程清理 | [terminate_tree scripts/smoke_vue_full_stack.py:L52-L62](../scripts/smoke_vue_full_stack.py#L52-L62) |
| 运行命令 | `python scripts\smoke_vue_full_stack.py` |
| 预期结果 | 输出 `vue full stack ok: http://127.0.0.1:5173` |

## TEST-009 Git Bash 命令兼容性

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-003 |
| Git Bash runner | [scripts/run_local.sh:L1-L5](../scripts/run_local.sh#L1-L5) |
| Git Bash Vue 烟测 | [scripts/smoke_vue_full_stack.sh:L1-L5](../scripts/smoke_vue_full_stack.sh#L1-L5) |
| Git Bash 手动体验 | [scripts/dev_vue_full_stack.sh:L1-L5](../scripts/dev_vue_full_stack.sh#L1-L5) |
| 运行命令 | `python scripts/smoke_vue_full_stack.py` |
| 预期结果 | 在 Git Bash 中使用 `/` 路径可运行，不能使用 `\` |

## TEST-010 Playwright CLI 页面验证

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-003 |
| Playwright 脚本 | [scripts/playwright_smoke_vue.py:L74-L125](../scripts/playwright_smoke_vue.py#L74-L125) |
| 运行命令 | `python scripts/playwright_smoke_vue.py` |
| 当前状态 | 脚本可启动 PostgreSQL、FastAPI 和 Vite，并会验证首页、`/guide`、`/admin/login`；当前机器下载 `@playwright/cli` 仍出现 registry `ECONNRESET`，应用验证以 `TEST-006`、`TEST-022`、`TEST-023` 为准 |

## TEST-011 手动测试数字人导游

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-001、REQ-003、REQ-006 |
| 启动脚本 | [dev_vue_full_stack main scripts/dev_vue_full_stack.py:L52-L95](../scripts/dev_vue_full_stack.py#L52-L95) |
| 前端路由 | [frontend/src/router/index.ts:L10-L20](../frontend/src/router/index.ts#L10-L20) |
| 问答页面 | [ChatGuide frontend/src/pages/visitor/ChatGuide.vue:L1-L147](../frontend/src/pages/visitor/ChatGuide.vue#L1-L147) |
| 数字人组件 | [DigitalAvatar frontend/src/components/Avatar/DigitalAvatar.vue:L1-L64](../frontend/src/components/Avatar/DigitalAvatar.vue#L1-L64) |
| 后端问答 | [chat_with_text backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88) |
| 运行命令 | `python scripts/dev_vue_full_stack.py` |
| 测试页面 | `http://127.0.0.1:5173/guide` |

## TEST-012 灵山地图和路线推荐

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-005 |
| 测试函数 | [test_route_service backend/tests/test_route_service.py:L6-L26](../backend/tests/test_route_service.py#L6-L26) |
| 景点数据 | [SCENIC_SPOTS backend/app/services/scenic_service.py:L14-L225](../backend/app/services/scenic_service.py#L14-L225) |
| 路线算法 | [recommend_route backend/app/services/route_service.py:L80-L116](../backend/app/services/route_service.py#L80-L116) |
| 地图组件 | [ScenicMapView frontend/src/components/ScenicMapView.vue:L1-L101](../frontend/src/components/ScenicMapView.vue#L1-L101) |
| 运行命令 | `python scripts\run_local.py test-backend` 和 `python scripts\run_local.py build-frontend` |
| 预期结果 | 后端返回真实灵山点位，2 小时历史拍照路线包含灵山核心景点，前端构建通过 |

## 本次验证记录

```text
python scripts\run_local.py build-kb
结果：entry_count = 3377

python scripts\run_local.py test-backend
结果：14 passed

python scripts\run_local.py smoke-backend
结果：DeepSeek 模型 deepseek-v4-flash 返回问答，知识库命中 faq_3

python scripts\smoke_full_stack.py
结果：后端和静态前端均可访问，完整栈烟测通过

python scripts\run_local.py install-frontend
结果：added 105 packages

python scripts\run_local.py build-frontend
结果：Vue/Vite production build 通过

PowerShell：`python scripts\smoke_vue_full_stack.py`
结果：Vue dev server + FastAPI + DeepSeek 问答完整栈通过，完成登录、草稿上传、发布、RAG 命中、游客端引用、软删除后不命中

后台知识库上传 API 验证：
结果：`POST /api/admin/knowledge/upload` 返回 draft，发布后检索来源命中 `data/admin_knowledge/{document_id}/v1_*.md`，随后 `DELETE /api/admin/knowledge/documents/{id}` 返回 deleted

python scripts\run_local.py smoke-docker-postgres
结果：Compose 单应用容器 + PostgreSQL/pgvector 烟测通过，`/guide` 可访问，`/api/v1/admin/system/status` 返回 `database_backend=postgresql`、`vector_backend=pgvector`
```

## TEST-013 GitHub 发布脚本帮助命令

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-009 |
| 测试命令 | `python scripts\publish_github.py --help` |
| 被测入口 | [main scripts/publish_github.py:L56-L84](../scripts/publish_github.py#L56-L84) |
| 远程配置逻辑 | [configure_remote scripts/publish_github.py:L47-L53](../scripts/publish_github.py#L47-L53) |
| 工作区保护 | [ensure_clean_worktree scripts/publish_github.py:L38-L44](../scripts/publish_github.py#L38-L44) |
| 预期结果 | 输出 `--remote-url`、`--branch`、`--push-tags` 等参数说明，不修改远程仓库 |

## TEST-014 后台知识库文档维护

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-007、REQ-017 |
| 测试函数 | [test_versioned_knowledge_document_lifecycle backend/tests/test_knowledge_management.py:L21-L63](../backend/tests/test_knowledge_management.py#L21-L63) |
| 被测函数 | [save_document backend/app/services/knowledge_service.py:L187-L259](../backend/app/services/knowledge_service.py#L187-L259), [embed_document backend/app/services/knowledge_service.py:L174-L184](../backend/app/services/knowledge_service.py#L174-L184), [publish_document backend/app/services/knowledge_service.py:L328-L353](../backend/app/services/knowledge_service.py#L328-L353), [delete_document backend/app/services/knowledge_service.py:L382-L407](../backend/app/services/knowledge_service.py#L382-L407) |
| 运行命令 | `python scripts\run_local.py test-backend` |
| 预期结果 | 上传即生成 draft chunk，draft 不可检索；发布后当前版本 chunk 可检索；软删除后 chunk 禁用且历史保留 |

## TEST-015 后台知识库页面构建验证

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-007 |
| 页面入口 | [KnowledgeManage frontend/src/pages/admin/KnowledgeManage.vue:L132-L211](../frontend/src/pages/admin/KnowledgeManage.vue#L132-L211) |
| API 客户端 | [admin api frontend/src/api/admin.ts:L7-L32](../frontend/src/api/admin.ts#L7-L32) |
| 运行命令 | `python scripts\run_local.py build-frontend` |
| 预期结果 | Vue 构建通过，知识库页面包含上传、编辑、删除、重建索引和检索测试控件 |

## TEST-016 后台权限和数字人配置持久化

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-008 |
| 登录测试 | [test_admin_login_success_and_invalid_password backend/tests/test_auth_service.py:L18-L27](../backend/tests/test_auth_service.py#L18-L27) |
| 禁用用户测试 | [test_disabled_admin_user_cannot_login backend/tests/test_auth_service.py:L30-L43](../backend/tests/test_auth_service.py#L30-L43) |
| 无 token 写接口测试 | [test_admin_write_api_requires_bearer_token backend/tests/test_auth_service.py:L43-L48](../backend/tests/test_auth_service.py#L43-L48) |
| 数字人配置测试 | [test_avatar_config_persists_in_database backend/tests/test_avatar_service.py:L6-L14](../backend/tests/test_avatar_service.py#L6-L14) |
| 运行命令 | `python scripts\run_local.py test-backend` |
| 预期结果 | 登录成功、错误密码失败、禁用用户失败、未带 token 调后台写接口返回 401、数字人配置保存后可重新读取 |

## TEST-017 后端测试入口依赖 `PYTHONPATH`

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-003 |
| 推荐入口 | [test_backend scripts/run_local.py:L82-L86](../scripts/run_local.py#L82-L86) |
| 导入示例 | [test_auth_service imports backend/tests/test_auth_service.py:L7-L10](../backend/tests/test_auth_service.py#L7-L10) |
| 运行命令 | `python scripts\run_local.py test-backend` |
| 备选命令 | `$env:PYTHONPATH = (Resolve-Path .\\backend); python -m pytest backend/tests -q` |
| 注意事项 | 直接在仓库根目录运行 `python -m pytest backend/tests -q` 会因缺少 `PYTHONPATH=backend` 报 `ModuleNotFoundError: No module named 'app'` |

## TEST-018 `/api/v1` MVP 路由验证

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-016、REQ-017 |
| 测试文件 | [backend/tests/test_api_v1.py:L1-L113](../backend/tests/test_api_v1.py#L1-L113) |
| 覆盖范围 | `GET /api/v1/health`、`POST /api/v1/guide/ask`、`GET /api/v1/scenic/spots`、`GET /api/v1/scenic/facilities`、`POST /api/v1/visitor/ratings`、`POST /api/v1/route/recommend`、`POST /api/v1/auth/login`、`GET /api/v1/admin/system/status`、`POST /api/v1/admin/knowledge-bases/default/documents`、`POST /api/v1/admin/documents/{id}/embed`、`POST /api/v1/rag/retrieve` |
| 运行命令 | `python scripts\run_local.py test-backend` |
| 预期结果 | `/api/v1` 核心路由返回 200，后台知识库列表返回向量后端类型，文档嵌入接口返回 `embed_result.chunk_count >= 1`，RAG 检索返回 chunk 列表 |

## TEST-019 Docker Compose PostgreSQL/pgvector 烟测

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-014、REQ-017 |
| 运行命令 | `python scripts\run_local.py smoke-docker-postgres` |
| 命令入口 | [smoke_docker_postgres scripts/run_local.py:L196-L197](../scripts/run_local.py#L196-L197) |
| 烟测脚本 | [main scripts/smoke_docker_postgres.py:L58-L99](../scripts/smoke_docker_postgres.py#L58-L99) |
| Compose 编排 | [deploy/docker-compose.yml:L1-L44](../deploy/docker-compose.yml#L1-L44) |
| 镜像构建 | [deploy/Dockerfile:L1-L31](../deploy/Dockerfile#L1-L31) |
| 预期结果 | 直接从 Git 仓库源码构建单应用容器和 PostgreSQL/pgvector，无需预先提交 `frontend/dist`；`GET /api/health` 返回 200，`/guide` 页面包含 `id=\"app\"`，后台系统状态返回 `database_backend=postgresql`、`vector_backend=pgvector` |

## TEST-020 Docker All-in-One 单容器烟测

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-019 |
| 运行命令 | `python scripts\run_local.py smoke-docker-allinone` |
| 命令入口 | [smoke_docker_allinone scripts/run_local.py:L200-L201](../scripts/run_local.py#L200-L201) |
| 烟测脚本 | [main scripts/smoke_docker_allinone.py:L70-L114](../scripts/smoke_docker_allinone.py#L70-L114) |
| Compose 编排 | [deploy/docker-compose.allinone.yml:L1-L36](../deploy/docker-compose.allinone.yml#L1-L36) |
| 镜像构建 | [deploy/Dockerfile.allinone:L1-L43](../deploy/Dockerfile.allinone#L1-L43) |
| 启动编排 | [main deploy/start_allinone.py:L228-L240](../deploy/start_allinone.py#L228-L240) |
| 预期结果 | 单容器镜像启动后，`GET /api/health` 返回 200，`/guide` 页面可访问，`/api/v1/admin/system/status` 返回 `database_backend=postgresql`、`vector_backend=pgvector`，且宿主机 `5433` 可连到容器内 PostgreSQL |

## TEST-021 GHCR All-in-One 发布脚本

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-020 |
| 帮助命令 | `python scripts\publish_ghcr_allinone.py --help` |
| 本地构建命令 | `python scripts\publish_ghcr_allinone.py --no-push --tag latest` |
| 被测脚本 | [main scripts/publish_ghcr_allinone.py:L123-L160](../scripts/publish_ghcr_allinone.py#L123-L160) |
| 发布镜像 | [deploy/Dockerfile.allinone.release:L1-L29](../deploy/Dockerfile.allinone.release#L1-L29) |
| 预期结果 | `--help` 能输出参数说明；`--no-push` 可在本地构建 GHCR 发布镜像；真实推送需要有效 `GHCR_TOKEN` |

## TEST-022 游客评分、路线反哺与大屏聚合

| 项目 | 内容 |
|---|---|
| 对应需求 | [REQ-021 游客个性化评分、路线反哺与数据大屏](./requirements_traceability.md#req-021-游客个性化评分路线反哺与数据大屏) |
| 测试函数 | [test_rating_upsert_stats_and_preference_profile backend/tests/test_rating_service.py:L13-L64](../backend/tests/test_rating_service.py#L13-L64) |
| 被测服务 | [create_or_update_rating backend/app/services/rating_service.py:L151-L176](../backend/app/services/rating_service.py#L151-L176), [get_spot_statistics backend/app/services/rating_service.py:L231-L277](../backend/app/services/rating_service.py#L231-L277), [get_user_preference_profile backend/app/services/rating_service.py:L286-L327](../backend/app/services/rating_service.py#L286-L327), [get_admin_rating_ranking backend/app/services/rating_service.py:L350-L366](../backend/app/services/rating_service.py#L350-L366) |
| 相关路由 | [submit_rating_v1 backend/app/api/v1.py:L232-L235](../backend/app/api/v1.py#L232-L235), [admin_rating_ranking_v1 backend/app/api/v1.py:L305-L307](../backend/app/api/v1.py#L305-L307) |
| 运行命令 | `python scripts\run_local.py test-backend` |
| 预期结果 | 同一游客会话对同一景点重复评分会更新；景点评分统计、公开评论、后台排行和游客偏好画像均返回有效数据 |

## TEST-023 前端评分面板与大屏视觉构建

| 项目 | 内容 |
|---|---|
| 对应需求 | [REQ-012 后台运营大屏真实聚合](./requirements_traceability.md#req-012-后台运营大屏真实聚合), [REQ-021 游客个性化评分、路线反哺与数据大屏](./requirements_traceability.md#req-021-游客个性化评分路线反哺与数据大屏) |
| 游客页面 | [ChatGuide rating frontend/src/pages/visitor/ChatGuide.vue:L183-L211](../frontend/src/pages/visitor/ChatGuide.vue#L183-L211) |
| 后台页面 | [AdminDashboard frontend/src/pages/admin/AdminDashboard.vue:L28-L105](../frontend/src/pages/admin/AdminDashboard.vue#L28-L105) |
| 样式入口 | [UX refresh frontend/src/styles.css:L929-L1259](../frontend/src/styles.css#L929-L1259) |
| 运行命令 | `python scripts\run_local.py build-frontend` |
| 预期结果 | Vue 类型检查和 Vite 生产构建通过，评分面板和大屏新增模块没有类型错误 |

## TEST-024 PostgreSQL 初始化 SQL 验证

| 项目 | 内容 |
|---|---|
| 对应需求 | [REQ-017 PostgreSQL + pgvector 知识库迁移](./requirements_traceability.md#req-017-postgresql--pgvector-知识库迁移), [REQ-021 游客个性化评分、路线反哺与数据大屏](./requirements_traceability.md#req-021-游客个性化评分路线反哺与数据大屏) |
| SQL 脚本 | [scripts/init_db.sql:L1-L231](../scripts/init_db.sql#L1-L231) |
| 覆盖范围 | `CREATE EXTENSION vector`、知识库、chunk vector、景点、设施、游客会话、问答日志、路线日志和游客评分表 |
| 运行命令 | `docker compose -f deploy/docker-compose.yml up -d postgres` 后，将 [scripts/init_db.sql:L1-L231](../scripts/init_db.sql#L1-L231) 输入临时 PostgreSQL 数据库执行 |
| 预期结果 | 临时数据库能完整执行 SQL 并创建 HNSW 向量索引，随后可删除临时库 |

## TEST-025 蓝鲸主题 3D 数字人状态

| 项目 | 内容 |
|---|---|
| 对应需求 | [REQ-025 蓝鲸主题 3D 数字人展示原型](./requirements_traceability.md#req-025-蓝鲸主题-3d-数字人展示原型) |
| 测试文件与函数 | [avatar tests frontend/tests/avatar.test.ts:L1-L33](../frontend/tests/avatar.test.ts#L1-L33) |
| 被测状态 | [useAvatarStore frontend/src/store/avatar.ts:L5-L45](../frontend/src/store/avatar.ts#L5-L45) |
| 运行命令 | 在 `frontend` 目录运行 `npm test` 和 `npm run build` |
| 预期结果 | 讲解口型最终归零；中途切换思考后不被旧计时器覆盖；Vue 类型检查与生产构建通过 |
| 失败排查 | 查看状态计时器取消逻辑及 [DigitalAvatar 前端绑定 frontend/src/components/Avatar/DigitalAvatar.vue:L19-L43](../frontend/src/components/Avatar/DigitalAvatar.vue#L19-L43)；视觉表现需在 `/guide` 页面人工查看 |

## TEST-026 团队仓库与自动检查验收

| 项目 | 内容 |
|---|---|
| 对应需求 | REQ-026 |
| 协作配置 | [CONTRIBUTING.md:L1](../CONTRIBUTING.md#L1), [checks.yml:L1](../.github/workflows/checks.yml#L1) |
| 本地检查 | `git rev-parse --show-toplevel`、`git ls-files .env.example`、`git check-ignore .env frontend/node_modules/example`、`git diff --check`、`python scripts/check_doc_links.py` |
| 预期结果 | Git 根是团队项目；模板已跟踪；私密配置和依赖忽略；差异和文档检查通过 |
| 远程检查 | 首次推送后查看 GitHub Actions 的前端、后端两个任务 |
| 失败排查 | 先查看 Actions 具体步骤和日志；数据库测试使用工作流独立 PostgreSQL，前端使用 lockfile 安装依赖 |
