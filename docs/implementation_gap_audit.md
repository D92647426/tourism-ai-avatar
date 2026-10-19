# 实现缺口核查

核查对象：用户提供的 A5 景区导览服务 AI 数字人系统工程设计说明书。  
核查版本：`v0.0` 基线之后的 `codex/optimize-map-avatar-v0.1` 优化分支。

## 1. 已完成或本轮增强

| 计划项 | 当前状态 | 实现依据 |
|---|---|---|
| 游客端可打开 | 已完成 | [Vue 路由 frontend/src/router/index.ts:L10-L20](../frontend/src/router/index.ts#L10-L20) |
| 数字人可显示 | 已增强 | [DigitalAvatar frontend/src/components/Avatar/DigitalAvatar.vue:L1-L64](../frontend/src/components/Avatar/DigitalAvatar.vue#L1-L64) |
| 文本问答 | 已完成 | [chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137) |
| 浏览器语音输入 | 部分完成 | [handleListen frontend/src/pages/visitor/ChatGuide.vue:L74-L98](../frontend/src/pages/visitor/ChatGuide.vue#L74-L98) |
| 浏览器语音播报 | 部分完成 | [speakAnswer frontend/src/pages/visitor/ChatGuide.vue:L62-L72](../frontend/src/pages/visitor/ChatGuide.vue#L62-L72) |
| 口型动画 | 已完成 MVP | [simulateSpeaking frontend/src/store/avatar.ts:L16-L32](../frontend/src/store/avatar.ts#L16-L32) |
| 景区知识库问答 | 已完成 | [retrieve_context backend/app/services/vector_store.py:L591-L614](../backend/app/services/vector_store.py#L591-L614) |
| 用户提供资料入库 | 已完成 | [load_scenic_pack_entries backend/app/services/vector_store.py:L268-L292](../backend/app/services/vector_store.py#L268-L292) |
| 管理后台知识库维护 | 已升级为版本化后台 | [knowledge_upload backend/app/api/admin.py:L39-L50](../backend/app/api/admin.py#L39-L50), [publish_document backend/app/services/knowledge_service.py:L265-L282](../backend/app/services/knowledge_service.py#L265-L282), [KnowledgeManage frontend/src/pages/admin/KnowledgeManage.vue:L216-L265](../frontend/src/pages/admin/KnowledgeManage.vue#L216-L265) |
| 后台登录和写权限 | 已完成 | [login backend/app/api/admin.py:L15-L16](../backend/app/api/admin.py#L15-L16), [require_admin_user backend/app/services/auth_service.py:L134-L145](../backend/app/services/auth_service.py#L134-L145), [AdminLogin frontend/src/pages/admin/AdminLogin.vue:L1-L46](../frontend/src/pages/admin/AdminLogin.vue#L1-L46) |
| 数据库持久化 | 已完成默认 PostgreSQL + pgvector 运行链路，SQLite 依赖已从运行和测试主链路移除 | [configure_database backend/app/core/database.py:L42-L55](../backend/app/core/database.py#L42-L55), [persistence models backend/app/models/persistence.py:L51-L354](../backend/app/models/persistence.py#L51-L354), [deploy/docker-compose.yml:L1-L44](../deploy/docker-compose.yml#L1-L44) |
| 数字人配置持久化 | 已完成 | [save_avatar_config backend/app/services/avatar_service.py:L76-L99](../backend/app/services/avatar_service.py#L76-L99), [AvatarManage frontend/src/pages/admin/AvatarManage.vue:L1-L62](../frontend/src/pages/admin/AvatarManage.vue#L1-L62) |
| 真实景区地图 | 本轮增强 | [ScenicMapView frontend/src/components/ScenicMapView.vue:L1-L101](../frontend/src/components/ScenicMapView.vue#L1-L101) |
| 个性化路线推荐 | 已增强，已接入游客评分与画像反哺 | [recommend_route backend/app/services/route_service.py:L152-L196](../backend/app/services/route_service.py#L152-L196) |
| 游客个性化评分 | 已完成 MVP | [VisitorSpotRating backend/app/models/persistence.py:L306-L354](../backend/app/models/persistence.py#L306-L354), [create_or_update_rating backend/app/services/rating_service.py:L151-L176](../backend/app/services/rating_service.py#L151-L176), [ChatGuide rating frontend/src/pages/visitor/ChatGuide.vue:L183-L211](../frontend/src/pages/visitor/ChatGuide.vue#L183-L211) |
| 管理后台大屏 | 已完成真实聚合 MVP | [dashboard_overview backend/app/services/analytics_service.py:L34-L89](../backend/app/services/analytics_service.py#L34-L89), [AdminDashboard frontend/src/pages/admin/AdminDashboard.vue:L28-L105](../frontend/src/pages/admin/AdminDashboard.vue#L28-L105) |
| 可复现本地启动 | 已完成 | [dev_vue_full_stack main scripts/dev_vue_full_stack.py:L52-L95](../scripts/dev_vue_full_stack.py#L52-L95) |
| Vue 完整栈烟测 | 已完成 | [smoke_vue_full_stack main scripts/smoke_vue_full_stack.py:L67-L122](../scripts/smoke_vue_full_stack.py#L67-L122) |

## 2. 仍未完全实现

| 计划项 | 当前缺口 | 建议下一步 |
|---|---|---|
| 后端真实 ASR | 当前语音识别主要依赖浏览器 SpeechRecognition，后端 `/chat/voice` 仍是演示返回 | 在 [voice_chat backend/app/services/chat_service.py:L90-L94](../backend/app/services/chat_service.py#L90-L94) 接入 Whisper/FunASR 或云 ASR |
| 后端真实 TTS 音频文件 | 当前前端用浏览器 SpeechSynthesis，后端 `audio_url` 是演示路径 | 新增 TTS 服务并替换 [chat_with_text backend/app/services/chat_service.py:L82-L87](../backend/app/services/chat_service.py#L82-L87) |
| 多模态大模型图片识景 | `/chat/image` 仍是固定识别灵山大佛 | 在 [image_chat backend/app/services/chat_service.py:L97-L103](../backend/app/services/chat_service.py#L97-L103) 接入 Qwen-VL 或其他视觉模型 |
| 150 条准确率测试集 | 当前有基础测试，不足 150 条标准问答评测 | 扩充 [data/test_questions.csv:L1-L4](../data/test_questions.csv#L1-L4) 并增加评测脚本 |
| Docker Compose 全链路验证 | 已完成单应用容器 + PostgreSQL/pgvector 烟测，不再是当前缺口 | 继续沿用 [scripts/smoke_docker_postgres.py:L58-L100](../scripts/smoke_docker_postgres.py#L58-L100) 作为部署回归基线 |
| 7 分钟演示视频 | 文档有脚本方向，视频文件未生成 | 基于 [docs/user_interaction_guide.md:L1-L120](./user_interaction_guide.md#L1-L120) 录制 |

## 3. 赛题风险排序

1. 最高风险：真实多模态图片识景和后端 TTS/ASR 仍是部分实现。
2. 中风险：150 条准确率评测仍需补齐；知识库版本化、权限、Docker Compose、数据库持久化、游客评分和后台大屏真实聚合已完成 MVP。
3. 低风险：前端展示、RAG 问答、路线地图、本地运行和烟测已具备演示闭环。

## 4. 当前推荐演示路径

1. 启动系统：[dev_vue_full_stack main scripts/dev_vue_full_stack.py:L52-L95](../scripts/dev_vue_full_stack.py#L52-L95)。
2. 打开数字人导览页：[ChatGuide frontend/src/pages/visitor/ChatGuide.vue:L1-L229](../frontend/src/pages/visitor/ChatGuide.vue#L1-L229)。
3. 提问“我只有两个小时，喜欢历史和拍照，帮我推荐路线”。
4. 展示回答依据、路线卡片和游客评分面板：[chat_with_text backend/app/services/chat_service.py:L85-L137](../backend/app/services/chat_service.py#L85-L137)、[ChatGuide rating frontend/src/pages/visitor/ChatGuide.vue:L183-L211](../frontend/src/pages/visitor/ChatGuide.vue#L183-L211)。
5. 打开地图页展示真实点位和路线：[ScenicMap frontend/src/pages/visitor/ScenicMap.vue:L1-L62](../frontend/src/pages/visitor/ScenicMap.vue#L1-L62)。
6. 打开管理大屏展示问答、路线、评分和情绪指标：[AdminDashboard frontend/src/pages/admin/AdminDashboard.vue:L28-L105](../frontend/src/pages/admin/AdminDashboard.vue#L28-L105)。
