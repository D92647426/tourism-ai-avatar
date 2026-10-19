## 结论

当前骨架的 API 路径和组件结构已覆盖常规交互，但缺少 **可落地的 AI 推理能力**（全部为 Mock）、**语音链路**核心实现、**管理后台前端**、**数字人动画状态机**（现仅占位 CSS）和 **RAG 向量库真正调用**。三人团队应在 **10 个工作日内** 完成 P0 硬闭环（文本问答 + RAG + 管理员知识维护 + 数据大屏基础）。

---

## 模块缺口与补齐建议

| 缺口 | 建议补齐方式 | 关键文件路径 |
|------|------------|-------------|
| **DeepSeek 模型适配器** | 在 `backend/app/services/ai_service.py` 中封装 DeepSeek API 调用，支持流式输出 | `backend/app/services/ai_service.py`（新建）<br>`backend/app/core/config.py` 添加 `DEEPSEEK_API_KEY`/`BASE_URL` |
| **RAG 向量检索** | 用 `chromadb`（嵌入式）写入 `data/faq.csv` 和 `data/scenic_spots.csv`，在 `backend/app/services/knowledge_service.py` 中实现 `retrieve_context` | `backend/app/services/vector_store.py`（新建）<br>`backend/scripts/init_vector_db.py` |
| **ASR 占位 → 真实** | 集成 `modelscope` 或 `whisper` 本地（P1），P0 先用前端录音传文件 → 后端模拟 | `backend/app/services/asr_service.py`（新建）<br>`backend/requirements.txt` 加 `whisper` / `speech_recognition` |
| **TTS 返回** | 使用 `edge-tts`（免费，中文好）生成 mp3，存入 `backend/static/audio/` | `backend/app/services/tts_service.py`（新建）<br>`backend/requirements.txt` 加 `edge-tts` |
| **管理前端** | 新建 `frontend/src/pages/admin/` 下：KnowledgeView.vue、AnalyticsDashboard.vue、AvatarConfig.vue | `frontend/src/api/admin.ts` 补充接口<br>路由在 `router/index.ts` 新增 `/admin/*` |
| **数字人动画完善** | 拆 `DigitalAvatar.vue` 为状态机组件，P1 集成 `pixi-live2d-display`（参考 guansss 仓库） | `frontend/src/components/Avatar/Live2dAvatar.vue`（P1）<br>P0 继续用 CSS 模拟 |
| **音频录制与上传组件** | 新建 `VoiceRecorder.vue`，利用 `MediaRecorder` 录制 webm 并 POST | `frontend/src/components/VoiceRecorder.vue` |
| **数据大屏 ECharts** | 在 `AnalyticsDashboard.vue` 中画 6 个卡片：今日访问量、热门景点 Top5、平均停留时长、情绪分布、对话轮次、错误率 | `frontend/src/components/admin/EChartsCard.vue`（通用包装） |
| **游客感受度报告** | 新增后端统计接口 `/api/admin/analytics/report` 已有骨架，但需从 Redis/Postgres 聚合 | `backend/app/schemas/admin.py` 补充 ReportResponse |
| **会话持久化** | 建 `sessions` 表（Postgres），`chat_history` 表存储每轮对话 | `backend/app/models/session.py`、`backend/app/models/chat.py` |

---

## 接口冻结清单（不可随意增删改）

以下接口在 **P0 阶段后** 必须稳定，前端/后端/测试基于此开发：

### 游客端
| 接口 | 方法 | 请求字段 | 响应关键字段 |
|------|------|---------|--------------|
| `/api/visitor/sessions` | POST | `user_profile: {age, interests?}` | `session_uuid`, `avatar_config` |
| `/api/visitor/chat/text` | POST | `session_uuid, message` | `answer, emotion, audio_url, lip_sync, references, cards, latency_ms` |
| `/api/visitor/chat/voice` | POST (multipart) | `session_uuid(Form)`, `audio_file(File)` | 与 text 一致 + `asr_text` |
| `/api/visitor/chat/image` | POST (multipart) | `session_uuid`, `question(Form)`, `image_file(File)` | 与 text 一致 + `recognized_spot` |
| `/api/visitor/scenic-spots` | GET | 无 | `[{id, name, tags, description, map_x, map_y}]` |
| `/api/visitor/routes/recommend` | POST | `session_uuid, preferences: {duration, interests, start_spot_id}` | `route: [{spot_id, name, duration, order}], total_duration, tips` |

### 管理端
| 接口 | 方法 | 请求字段 | 响应关键字段 |
|------|------|---------|--------------|
| `/api/admin/login` | POST | `username, password` | `token` (固定 demo 串，后续换 JWT) |
| `/api/admin/knowledge/documents` | GET | 无 | `[{id, title, type, updated_at}]` |
| `/api/admin/knowledge/search-test` | POST | `{ query: string }` | `[{text, source, score}]` |
| `/api/admin/avatar-configs/active` | GET | 无 | `{name, emotion_states: {idle, speaking, thinking...}, model_params}` |
| `/api/admin/avatar-configs` | POST | 完整配置对象 | `{success: true}` |
| `/api/admin/analytics/overview` | GET | 无 | `{visitor_count, avg_stay, hot_spots, emotion_distribution, chat_count, error_rate}` |
| `/api/admin/analytics/report` | GET | 无 | `{generated_at, summary, details: [{session_uuid, satisfaction, emotion_curve, key_interactions}]}` |

