# 需求追踪

## REQ-001 DeepSeek + 本地知识库问答闭环

### 用户场景

游客通过文本向数字人提问，系统从本地景区资料检索依据，再调用 DeepSeek 生成适合语音播报的回答。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| API 入口 | 游客文本问答接口 | [backend/app/api/visitor.py:L14-L21](../backend/app/api/visitor.py#L14-L21) |
| 服务编排 | RAG 检索、DeepSeek 调用、降级回答、真实延迟 | [chat_with_text backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88) |
| 模型客户端 | DeepSeek OpenAI 兼容接口封装 | [DeepSeekClient backend/app/services/deepseek_service.py:L9-L47](../backend/app/services/deepseek_service.py#L9-L47) |
| 检索入口 | 后端知识库服务入口 | [retrieve_context backend/app/services/knowledge_service.py:L32-L53](../backend/app/services/knowledge_service.py#L32-L53) |
| 向量检索 | PostgreSQL + pgvector 检索路径，命中数据来自 `knowledge_chunk` | [retrieve_context backend/app/services/vector_store.py:L575-L596](../backend/app/services/vector_store.py#L575-L596) |
| 测试 | DeepSeek 外部依赖关闭后的问答单测 | [test_chat_with_text_uses_references_and_latency backend/tests/test_chat_service.py:L5-L12](../backend/tests/test_chat_service.py#L5-L12) |

### 配置项

- [DeepSeek 与 PostgreSQL/pgvector 配置 .env.example:L11-L27](../.env.example#L11-L27)

### 验证命令

```powershell
python scripts\run_local.py build-kb
python scripts\run_local.py test-backend
python scripts\run_local.py smoke-backend
```

### 影响范围

影响游客问答、后台知识库检索测试、演示端数字人回答内容和响应时间统计。

## REQ-002 景区知识库与 pgvector 向量检索

### 用户场景

团队可以基于现有 `data` 资料和后台上传版本文档生成可检索知识库；运行、测试和容器链路统一依赖 PostgreSQL + pgvector，调试导出 JSON 仅用于查看当前启用 chunk。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 数据源 | 示范景区导览资料 | [data/raw_documents/demo_scenic_guide.md:L1-L25](../data/raw_documents/demo_scenic_guide.md#L1-L25) |
| 真实资料包 | 自动读取灵山公开资料包中的 docx/xlsx | [load_scenic_pack_entries backend/app/services/vector_store.py:L266-L290](../backend/app/services/vector_store.py#L266-L290) |
| xlsx 抽取 | 行为数据限制为最多 2500 个文本单元格，避免构建卡死 | [extract_xlsx_text backend/app/services/vector_store.py:L227-L263](../backend/app/services/vector_store.py#L227-L263) |
| 向量构建 | 读取 FAQ、景点和文档后写入 `knowledge_chunk` 并导出调试索引 | [build_knowledge_base backend/app/services/vector_store.py:L465-L503](../backend/app/services/vector_store.py#L465-L503) |
| 嵌入入口 | 当前版本文档切片落库到 `knowledge_chunk` | [embed_document backend/app/services/vector_store.py:L432-L460](../backend/app/services/vector_store.py#L432-L460) |
| 构建脚本 | 可复现知识库构建入口，运行前自动确保 PostgreSQL 就绪 | [main scripts/build_knowledge_base.py:L17-L20](../scripts/build_knowledge_base.py#L17-L20) |
| 单元测试 | 构建条目数、chunk 表和检索命中测试 | [backend/tests/test_vector_store.py:L6-L25](../backend/tests/test_vector_store.py#L6-L25) |

### 验证命令

```powershell
python scripts\run_local.py build-kb
```

当前真实资料包构建结果为 `entry_count = 3377`。

## REQ-003 可复现本地运行与完整栈烟测

### 用户场景

开发者或评委可以用 Python 脚本启动后端、静态前端并验证完整链路，不依赖不可复现的手工命令。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 环境检查 | 检查文件、端口、DeepSeek Key | [check_env scripts/run_local.py:L51-L63](../scripts/run_local.py#L51-L63) |
| 后端启动 | 用 Python subprocess 启动 Uvicorn | [start_backend scripts/run_local.py:L89-L105](../scripts/run_local.py#L89-L105) |
| 后端烟测 | 启动后端并调用 API | [smoke_backend scripts/run_local.py:L136-L146](../scripts/run_local.py#L136-L146) |
| 完整栈烟测 | 启动后端 + 静态前端 + API 测试 | [main scripts/smoke_full_stack.py:L30-L61](../scripts/smoke_full_stack.py#L30-L61) |
| 静态演示端 | 无 npm 依赖的游客端与大屏入口 | [frontend_static/index.html:L170-L218](../frontend_static/index.html#L170-L218) |

### 验证命令

```powershell
python scripts\smoke_full_stack.py
```

## REQ-004 文档行号可追踪

### 用户场景

后续 AI 或同事修改代码后，可以重新生成符号索引并检查文档链接，减少“只在聊天记录里知道位置”的风险。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 符号索引 | 扫描 Python 类和函数行号 | [generate_symbol_index main scripts/generate_symbol_index.py:L40-L51](../scripts/generate_symbol_index.py#L40-L51) |
| 文档链接检查 | 检查 `docs/` 中相对链接和行号范围 | [check_doc_links main scripts/check_doc_links.py:L13-L37](../scripts/check_doc_links.py#L13-L37) |

### 验证命令

```powershell
python scripts\generate_symbol_index.py
python scripts\check_doc_links.py
```

## REQ-005 灵山真实景点地图与路线导览

### 用户场景

游客进入地图页或数字人问答页后，可以看到基于灵山胜境真实景点的导览地图，并根据兴趣、时间生成可视化路线。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 景点数据 | 灵山大照壁、五智门、九龙灌浴、灵山大佛、梵宫、五印坛城等真实点位 | [SCENIC_SPOTS backend/app/services/scenic_service.py:L14-L225](../backend/app/services/scenic_service.py#L14-L225) |
| 路线算法 | 根据兴趣、热度、文化价值、游客评分、画像偏好、设施便利度和距离成本打分 | [_score_spot backend/app/services/route_service.py:L82-L107](../backend/app/services/route_service.py#L82-L107) |
| 路线持久化 | 生成路线后写入 `route_plan`，供后台大屏统计热门景点与路线偏好 | [_persist_route backend/app/services/route_service.py:L118-L133](../backend/app/services/route_service.py#L118-L133) |
| 路线入口 | 游客端路线推荐服务 | [recommend_route backend/app/services/route_service.py:L152-L196](../backend/app/services/route_service.py#L152-L196) |
| 地图组件 | SVG 地形、水系、中轴线路线和 POI 详情 | [ScenicMapView frontend/src/components/ScenicMapView.vue:L1-L101](../frontend/src/components/ScenicMapView.vue#L1-L101) |
| 地图页面 | 兴趣和时间筛选，重新生成推荐路线 | [ScenicMap frontend/src/pages/visitor/ScenicMap.vue:L1-L62](../frontend/src/pages/visitor/ScenicMap.vue#L1-L62) |
| 样式 | 地图视觉、路线、POI、图例、移动端适配 | [map styles frontend/src/styles.css:L438-L617](../frontend/src/styles.css#L438-L617) |
| 测试 | 验证真实灵山景点和路线输出 | [test_route_service backend/tests/test_route_service.py:L6-L26](../backend/tests/test_route_service.py#L6-L26) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
```

## REQ-006 数字人灵灵真实前端交互体验

### 用户场景

游客在数字人导览页看到可辨识的“灵灵”导游形象，支持文本提问、浏览器语音输入、浏览器语音播报、嘴部动画、知识引用和推荐路线展示。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 数字人状态 | 待机、倾听、思考、讲解、口型模拟和字幕 | [useAvatarStore frontend/src/store/avatar.ts:L1-L45](../frontend/src/store/avatar.ts#L1-L45) |
| 数字人形象 | 蓝鲸主题 3D 导游、口型、状态、提示语和旋转交互 | [DigitalAvatar frontend/src/components/Avatar/DigitalAvatar.vue:L1-L108](../frontend/src/components/Avatar/DigitalAvatar.vue#L1-L108), [createWhaleAvatar frontend/src/components/Avatar/whaleAvatar3d.ts:L13-L239](../frontend/src/components/Avatar/whaleAvatar3d.ts#L13-L239) |
| 问答页 | 快捷问题、浏览器语音识别、语音播报、引用和路线卡片 | [ChatGuide frontend/src/pages/visitor/ChatGuide.vue:L1-L147](../frontend/src/pages/visitor/ChatGuide.vue#L1-L147) |
| 聊天面板 | 文字输入、语音按钮和快捷问题 | [ChatPanel frontend/src/components/ChatPanel.vue:L1-L49](../frontend/src/components/ChatPanel.vue#L1-L49) |
| 视觉样式 | 数字人、问答区、路线和引用区响应式布局 | [guide styles frontend/src/styles.css:L143-L437](../frontend/src/styles.css#L143-L437) |

### 验证命令

```powershell
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
```

## REQ-009 GitHub 发布与版本交付

### 用户场景

开发者需要把“灵山数字导游”当前本地项目发布到自己的 GitHub 仓库，并保留 `v0.0` baseline tag，便于参赛交付、协作和回滚。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 发布脚本 | 检查工作区、配置 GitHub remote、推送分支和 tags | [publish_github main scripts/publish_github.py:L56-L84](../scripts/publish_github.py#L56-L84) |
| 工作区保护 | 防止未提交改动被意外发布 | [ensure_clean_worktree scripts/publish_github.py:L38-L44](../scripts/publish_github.py#L38-L44) |
| 远程配置 | 新增或更新 `origin` 地址 | [configure_remote scripts/publish_github.py:L47-L53](../scripts/publish_github.py#L47-L53) |
| 发布文档 | GitHub 发布命令和 Git Bash 注意事项 | [docs/DEPLOY.md:L110-L132](./DEPLOY.md#L110-L132) |
| 测试文档 | 帮助命令验证方式 | [docs/test_reference.md:L148-L157](./test_reference.md#L148-L157) |

### 验证命令

```powershell
python scripts\publish_github.py --help
python scripts\publish_github.py --remote-url https://github.com/<your-name>/<repo>.git --branch main --push-tags
```

## REQ-007 后台知识库管理闭环

### 用户场景

管理员登录后台后，可以上传、编辑、发布、归档、软删除景区讲解词、文史资料、FAQ 和数据表资料；只有 `active` 已发布文档会进入游客端 RAG 检索。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| API 列表 | 按 `all/draft/active/archived/deleted` 状态筛选文档 | [knowledge_documents backend/app/api/admin.py:L30-L35](../backend/app/api/admin.py#L30-L35) |
| API 上传 | 上传文档后默认保存为 `draft` | [knowledge_upload backend/app/api/admin.py:L39-L50](../backend/app/api/admin.py#L39-L50) |
| API 更新 | 更新文本资料会生成新版本并回到 `draft` | [knowledge_update backend/app/api/admin.py:L54-L67](../backend/app/api/admin.py#L54-L67) |
| API 发布/归档/删除 | 发布后重建索引，归档/删除后不再进入 RAG | [knowledge_publish backend/app/api/admin.py:L71-L76](../backend/app/api/admin.py#L71-L76), [knowledge_archive backend/app/api/admin.py:L80-L85](../backend/app/api/admin.py#L80-L85), [knowledge_delete backend/app/api/admin.py:L89-L94](../backend/app/api/admin.py#L89-L94) |
| 版本与历史 | 查询文档版本和操作日志 | [knowledge_versions backend/app/api/admin.py:L98-L103](../backend/app/api/admin.py#L98-L103), [knowledge_history backend/app/api/admin.py:L107-L112](../backend/app/api/admin.py#L107-L112) |
| 服务层 | 文档保存、更新、嵌入、发布、删除和历史查询 | [save_document backend/app/services/knowledge_service.py:L187-L259](../backend/app/services/knowledge_service.py#L187-L259), [embed_document backend/app/services/knowledge_service.py:L174-L184](../backend/app/services/knowledge_service.py#L174-L184), [update_document backend/app/services/knowledge_service.py:L262-L325](../backend/app/services/knowledge_service.py#L262-L325), [publish_document backend/app/services/knowledge_service.py:L328-L353](../backend/app/services/knowledge_service.py#L328-L353), [delete_document backend/app/services/knowledge_service.py:L382-L407](../backend/app/services/knowledge_service.py#L382-L407) |
| 向量入库 | 当前版本切片入 `knowledge_chunk`，仅 active 当前版本启用到游客检索 | [embed_document backend/app/services/vector_store.py:L436-L466](../backend/app/services/vector_store.py#L436-L466), [_sync_document_chunk_flags backend/app/services/vector_store.py:L426-L433](../backend/app/services/vector_store.py#L426-L433) |
| 前端页面 | 状态筛选、版本/历史、发布、归档、删除、检索测试 | [KnowledgeManage script frontend/src/pages/admin/KnowledgeManage.vue:L33-L156](../frontend/src/pages/admin/KnowledgeManage.vue#L33-L156), [KnowledgeManage template frontend/src/pages/admin/KnowledgeManage.vue:L216-L265](../frontend/src/pages/admin/KnowledgeManage.vue#L216-L265) |
| 测试 | 草稿生成 chunk 但不命中、发布命中、删除后不命中且历史保留 | [test_versioned_knowledge_document_lifecycle backend/tests/test_knowledge_management.py:L21-L63](../backend/tests/test_knowledge_management.py#L21-L63) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-kb
python scripts\run_local.py build-frontend
```

### 影响范围

影响管理后台知识库页面、后台知识库 API、本地向量库构建、游客端 RAG 回答依据和文档检索测试。

## REQ-008 后台权限、版本化知识库与数据库持久化

### 用户场景

后台管理员使用账号密码登录，写操作必须携带 Bearer token；知识文档元数据、版本、发布状态、上传历史和数字人配置统一持久化到 PostgreSQL，开发和 Docker 链路不再依赖 SQLite。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 数据库配置 | SQLAlchemy engine/session、PostgreSQL 扩展初始化、测试库重置 | [configure_database backend/app/core/database.py:L42-L55](../backend/app/core/database.py#L42-L55), [init_db backend/app/core/database.py:L58-L66](../backend/app/core/database.py#L58-L66), [reset_database backend/app/core/database.py:L69-L86](../backend/app/core/database.py#L69-L86), [new_session backend/app/core/database.py:L89-L100](../backend/app/core/database.py#L89-L100) |
| 数据模型 | 管理员、知识文档、版本、操作日志、数字人配置表 | [AdminUser backend/app/models/persistence.py:L51-L61](../backend/app/models/persistence.py#L51-L61), [KnowledgeDocument backend/app/models/persistence.py:L64-L99](../backend/app/models/persistence.py#L64-L99), [KnowledgeDocumentVersion backend/app/models/persistence.py:L102-L128](../backend/app/models/persistence.py#L102-L128), [KnowledgeOperationLog backend/app/models/persistence.py:L182-L197](../backend/app/models/persistence.py#L182-L197), [AvatarConfig backend/app/models/persistence.py:L200-L213](../backend/app/models/persistence.py#L200-L213) |
| 权限服务 | PBKDF2 密码哈希、HMAC token、管理员依赖 | [hash_password backend/app/services/auth_service.py:L32-L41](../backend/app/services/auth_service.py#L32-L41), [authenticate_admin backend/app/services/auth_service.py:L110-L131](../backend/app/services/auth_service.py#L110-L131), [require_admin_user backend/app/services/auth_service.py:L134-L145](../backend/app/services/auth_service.py#L134-L145) |
| 登录接口 | `POST /api/admin/login` 和 `GET /api/admin/me` | [login backend/app/api/admin.py:L15-L16](../backend/app/api/admin.py#L15-L16), [me backend/app/api/admin.py:L20-L21](../backend/app/api/admin.py#L20-L21) |
| 数字人持久化 | 保存和读取 active 数字人配置 | [get_active_avatar backend/app/services/avatar_service.py:L65-L73](../backend/app/services/avatar_service.py#L65-L73), [save_avatar_config backend/app/services/avatar_service.py:L76-L99](../backend/app/services/avatar_service.py#L76-L99) |
| 前端鉴权 | 登录页、token 注入、401 跳转、路由守卫 | [AdminLogin frontend/src/pages/admin/AdminLogin.vue:L1-L46](../frontend/src/pages/admin/AdminLogin.vue#L1-L46), [http token frontend/src/api/http.ts:L8-L22](../frontend/src/api/http.ts#L8-L22), [admin router guard frontend/src/router/index.ts:L17-L27](../frontend/src/router/index.ts#L17-L27) |
| 配置 | `DATABASE_URL`、`ADMIN_TOKEN_SECRET`、Docker PostgreSQL URL | [settings backend/app/core/config.py:L4-L19](../backend/app/core/config.py#L4-L19), [.env.example:L5-L34](../.env.example#L5-L34), [deploy/docker-compose.yml:L6-L15](../deploy/docker-compose.yml#L6-L15) |
| 测试 | 登录、错误密码、禁用用户、无 token 写接口、数字人配置持久化 | [auth tests backend/tests/test_auth_service.py:L15-L48](../backend/tests/test_auth_service.py#L15-L48), [avatar test backend/tests/test_avatar_service.py:L6-L14](../backend/tests/test_avatar_service.py#L6-L14) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\smoke_vue_full_stack.py
```

### 影响范围

影响所有 `/api/admin/*` 后台接口、管理端登录态、知识库文档生命周期、向量库构建来源、Docker 部署数据库连接和数字人配置读取。

## REQ-010 真实语音问答闭环

### 状态

已完成 MVP，后续可继续补充更细的时间筛选和图表组件。

### 用户场景

游客上传语音后，后端完成真实语音识别、文本问答和语音合成，前端播放后端返回的音频，而不是只依赖浏览器本地 SpeechRecognition / SpeechSynthesis。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| API 入口 | 游客语音问答接口 | [backend/app/api/visitor.py:L25-L27](../backend/app/api/visitor.py#L25-L27) |
| 后端占位逻辑 | 当前固定返回 ASR 文本并复用文本问答 | [voice_chat backend/app/services/chat_service.py:L90-L94](../backend/app/services/chat_service.py#L90-L94) |
| 文本问答返回 | 当前 `audio_url` 仍是演示路径 | [chat_with_text backend/app/services/chat_service.py:L77-L87](../backend/app/services/chat_service.py#L77-L87) |
| 前端本地播报 | 当前使用浏览器 SpeechSynthesis | [speakAnswer frontend/src/pages/visitor/ChatGuide.vue:L64-L73](../frontend/src/pages/visitor/ChatGuide.vue#L64-L73) |
| 前端本地识别 | 当前使用浏览器 SpeechRecognition | [handleListen frontend/src/pages/visitor/ChatGuide.vue:L75-L99](../frontend/src/pages/visitor/ChatGuide.vue#L75-L99) |
| 数字人口型 | 当前用本地字幕驱动嘴部动画 | [simulateSpeaking frontend/src/store/avatar.ts:L16-L32](../frontend/src/store/avatar.ts#L16-L32) |

### 计划交付结果

- 后端 `POST /api/visitor/chat/voice` 接受真实音频文件并返回 `asr_text`、`answer`、可访问的真实 `audio_url`。
- 前端支持上传或录制音频并播放后端返回音频。
- 失败时保留当前文本问答降级链路。

### 验收标准

- 上传一段中文语音后，接口返回识别文本和对应回答。
- 返回的 `audio_url` 可被浏览器播放。
- 语音失败时仍能回退到文本输入流程，不影响 [REQ-001](./requirements_traceability.md#req-001-deepseek--本地知识库问答闭环)。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\smoke_vue_full_stack.py
```

### 影响范围

影响游客语音问答、数字人播报体验、前端音频播放方式和后端多媒体文件管理。

## REQ-011 多模态图片识景问答

### 状态

待完成。

### 用户场景

游客上传景点照片后，系统识别对应景点，并结合景区知识库给出讲解、路线或拍照建议。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| API 入口 | 游客图片问答接口 | [backend/app/api/visitor.py:L30-L36](../backend/app/api/visitor.py#L30-L36) |
| 后端占位逻辑 | 当前固定返回“灵山大佛”识别结果 | [image_chat backend/app/services/chat_service.py:L97-L103](../backend/app/services/chat_service.py#L97-L103) |
| 前端游客 API | 当前仅封装文本问答和路线推荐，尚未封装图片上传 | [frontend/src/api/visitor.ts:L28-L53](../frontend/src/api/visitor.ts#L28-L53) |
| 游客问答页 | 当前页面无图片上传入口 | [frontend/src/pages/visitor/ChatGuide.vue:L102-L147](../frontend/src/pages/visitor/ChatGuide.vue#L102-L147) |
| 景点底库 | 识景结果需要映射到真实灵山景点 | [SCENIC_SPOTS backend/app/services/scenic_service.py:L14-L225](../backend/app/services/scenic_service.py#L14-L225) |

### 计划交付结果

- 后端接入真实视觉模型或视觉 API，输出候选景点和置信度。
- 前端新增图片上传入口和识景结果展示。
- 识景结果可继续进入 RAG 文本讲解链路。

### 验收标准

- 上传灵山核心景点图片时，接口返回真实候选景点和置信度。
- 识别结果中的景点名称必须来自景点底库，不能返回虚构景点。
- 前端能看到识景结果、回答和引用来源。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
```

### 影响范围

影响游客多模态交互、后端模型接入方式、前端问答页 UI 和景点映射逻辑。

## REQ-012 后台运营大屏真实聚合

### 状态

待完成。

### 用户场景

管理员在后台大屏查看的服务量、热门问题、热门景点、路线偏好和情绪趋势应来自真实日志或数据库聚合，而不是静态演示数据。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 大屏接口 | 提供旧 `/api/admin/analytics/*` 与新 `/api/v1/admin/analytics/overview` | [analytics_overview backend/app/api/admin.py:L138-L145](../backend/app/api/admin.py#L138-L145), [admin_analytics_overview_v1 backend/app/api/v1.py:L275-L277](../backend/app/api/v1.py#L275-L277) |
| 后端统计服务 | 从 `chat_message`、`route_plan`、`visitor_spot_rating` 和 `scenic_spot` 聚合大屏数据 | [dashboard_overview backend/app/services/analytics_service.py:L34-L89](../backend/app/services/analytics_service.py#L34-L89) |
| 前端 API | 当前直接请求 overview 接口 | [fetchDashboard frontend/src/api/admin.ts:L3-L5](../frontend/src/api/admin.ts#L3-L5) |
| 大屏页面 | 展示服务量、评分、热门问答、路线访问、景点评分排行、情绪趋势和高频标签 | [AdminDashboard frontend/src/pages/admin/AdminDashboard.vue:L19-L108](../frontend/src/pages/admin/AdminDashboard.vue#L19-L108) |
| 问答日志 | 游客问答写入 `chat_message`，供大屏计算服务量、热门问题和知识命中率 | [_log_message backend/app/services/chat_service.py:L66-L82](../backend/app/services/chat_service.py#L66-L82), [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137) |
| 路线日志 | 路线推荐写入 `route_plan`，供大屏计算热门景点和路线偏好 | [_persist_route backend/app/services/route_service.py:L118-L133](../backend/app/services/route_service.py#L118-L133) |
| 评分聚合 | 景点评分排行、情绪趋势和标签统计来自评分服务 | [get_admin_rating_ranking backend/app/services/rating_service.py:L350-L366](../backend/app/services/rating_service.py#L350-L366), [get_admin_rating_trend backend/app/services/rating_service.py:L369-L385](../backend/app/services/rating_service.py#L369-L385) |
| 现有后台鉴权 | 大屏接口已受管理员权限保护 | [require_admin_user backend/app/services/auth_service.py:L134-L145](../backend/app/services/auth_service.py#L134-L145) |

### 计划交付结果

- 游客问答、路线推荐、满意度和情绪已进入 PostgreSQL。
- `/api/admin/analytics/overview` 和 `/api/v1/admin/analytics/overview` 返回真实聚合结果。
- 前端大屏已展示空态和真实统计刷新结果。

### 验收标准

- 发起多次问答或路线请求后，大屏统计发生可解释变化。
- 热门问题、热门景点和路线偏好与实际请求样本一致。
- 大屏接口具备至少 1 个后端测试和 1 个端到端验证路径。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\smoke_vue_full_stack.py
```

### 影响范围

影响后台大屏可信度、运营分析能力、数据模型设计和日志采集链路。

## REQ-013 150 条标准测试集与自动评测

### 状态

待完成。

### 用户场景

项目需要在交付前用不少于 150 条标准问题验证问答准确率、引用情况和响应时延，形成可复现评测报告。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 当前测试集 | 目前仅有 3 条示例题 | [data/test_questions.csv:L1-L4](../data/test_questions.csv#L1-L4) |
| 现有问答单测 | 当前只覆盖基本返回结构 | [backend/tests/test_chat_service.py:L5-L12](../backend/tests/test_chat_service.py#L5-L12) |
| 当前烟测报告字段 | 已输出问答延迟，可复用为评测基础 | [scripts/smoke_test.py:L77-L123](../scripts/smoke_test.py#L77-L123) |
| 参考方案 | 仓库已有历史生成的评测脚本草案 | [docs/archive/generated/05_test_and_submission_plan.md:L38-L170](./archive/generated/05_test_and_submission_plan.md#L38-L170) |

### 计划交付结果

- 扩充 `data/test_questions.csv` 至至少 150 条。
- 新增准确率评测脚本和延迟评测脚本。
- 输出结构化评测报告文件，供比赛提交和内部复盘。

### 验收标准

- 测试集覆盖景点介绍、路线推荐、设施服务、雨天路线、亲子路线等核心场景。
- 评测脚本可批量运行并输出准确率、平均延迟、P95/P99 延迟等指标。
- 评测结果可直接在文档或报告中引用。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py smoke-backend
```

### 影响范围

影响赛题验收可信度、模型调优依据、知识库补充优先级和最终交付材料完整度。

## REQ-014 Docker Compose 全链路部署验收

### 状态

已完成。

### 用户场景

评委或同事应能使用 Docker Compose 一次性启动“单应用容器 + PostgreSQL/pgvector”，并完成游客端、后台登录和系统状态验证，不再依赖 SQLite。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| Compose 配置 | `app` 单容器托管 FastAPI + Vue 静态资源，`postgres` 使用 `pgvector/pgvector:pg16`，未提供 `.env` 时也可使用默认值启动 | [deploy/docker-compose.yml:L1-L50](../deploy/docker-compose.yml#L1-L50) |
| 镜像构建 | 多阶段镜像从 `frontend/` 源码直接构建 `dist`，不依赖仓库提交前端产物 | [deploy/Dockerfile:L1-L31](../deploy/Dockerfile#L1-L31) |
| 前端托管 | FastAPI 在容器内直接提供 `/guide`、`/map`、`/admin/*` SPA 入口 | [backend/app/main.py:L66-L78](../backend/app/main.py#L66-L78) |
| pgvector 初始化 | PostgreSQL 启动时自动执行 `CREATE EXTENSION IF NOT EXISTS vector` | [backend/app/core/database.py:L58-L66](../backend/app/core/database.py#L58-L66) |
| 验收脚本 | 直接从 Git 仓库源码执行 Compose 构建，校验游客页和后台系统状态 | [scripts/smoke_docker_postgres.py:L58-L99](../scripts/smoke_docker_postgres.py#L58-L99), [scripts/run_local.py:L196-L197](../scripts/run_local.py#L196-L197) |

### 交付结果

- Compose 已切到单应用容器，不再单独运行前端服务。
- 默认运行数据库切到 PostgreSQL + pgvector，不再依赖 SQLite。
- 新增 `python scripts\run_local.py smoke-docker-postgres` 作为标准验收命令。
- 宿主机暴露 PostgreSQL 端口固定为 `5433`，避免误连本机已有的 `5432` 数据库实例。
- 明确容器化访问地址为 `http://127.0.0.1:8000/guide`、`/map`、`/admin/login`。
- Docker 镜像构建已内置前端打包步骤，GitHub 仓库不需要提交 `frontend/dist` 也能完成 Compose 启动。

### 验收标准

- `docker compose -f deploy/docker-compose.yml up --build` 后，前后端可访问。
- 后台登录、知识库发布和游客问答至少完成一次主流程验证。
- 停止和重启后，PostgreSQL 持久化数据符合预期。

### 验证命令

```powershell
python scripts\run_local.py smoke-docker-postgres
```

### 影响范围

影响统一部署、比赛现场复现、PostgreSQL 环境一致性、前端访问路径和新同事接手成本。

## REQ-019 Docker All-in-One 单容器交付

### 用户场景

项目需要提供一套“单容器镜像同时承载 FastAPI 与 PostgreSQL/pgvector”的交付方案，便于在资源受限或只接受单容器交付的环境中快速演示和部署。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| Compose 配置 | 单服务 `allinone` 暴露 `8000` 和 `5433`，挂载数据库卷与知识库卷 | [deploy/docker-compose.allinone.yml:L1-L36](../deploy/docker-compose.allinone.yml#L1-L36) |
| 镜像构建 | 多阶段镜像同时内置前端构建、Python 运行时和 PostgreSQL/pgvector | [deploy/Dockerfile.allinone:L1-L43](../deploy/Dockerfile.allinone#L1-L43) |
| 容器启动编排 | 初始化 PostgreSQL cluster、创建数据库、启用 `vector` 扩展并拉起 FastAPI | [initialize_cluster deploy/start_allinone.py:L117-L132](../deploy/start_allinone.py#L117-L132), [ensure_database_objects deploy/start_allinone.py:L176-L191](../deploy/start_allinone.py#L176-L191), [start_backend deploy/start_allinone.py:L206-L225](../deploy/start_allinone.py#L206-L225), [main deploy/start_allinone.py:L228-L240](../deploy/start_allinone.py#L228-L240) |
| 烟测脚本 | 构建单容器、校验页面、后台登录和系统状态 | [main scripts/smoke_docker_allinone.py:L70-L114](../scripts/smoke_docker_allinone.py#L70-L114), [smoke_docker_allinone scripts/run_local.py:L200-L201](../scripts/run_local.py#L200-L201) |
| 运行约束 | 仍保留双容器正式方案，单容器是交付增强而非默认推荐部署 | [docs/DEPLOY.md:L38-L56](./DEPLOY.md#L38-L56) |

### 交付结果

- 新增 `deploy/Dockerfile.allinone` 和 `deploy/docker-compose.allinone.yml`。
- 单容器内可同时运行 PostgreSQL、pgvector 和 FastAPI。
- 新增 `python scripts\run_local.py smoke-docker-allinone` 统一验收入口。
- 保留现有双容器正式部署方案，不破坏当前推荐运行链路。

### 验收标准

- `docker compose -f deploy/docker-compose.allinone.yml up --build` 后，游客端和后台页面可访问。
- 后台登录、知识库读取和系统状态接口能正常工作。
- 宿主机 `127.0.0.1:5433` 能连到单容器内 PostgreSQL。

### 验证命令

```powershell
python scripts\run_local.py smoke-docker-allinone
```

### 影响范围

影响交付形态、容器资源分配、数据库与应用进程编排，以及演示环境下的部署选择。

## REQ-020 GHCR All-in-One 镜像发布

### 用户场景

项目需要把 all-in-one 单容器镜像发布到 GitHub Container Registry，便于其他环境直接 `docker pull` + `docker run`，不必从源码重新构建。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 发布镜像 | 使用本地前端构建产物的 GHCR 发布镜像 | [deploy/Dockerfile.allinone.release:L1-L29](../deploy/Dockerfile.allinone.release#L1-L29) |
| 发布脚本 | 构建前端、构建镜像、登录 GHCR、推送标签 | [build_frontend scripts/publish_ghcr_allinone.py:L65-L66](../scripts/publish_ghcr_allinone.py#L65-L66), [docker_login scripts/publish_ghcr_allinone.py:L89-L101](../scripts/publish_ghcr_allinone.py#L89-L101), [build_image scripts/publish_ghcr_allinone.py:L104-L117](../scripts/publish_ghcr_allinone.py#L104-L117), [main scripts/publish_ghcr_allinone.py:L123-L160](../scripts/publish_ghcr_allinone.py#L123-L160) |
| 配置 | GHCR token 环境变量说明 | [docs/config_reference.md:L22-L24](./config_reference.md#L22-L24) |
| 部署文档 | `docker run` 和 GHCR 发布命令 | [docs/DEPLOY.md:L59-L103](./DEPLOY.md#L59-L103) |
| 验证文档 | GHCR 发布脚本测试入口 | [docs/test_reference.md:L242-L250](./test_reference.md#L242-L250) |

### 交付结果

- 新增 `deploy/Dockerfile.allinone.release`，用于 GHCR 发布镜像。
- 新增 `scripts/publish_ghcr_allinone.py`，统一处理前端构建、镜像打标和推送。
- 新增 `docker run` 直接运行文档。
- 默认镜像名为 `ghcr.io/2667741708/ling-shan-digital-guide-allinone`。

### 验收标准

- `python scripts\publish_ghcr_allinone.py --help` 正常输出参数说明。
- `python scripts\publish_ghcr_allinone.py --no-push --tag latest` 能本地构建发布镜像。
- 具备 `write:packages` 权限的 token 时，`docker login ghcr.io` 和 `docker push` 能成功。

### 验证命令

```powershell
python scripts\publish_ghcr_allinone.py --help
python scripts\publish_ghcr_allinone.py --no-push --tag latest
python scripts\publish_ghcr_allinone.py --image ghcr.io/2667741708/ling-shan-digital-guide-allinone --tag latest
```

### 影响范围

影响镜像发布流程、容器分发方式、GitHub 凭据管理，以及外部环境对单容器方案的接入方式。

## REQ-021 游客个性化评分、路线反哺与数据大屏

### 用户场景

游客在数字人导览页对景点提交综合、文化、自然、拍照、设施等多维评分，系统保存匿名画像快照和评论情绪；路线推荐根据景点评分与游客历史偏好调整排序，后台大屏展示评分排行、负向反馈、情绪趋势和高频标签。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 数据模型 | `visitor_spot_rating` 多维评分、唯一约束、情绪字段、画像快照和来源字段 | [VisitorSpotRating backend/app/models/persistence.py:L306-L354](../backend/app/models/persistence.py#L306-L354) |
| 景区主数据 | `scenic_spot`、`facility`、`visitor_session`、`chat_message` 和 `route_plan` 支撑评分、路线和大屏 | [ScenicSpot backend/app/models/persistence.py:L64-L86](../backend/app/models/persistence.py#L64-L86), [Facility backend/app/models/persistence.py:L89-L102](../backend/app/models/persistence.py#L89-L102), [VisitorSession backend/app/models/persistence.py:L105-L119](../backend/app/models/persistence.py#L105-L119), [ChatMessage backend/app/models/persistence.py:L122-L136](../backend/app/models/persistence.py#L122-L136), [RoutePlan backend/app/models/persistence.py:L139-L151](../backend/app/models/persistence.py#L139-L151) |
| 景区数据初始化 | 启动时把内置灵山景点和设施同步到 PostgreSQL，避免评分外键缺失 | [init_db backend/app/core/database.py:L58-L69](../backend/app/core/database.py#L58-L69), [ensure_scenic_catalog backend/app/services/scenic_service.py:L255-L298](../backend/app/services/scenic_service.py#L255-L298) |
| 请求/响应模型 | 评分请求包含画像快照、来源和公开标记，响应返回情绪和创建/更新状态 | [SpotRatingRequest backend/app/schemas/visitor.py:L25-L41](../backend/app/schemas/visitor.py#L25-L41), [SpotRatingResponse backend/app/schemas/visitor.py:L44-L67](../backend/app/schemas/visitor.py#L44-L67) |
| 评分服务 | upsert、情绪分析、加权评分、公开评论、游客画像、后台排行和趋势 | [create_or_update_rating backend/app/services/rating_service.py:L151-L176](../backend/app/services/rating_service.py#L151-L176), [get_spot_statistics backend/app/services/rating_service.py:L231-L277](../backend/app/services/rating_service.py#L231-L277), [get_user_preference_profile backend/app/services/rating_service.py:L286-L327](../backend/app/services/rating_service.py#L286-L327), [get_admin_rating_ranking backend/app/services/rating_service.py:L350-L366](../backend/app/services/rating_service.py#L350-L366) |
| 游客 API | `/api/v1/visitor/ratings`、评分历史、景点评分统计和公开评论 | [submit_rating_v1 backend/app/api/v1.py:L232-L235](../backend/app/api/v1.py#L232-L235), [session_ratings_v1 backend/app/api/v1.py:L238-L241](../backend/app/api/v1.py#L238-L241), [spot_rating_stats_v1 backend/app/api/v1.py:L244-L246](../backend/app/api/v1.py#L244-L246), [spot_public_ratings_v1 backend/app/api/v1.py:L249-L252](../backend/app/api/v1.py#L249-L252) |
| 后台 API | `/api/v1/admin/ratings`、评分排行和趋势 | [admin_ratings_v1 backend/app/api/v1.py:L280-L302](../backend/app/api/v1.py#L280-L302), [admin_rating_ranking_v1 backend/app/api/v1.py:L305-L307](../backend/app/api/v1.py#L305-L307), [admin_rating_trend_v1 backend/app/api/v1.py:L310-L312](../backend/app/api/v1.py#L310-L312) |
| 路线反哺 | 路线评分公式读取景点评分与游客偏好画像，生成后写入 `route_plan` | [_route_context backend/app/services/route_service.py:L110-L115](../backend/app/services/route_service.py#L110-L115), [_score_spot backend/app/services/route_service.py:L82-L107](../backend/app/services/route_service.py#L82-L107), [recommend_route backend/app/services/route_service.py:L152-L196](../backend/app/services/route_service.py#L152-L196) |
| 游客前端 | 数字人页新增评分面板、评分统计和提交后路线偏好反馈 | [ChatGuide script frontend/src/pages/visitor/ChatGuide.vue:L29-L114](../frontend/src/pages/visitor/ChatGuide.vue#L29-L114), [ChatGuide rating template frontend/src/pages/visitor/ChatGuide.vue:L183-L211](../frontend/src/pages/visitor/ChatGuide.vue#L183-L211), [visitor rating API frontend/src/api/visitor.ts:L29-L56](../frontend/src/api/visitor.ts#L29-L56) |
| 后台前端 | 大屏新增评分、负向反馈、景点评分排行、情绪趋势和高频标签 | [AdminDashboard frontend/src/pages/admin/AdminDashboard.vue:L28-L105](../frontend/src/pages/admin/AdminDashboard.vue#L28-L105), [admin rating API frontend/src/api/admin.ts:L7-L17](../frontend/src/api/admin.ts#L7-L17) |
| 视觉样式 | 基于卡片、玻璃导航、评分面板和大屏网格的前端视觉刷新 | [UX refresh frontend/src/styles.css:L929-L1259](../frontend/src/styles.css#L929-L1259) |
| 初始化 SQL | 手写 SQL 与 ORM 对齐，包含 pgvector、评分、会话、消息和路线表 | [scripts/init_db.sql:L1-L231](../scripts/init_db.sql#L1-L231) |
| 测试 | 评分 upsert、统计、公开评论、排行和画像测试 | [test_rating_upsert_stats_and_preference_profile backend/tests/test_rating_service.py:L13-L64](../backend/tests/test_rating_service.py#L13-L64) |

### 验收标准

- 同一个 `session_uuid + spot_id` 重复提交评分时更新原记录，而不是产生重复数据。
- 景点评分统计返回综合、文化、自然、拍照、设施、评分分布和高频标签。
- 路线推荐返回 `score_summary.uses_visitor_ratings`，并把路线写入 `route_plan`。
- 后台大屏能从真实问答、路线和评分数据生成热门问答、热门景点、满意度、负向反馈和标签。
- 前端游客页和后台大屏构建通过，且移动端布局不崩溃。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\check_doc_links.py
```

### 影响范围

影响游客评分入口、路线推荐排序、后台数据大屏、PostgreSQL 表结构、`/api/v1` 契约、前端页面视觉和评分相关测试。

## REQ-015 演示视频与最终交付物

### 状态

待完成。

### 用户场景

项目提交前需要输出演示视频、测试报告和最终交付清单，确保代码、文档、测试和演示材料一致。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 运行与演示路径 | 当前已有完整人工演示步骤 | [docs/user_interaction_guide.md:L3-L140](./user_interaction_guide.md#L3-L140) |
| 当前推荐演示路径 | 已给出地图、数字人、后台大屏的串讲顺序 | [docs/implementation_gap_audit.md:L45-L52](./implementation_gap_audit.md#L45-L52) |
| 参考交付方案 | 仓库已有历史演示视频与提交物草案 | [docs/archive/generated/05_test_and_submission_plan.md:L176-L266](./archive/generated/05_test_and_submission_plan.md#L176-L266) |
| 当前验证记录 | 可作为交付报告基础 | [docs/test_reference.md:L118-L192](./test_reference.md#L118-L192) |

### 计划交付结果

- 录制演示视频。
- 产出准确率/延迟测试报告。
- 整理最终提交清单，包括代码版本、文档、测试报告和视频。

### 验收标准

- 视频完整展示数字人问答、地图路线、后台知识库和后台大屏。
- 交付清单能对应到当前代码版本和验证记录。
- 文档中的启动方式、测试命令和视频演示步骤保持一致。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\smoke_vue_full_stack.py
```

### 影响范围

影响比赛交付完整度、评委理解效率和团队最终验收。

## REQ-016 `/api/v1` MVP API 统一与前端调用切换

### 用户场景

游客端、管理端和后续移动端需要统一走 `/api/v1` 前缀，并优先打通 MVP 所需的游客问答、景点设施、路线推荐、后台知识库上传、数字人配置、系统状态等调用链路。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| FastAPI 入口 | 注册旧接口和 `/api/v1` 路由，保留兼容 | [create_app backend/app/main.py:L38-L80](../backend/app/main.py#L38-L80) |
| v1 路由层 | 统一游客、AI 能力、后台和系统状态 MVP 接口 | [backend/app/api/v1.py:L39-L381](../backend/app/api/v1.py#L39-L381) |
| 景区设施 | 为 `GET /api/v1/scenic/facilities` 提供基础数据 | [SCENIC_FACILITIES backend/app/services/scenic_service.py:L228-L247](../backend/app/services/scenic_service.py#L228-L247) |
| 系统状态 | 返回数据库、LLM、ASR、TTS、Avatar 的 MVP 健康状态 | [get_system_status backend/app/services/system_service.py:L19-L33](../backend/app/services/system_service.py#L19-L33) |
| 游客前端 API | 切换到 `/api/v1/guide/*`、`/api/v1/scenic/*`、`/api/v1/route/*` | [frontend/src/api/visitor.ts:L28-L55](../frontend/src/api/visitor.ts#L28-L55) |
| 管理前端 API | 切换到 `/api/v1/auth/*`、`/api/v1/admin/*` | [frontend/src/api/admin.ts:L3-L66](../frontend/src/api/admin.ts#L3-L66) |
| 测试 | 新增 `/api/v1` 路由验证 | [backend/tests/test_api_v1.py:L21-L94](../backend/tests/test_api_v1.py#L21-L94) |

### 当前限制

- `/api/v1/asr/transcribe`、`/api/v1/tts/synthesize`、`/api/v1/avatar/speak` 目前仍是 MVP 占位实现，但数据库和检索主链路已经固定为 PostgreSQL。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
```

### 影响范围

影响游客端问答入口、管理端登录/知识库/数字人配置页面、后续移动端接入方式，以及 `/api/v1` 对外契约。

## REQ-017 PostgreSQL + pgvector 知识库迁移

### 用户场景

知识库和向量检索需要以 PostgreSQL + pgvector 作为默认运行后端，确保后台文档嵌入、游客 RAG 检索、系统状态和容器部署都基于数据库 chunk 表运作，不再依赖 SQLite 默认值。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 配置 | 默认数据库 URL 改为 PostgreSQL，本地复制 `.env.example` 后直接连真实 PostgreSQL | [.env.example:L5-L15](../.env.example#L5-L15), [Settings backend/app/core/config.py:L4-L19](../backend/app/core/config.py#L4-L19) |
| 数据库初始化 | engine 记录当前数据库 URL，PostgreSQL 启动时自动执行 `CREATE EXTENSION IF NOT EXISTS vector` | [current_database_url backend/app/core/database.py:L30-L34](../backend/app/core/database.py#L30-L34), [configure_database backend/app/core/database.py:L42-L55](../backend/app/core/database.py#L42-L55), [init_db backend/app/core/database.py:L58-L66](../backend/app/core/database.py#L58-L66) |
| 数据模型 | 知识库表和知识块表，`embedding` 列在 PostgreSQL 使用 pgvector | [KnowledgeBase backend/app/models/persistence.py:L130-L145](../backend/app/models/persistence.py#L130-L145), [KnowledgeChunk backend/app/models/persistence.py:L148-L179](../backend/app/models/persistence.py#L148-L179) |
| 知识库构建 | 静态资料和后台文档版本写入 `knowledge_chunk` | [build_knowledge_base backend/app/services/vector_store.py:L465-L503](../backend/app/services/vector_store.py#L465-L503) |
| 文档嵌入 | `/api/v1/admin/documents/{id}/embed` 真实切片入库 | [embed_document backend/app/services/vector_store.py:L432-L460](../backend/app/services/vector_store.py#L432-L460), [admin_document_embed_v1 backend/app/api/v1.py:L359-L372](../backend/app/api/v1.py#L359-L372) |
| RAG 检索 | `/api/v1/rag/retrieve` 默认走 pgvector 距离排序 | [vector_backend_name backend/app/services/vector_store.py:L80-L81](../backend/app/services/vector_store.py#L80-L81), [_retrieve_pgvector_chunks backend/app/services/vector_store.py:L506-L529](../backend/app/services/vector_store.py#L506-L529), [retrieve_context backend/app/services/vector_store.py:L575-L596](../backend/app/services/vector_store.py#L575-L596), [rag_retrieve_v1 backend/app/api/v1.py:L220-L222](../backend/app/api/v1.py#L220-L222) |
| 系统状态 | 返回当前真实数据库后端和向量后端类型 | [_database_status backend/app/services/system_service.py:L10-L16](../backend/app/services/system_service.py#L10-L16), [get_system_status backend/app/services/system_service.py:L19-L33](../backend/app/services/system_service.py#L19-L33) |
| 测试 | chunk 表构建、文档生命周期、`/api/v1` 嵌入和检索验证 | [backend/tests/test_vector_store.py:L6-L25](../backend/tests/test_vector_store.py#L6-L25), [backend/tests/test_knowledge_management.py:L21-L63](../backend/tests/test_knowledge_management.py#L21-L63), [backend/tests/test_api_v1.py:L84-L113](../backend/tests/test_api_v1.py#L84-L113) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\run_local.py smoke-docker-postgres
```

### 影响范围

影响后台知识库嵌入接口、游客端 RAG 命中来源、数据库默认连接方式、容器部署依赖和系统状态展示。

## REQ-018 PostgreSQL-only 工程清理

### 用户场景

项目需要彻底去除 SQLite 运行依赖，避免同事继续误用历史 `.db` 文件、旧前端产物和无效配置；仓库默认只保留 PostgreSQL + pgvector 链路。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 配置约束 | `Settings.database_url` 仅接受 PostgreSQL URL，移除无效 `VECTOR_DB_TYPE` 配置 | [Settings backend/app/core/config.py:L4-L19](../backend/app/core/config.py#L4-L19), [_parse_postgres_url backend/app/core/database.py:L21-L27](../backend/app/core/database.py#L21-L27) |
| 运行脚本 | 本地 runner 自动拉起 `postgres` 服务并固定宿主机端口 `5433` | [scripts/run_local.py:L19-L30](../scripts/run_local.py#L19-L30), [ensure_postgres_service scripts/run_local.py:L74-L86](../scripts/run_local.py#L74-L86) |
| Compose 配置 | 宿主机 `5433 -> 容器 5432`，避免误连本机已有 PostgreSQL | [deploy/docker-compose.yml:L25-L40](../deploy/docker-compose.yml#L25-L40) |
| 测试链路 | 所有核心测试改为 PostgreSQL 临时数据库，不再创建 SQLite 文件库 | [postgres_test_database_url backend/tests/postgres_test_utils.py:L10-L17](../backend/tests/postgres_test_utils.py#L10-L17), [backend/tests/test_auth_service.py:L11-L48](../backend/tests/test_auth_service.py#L11-L48), [backend/tests/test_vector_store.py:L7-L25](../backend/tests/test_vector_store.py#L7-L25), [backend/tests/test_api_v1.py:L8-L113](../backend/tests/test_api_v1.py#L8-L113) |
| 前端构建清理 | `vue-tsc` 改为 `noEmit`，删除历史 `frontend/src/*.js(.map)` 编译残留 | [frontend/tsconfig.json:L1-L16](../frontend/tsconfig.json#L1-L16), [frontend/src/main.ts:L1-L9](../frontend/src/main.ts#L1-L9), [frontend/src/api/admin.ts:L1-L66](../frontend/src/api/admin.ts#L1-L66), [frontend/src/api/visitor.ts:L1-L55](../frontend/src/api/visitor.ts#L1-L55) |
| 仓库清理 | 删除 SQLite `.db` 测试产物，只保留 `data/admin_knowledge/.gitkeep` | [data/admin_knowledge/.gitkeep:L1-L1](../data/admin_knowledge/.gitkeep#L1-L1) |
| 依赖收敛 | 后端依赖仅保留 PostgreSQL 驱动，不再保留未使用的 `redis` | [backend/requirements.txt:L1-L8](../backend/requirements.txt#L1-L8) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\check_doc_links.py
python scripts\run_local.py smoke-docker-postgres
```

### 影响范围

影响本地开发、容器部署、测试隔离策略、仓库清洁度，以及新同事对数据库后端的默认认知。

## REQ-025 蓝鲸主题 3D 数字人展示原型

### 用户场景

游客在导览页看到可旋转的原创蓝鲸主题 Q 版 3D 导游。角色随现有问答流程切换待机、思考、讲解等状态；小组可用页面按钮单独演示这些状态。

### 实现位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 3D 模型 | Three.js 程序建模、灯光、材质、口型与动作、旋转、尺寸和资源释放 | [createWhaleAvatar frontend/src/components/Avatar/whaleAvatar3d.ts:L13-L239](../frontend/src/components/Avatar/whaleAvatar3d.ts#L13-L239) |
| 页面组件 | WebGL 初始化、渲染循环、拖动、状态按钮和降级提示 | [DigitalAvatar frontend/src/components/Avatar/DigitalAvatar.vue:L1-L108](../frontend/src/components/Avatar/DigitalAvatar.vue#L1-L108) |
| 状态管理 | 问答切换时取消旧口型计时器，避免过期回调覆盖新状态 | [useAvatarStore frontend/src/store/avatar.ts:L5-L45](../frontend/src/store/avatar.ts#L5-L45) |
| 样式 | 蓝色展示卡、气泡、预览按钮和旋转提示 | [avatar styles frontend/src/styles.css:L307-L444](../frontend/src/styles.css#L307-L444) |
| 测试 | 讲解结束与被思考状态打断的状态验证 | [avatar tests frontend/tests/avatar.test.ts:L1-L33](../frontend/tests/avatar.test.ts#L1-L33) |

### 验证命令

```powershell
cd frontend
npm test
npm run build
```

浏览器打开 `http://127.0.0.1:5173/guide`，拖动模型查看侧面和背面，使用“思考”“讲解演示”按钮观察表情与口型，再点击快捷问题验证真实问答联动。

### 当前边界与影响范围

该角色是程序生成的原创概念造型，参考蓝鲸配色和三视图构图，没有复制用户提供的现成角色模型或美术文件。尚未接入 VRM 骨骼、OpenAvatarChat 或音频驱动口型。改动集中在游客导览页数字人展示、前端依赖与状态计时器，不改变后端 API 或数据库。
