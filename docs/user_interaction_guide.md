# 项目交互与运行指南

## 1. 推荐启动方式

### 方式 A：Git Bash 手动体验，推荐

```bash
bash scripts/dev_vue_full_stack.sh
```

启动后打开：

| 页面 | 地址 | 用途 |
|---|---|---|
| 数字人导游 | http://127.0.0.1:5173/guide | 测试灵灵数字人、文本问答、浏览器语音输入、语音播报、RAG 引用和路线卡片 |
| 景区地图 | http://127.0.0.1:5173/map | 查看灵山胜境真实点位、地图路线、兴趣和时间筛选 |
| 后台登录 | http://127.0.0.1:5173/admin/login | 管理员登录，默认 `admin` / `123456`，登录后 token 存入浏览器 localStorage |
| 管理大屏 | http://127.0.0.1:5173/admin | 查看热门问答、热门景点、路线偏好、情绪趋势 |
| 知识库管理 | http://127.0.0.1:5173/admin/knowledge | 上传草稿、发布、归档、软删除、查看版本/历史、重建索引并检索验证 |
| 数字人配置 | http://127.0.0.1:5173/admin/avatar | 保存当前启用的数字人配置 |

对应实现：

- [Git Bash 启动脚本 scripts/dev_vue_full_stack.sh:L1-L5](../scripts/dev_vue_full_stack.sh#L1-L5)
- [持续运行入口 scripts/dev_vue_full_stack.py:L56-L100](../scripts/dev_vue_full_stack.py#L56-L100)
- [前端路由 frontend/src/router/index.ts:L10-L20](../frontend/src/router/index.ts#L10-L20)

停止方式：在终端按 `Ctrl+C`。

### 方式 B：Git Bash 自动烟测

```bash
bash scripts/smoke_vue_full_stack.sh
```

用途：自动启动后端和 Vue，检查页面和 API 后自动退出。

- [Git Bash 烟测脚本 scripts/smoke_vue_full_stack.sh:L1-L5](../scripts/smoke_vue_full_stack.sh#L1-L5)
- [Vue 完整栈烟测 scripts/smoke_vue_full_stack.py:L67-L122](../scripts/smoke_vue_full_stack.py#L67-L122)

### 方式 C：PowerShell / CMD 手动体验

```powershell
python scripts\dev_vue_full_stack.py
```

### 方式 D：PowerShell / CMD 自动烟测

```powershell
python scripts\smoke_vue_full_stack.py
```

### 方式 E：只跑后端

```powershell
python scripts\run_local.py serve-backend
```

后端健康检查：

```text
http://127.0.0.1:8000/api/health
```

实现位置：

- [后端启动 scripts/run_local.py:L89-L105](../scripts/run_local.py#L89-L105)
- [后端健康检查 backend/app/main.py:L51-L53](../backend/app/main.py#L51-L53)

### 方式 F：Vue 前端单独运行

需要后端已运行。

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

### 方式 G：静态兜底演示

如果 npm/Vue 临时不可用：

```powershell
python scripts\smoke_full_stack.py
```

该方式启动后端和无依赖静态演示端，适合演示兜底。

- [静态演示端 frontend_static/index.html:L170-L218](../frontend_static/index.html#L170-L218)
- [静态完整栈烟测 scripts/smoke_full_stack.py:L30-L61](../scripts/smoke_full_stack.py#L30-L61)

### 方式 H：Docker Compose

```powershell
python scripts\run_local.py smoke-docker-postgres
```

当前 Compose 路径已经是正式可验收方案：

- `app` 容器同时承载 FastAPI 和构建后的 Vue 静态资源；
- `postgres` 服务提供真实 PostgreSQL + pgvector；
- 不提交 `frontend/dist` 也可直接从源码构建镜像；
- 宿主机访问 PostgreSQL 时使用 `127.0.0.1:5433`；
- 默认访问地址切到 `http://127.0.0.1:8000/guide`、`http://127.0.0.1:8000/map`、`http://127.0.0.1:8000/admin/login`；
- 烟测脚本会自动在结束后执行 `docker compose down`。

对应实现：

- [Compose 编排 deploy/docker-compose.yml:L1-L44](../deploy/docker-compose.yml#L1-L44)
- [单容器镜像 deploy/Dockerfile:L1-L31](../deploy/Dockerfile#L1-L31)
- [SPA 静态托管 backend/app/main.py:L66-L78](../backend/app/main.py#L66-L78)
- [Docker pgvector 烟测 scripts/smoke_docker_postgres.py:L58-L100](../scripts/smoke_docker_postgres.py#L58-L100)

### 方式 I：Docker All-in-One

```powershell
python scripts\run_local.py smoke-docker-allinone
```

当前单容器路径适合只接受一个容器镜像的演示或交付环境：

- 单个 `allinone` 容器同时提供 FastAPI 和 PostgreSQL + pgvector；
- 宿主机访问页面仍使用 `http://127.0.0.1:8000/guide`、`/map`、`/admin/login`；
- 宿主机访问数据库仍使用 `127.0.0.1:5433`；
- 该方案用于交付增强，不替代更可维护的双容器正式方案。

对应实现：

- [All-in-One Compose deploy/docker-compose.allinone.yml:L1-L36](../deploy/docker-compose.allinone.yml#L1-L36)
- [All-in-One 镜像 deploy/Dockerfile.allinone:L1-L43](../deploy/Dockerfile.allinone#L1-L43)
- [单容器启动编排 deploy/start_allinone.py:L228-L240](../deploy/start_allinone.py#L228-L240)
- [Docker All-in-One 烟测 scripts/smoke_docker_allinone.py:L70-L114](../scripts/smoke_docker_allinone.py#L70-L114)

## 2. 数字人导游测试流程

1. 启动：

   ```bash
   bash scripts/dev_vue_full_stack.sh
   ```

2. 打开：

   ```text
   http://127.0.0.1:5173/guide
   ```

3. 输入测试问题：

   ```text
   我只有两个小时，喜欢历史和拍照，怎么逛？
   灵山大佛有什么历史故事？
   梵宫和五印坛城有什么特色？
   附近哪里有洗手间？
   下雨天怎么玩？
   ```

4. 预期表现：

   - 左侧显示“灵灵”数字人形象，包含状态、字幕和口型动画。
   - 提交问题后，数字人状态先显示“思考中”，回答后进入“讲解中”。
   - 点击语音按钮时，支持浏览器 SpeechRecognition 的环境会尝试语音识别；不支持时会提示改用文字输入。
   - 回答后浏览器 SpeechSynthesis 会进行中文语音播报，同时驱动嘴部动画。
   - 回答由后端 [chat_with_text backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88) 生成。
   - 有 DeepSeek Key 时，响应中 `model_used` 应为 `deepseek-v4-flash`。
   - 回答应引用本地知识库片段。

## 3. 地图和路线测试流程

1. 打开：

   ```text
   http://127.0.0.1:5173/map
   ```

2. 修改兴趣和时间：

   ```text
   历史文化 / 拍照打卡 / 亲子互动 / 自然慢行 / 研学深度
   1 小时 / 2 小时 / 3 小时 / 5 小时
   ```

3. 预期表现：

   - 地图展示太湖水系、山体、中轴线、灵山大照壁、五智门、九龙灌浴、灵山大佛、梵宫、五印坛城等 POI。
   - 点击 POI 后显示景点简介、讲解词、标签和建议停留时间。
   - 路线根据后端 [recommend_route backend/app/services/route_service.py:L80-L116](../backend/app/services/route_service.py#L80-L116) 返回的景点顺序绘制。
   - 地图组件实现位置为 [ScenicMapView frontend/src/components/ScenicMapView.vue:L1-L101](../frontend/src/components/ScenicMapView.vue#L1-L101)。

## 4. 后端 API 直接测试

### 文本问答

```bash
python scripts/smoke_vue_full_stack.py
```

或者只测后端：

```bash
python scripts/run_local.py smoke-backend
```

对应 API：

- [游客文本问答 API docs/api_reference.md](./api_reference.md#api-002-游客文本问答)
- [text_chat backend/app/api/visitor.py:L20-L21](../backend/app/api/visitor.py#L20-L21)

### 知识库检索测试

后台接口：

```text
POST /api/admin/knowledge/search-test
```

实现位置：

- [knowledge_search_test backend/app/api/admin.py:L64-L66](../backend/app/api/admin.py#L64-L66)
- [search_test backend/app/services/knowledge_service.py:L169-L170](../backend/app/services/knowledge_service.py#L169-L170)

## 5. 知识库管理测试流程

1. 打开：

   ```text
   http://127.0.0.1:5173/admin/login
   ```

2. 登录：

   ```text
   用户名：admin
   密码：123456
   ```

   登录页实现为 [AdminLogin frontend/src/pages/admin/AdminLogin.vue:L1-L46](../frontend/src/pages/admin/AdminLogin.vue#L1-L46)，后端鉴权为 [authenticate_admin backend/app/services/auth_service.py:L110-L131](../backend/app/services/auth_service.py#L110-L131)。

3. 进入知识库管理：

   ```text
   http://127.0.0.1:5173/admin/knowledge
   ```

4. 上传资料：

   - 在“上传知识文档”中填写标题；
   - 选择 `.md/.txt/.csv/.json/.docx/.xlsx` 文件；
   - 点击“上传为草稿”。

   对应后端入口为 [knowledge_upload backend/app/api/admin.py:L39-L50](../backend/app/api/admin.py#L39-L50)，保存后会调用 [save_document backend/app/services/knowledge_service.py:L153-L213](../backend/app/services/knowledge_service.py#L153-L213)。上传默认状态是 `draft`，不会进入游客端 RAG。

5. 新增或更新文本资料：

   - 在“维护文本资料”中填写标题和正文；
   - 点击“保存为草稿”或在文档列表中选择可维护资料后点击“更新资料”。

   对应后端更新入口为 [knowledge_update backend/app/api/admin.py:L54-L67](../backend/app/api/admin.py#L54-L67)。更新不会覆盖历史，会创建新版本并回到 `draft`。

6. 发布并验证是否进入知识库：

   - 点击文档卡片上的“发布”；
   - 确认状态变为“已发布”；
   - 在“检索测试”中输入新增资料相关问题；
   - 结果列表应出现 `data/admin_knowledge/...` 来源；
   - 再到数字人页 `http://127.0.0.1:5173/guide` 提问同一问题，回答引用应包含新增资料。

   发布实现为 [publish_document backend/app/services/knowledge_service.py:L265-L282](../backend/app/services/knowledge_service.py#L265-L282)，向量入库只读取 active 文档的当前版本，位置为 [load_admin_document_entries backend/app/services/vector_store.py:L150-L201](../backend/app/services/vector_store.py#L150-L201)。

7. 查看版本和上传历史：

   - 点击“版本”查看每次上传/编辑生成的版本；
   - 点击“历史”查看上传、更新、发布、归档、删除、重建索引等操作日志。

   对应实现为 [list_versions backend/app/services/knowledge_service.py:L340-L369](../backend/app/services/knowledge_service.py#L340-L369) 和 [list_history backend/app/services/knowledge_service.py:L372-L396](../backend/app/services/knowledge_service.py#L372-L396)。

8. 删除和重建：

   - 后台上传资料可点击“删除”，系统会软删除并保留历史；
   - 如手动改了资料文件，可点击“重建索引”。

   对应实现为 [delete_document backend/app/services/knowledge_service.py:L305-L324](../backend/app/services/knowledge_service.py#L305-L324) 和 [knowledge_reindex backend/app/api/admin.py:L116-L117](../backend/app/api/admin.py#L116-L117)。

## 6. 数字人配置测试流程

1. 登录后台后打开：

   ```text
   http://127.0.0.1:5173/admin/avatar
   ```

2. 修改名称、风格、服装、音色、语速或欢迎语。
3. 点击“保存配置”。
4. 刷新游客端 `/guide`，新会话会读取当前 active 数字人配置。

实现位置：

- [AvatarManage frontend/src/pages/admin/AvatarManage.vue:L1-L62](../frontend/src/pages/admin/AvatarManage.vue#L1-L62)
- [save_avatar_config backend/app/services/avatar_service.py:L76-L99](../backend/app/services/avatar_service.py#L76-L99)
- [create_session backend/app/services/chat_service.py:L30-L36](../backend/app/services/chat_service.py#L30-L36)

## 7. Git Bash 路径规则

Git Bash / MINGW64 中必须使用 `/`：

```bash
python scripts/run_local.py check-env
```

不要使用 `\`：

```bash
python scripts\run_local.py check-env
```

原因和修复记录见 [TRB-008 Git Bash 中使用反斜杠导致 Python 找不到脚本](./troubleshooting.md#trb-008-git-bash-中使用反斜杠导致-python-找不到脚本)。