**冻结规则**：P0 期间不允许修改上述接口的响应 JSON 结构（可新增字段），前端按此开发。

---

## 三人优先级计划（P0/P1/P2）

### 🚀 P0（第 1-3 天）——核心闭环

| 任务 | 负责人 | 产出物 |
|------|--------|--------|
| 实现 DeepSeek 适配器 + 流式输出 | 后端 A | `backend/app/services/ai_service.py`，`backend/app/core/llm_client.py` |
| 重写 `knowledge_service.retrieve_context` 调用 chromadb | 后端 A | `backend/app/services/vector_store.py`，`backend/scripts/init_vector_db.py` |
| 真实 TTS（edge-tts）集成到 `chat_with_text` 返回 `audio_url` | 后端 B | `backend/app/services/tts_service.py`，修改 `chat_service.py` |
| 管理端登录 + 知识库文档列表页面 | 前端 A | `frontend/src/pages/admin/Login.vue`, `KnowledgeView.vue` |
| 数据大屏概览页面（Mock 数据先，后接真实） | 前端 A | `frontend/src/pages/admin/AnalyticsDashboard.vue` |
| 语音录制组件 + 前端录音上传 | 前端 B | `frontend/src/components/VoiceRecorder.vue`，修改 `ChatGuide.vue` |
| 会话持久化（Postgres 表 + 会话中间件） | 后端 B | `backend/app/models/` 新增，`alembic migration` |

### 🔧 P1（第 4-6 天）——体验提升

| 任务 | 负责人 | 产出物 |
|------|--------|--------|
| 管理端数字人配置页面（表情/声音/角色名称编辑） | 前端 A | `frontend/src/pages/admin/AvatarConfig.vue` |
| 管理端检索测试页面 | 前端 B | 利用已有 `search-test` 接口 |
| 后端图片识别接入（调用 DeepSeek Vision 或本地 CLIP） | 后端 A | `backend/app/services/image_service.py`，修改 `chat_service.image_chat` |
| 实时口型同步（基于音频能量 RMS） | 前端 B | 在 `DigitalAvatar.vue` 中提取音频能量并更新 `mouthOpen` |
| 感受度报告后端聚合逻辑 | 后端 A | `backend/app/services/analytics_service.py` 补充 SQL 聚合 |
| 错误处理中间件 + 统一日志格式 | 后端 B | `backend/app/middleware/error_handler.py`，`backend/app/core/logger.py` |

### 🎯 P2（第 7-10 天）——完善与部署

| 任务 | 负责人 | 产出物 |
|------|--------|--------|
| Live2D 数字人集成 | 前端 A | 引入 pixi-live2d-display，替代 CSS 假人 |
| Docker Compose 中添加 chroma、redis 服务 | 后端 A/B | `deploy/docker-compose.yml` 扩展 |
| 性能优化（Redis 缓存热门问答、响应压缩） | 后端 A | `backend/app/core/cache.py` |
| 自动化测试（API 测试 + 前端组件测试） | 前端 A + 后端 B | `backend/tests/`，`frontend/__tests__/` |
| Dev/prod 环境分离配置 | 后端 B | `.env.dev`, `.env.prod`, `backend/app/core/config.py` 读取 |

---

## 下一步可直接执行清单（今天就开干）

1. **后端 A 立即**：
   - 在 `backend/app/core/config.py` 添加 `DEEPSEEK_API_KEY` 和 `CHROMA_DB_PATH`。
   - 创建 `backend/app/services/ai_service.py`，实现 `deepseek_chat(messages: list, stream: bool) -> str`。
   - 创建 `backend/scripts/init_vector_db.py`，将 `data/faq.csv` 和 `data/scenic_spots.csv` 写入 chromadb。

2. **后端 B 立即**：
   - 在 `backend/requirements.txt` 添加 `edge-tts`, `chromadb`, `numpy`。
   - 创建 `backend/app/services/tts_service.py`，实现 `text_to_speech(text: str, voice: str) -> str`（返回文件路径）。
   - 创建 `backend/app/models/session.py` 和 `backend/app/models/chat.py`，定义 SQLAlchemy 模型。
   - 运行 `alembic init migrations` 并生成初始迁移。

3. **前端 A/B 立即**：
   - 在 `frontend/src/router/index.ts` 添加管理端路由（`/admin/login`, `/admin/knowledge`, `/admin/analytics`, `/admin/avatar`）。
   - 在 `frontend/src/api/admin.ts` 中实现所有管理端接口调用（基于现有 API 文档）。
   - 在 `ChatGuide.vue` 中添加录音按钮（调用 `navigator.mediaDevices.getUserMedia`）并上传 `/api/visitor/chat/voice`。

4. **全体**：在项目根目录创建 `docs/CHECKLIST.md`，每日更新进度并标记阻塞项。
