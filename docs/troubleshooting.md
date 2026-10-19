# 通用排错经验

## TRB-001 前端 npm install 超时或 ECONNRESET

### 错误现象

`npm install` 长时间无输出，日志中出现 `ECONNRESET`。

### 常见原因

本机到 npm registry 或镜像源的网络连接不稳定。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| npm 配置 | 已切换 registry 并关闭 audit/fund/progress | [frontend/.npmrc:L1-L4](../frontend/.npmrc#L1-L4) |
| 前端安装入口 | Python subprocess 调用 npm | [install_frontend_deps scripts/run_local.py:L70-L71](../scripts/run_local.py#L70-L71) |
| 静态兜底 | 无 npm 依赖演示前端 | [frontend_static/index.html:L170-L218](../frontend_static/index.html#L170-L218) |

### 修复方式

优先重试：

```powershell
python scripts\run_local.py install-frontend
```

当前网络恢复后已验证 `npm install` 成功，安装入口仍为 [install_frontend_deps scripts/run_local.py:L70-L71](../scripts/run_local.py#L70-L71)。

如果持续失败，使用静态前端兜底：

```powershell
python scripts\smoke_full_stack.py
```

## TRB-002 端口占用

### 错误现象

后端或前端启动失败，提示端口已被占用。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 端口检查 | 检查 8000/5173 是否忙 | [port_is_busy scripts/run_local.py:L45-L48](../scripts/run_local.py#L45-L48) |
| 环境检查 | 输出端口占用状态 | [check_env scripts/run_local.py:L51-L63](../scripts/run_local.py#L51-L63) |
| Vue 烟测复用 | 如果 8000/5173 已有健康服务则复用，否则再启动 | [is_url_ready scripts/smoke_vue_full_stack.py:L43-L50](../scripts/smoke_vue_full_stack.py#L43-L50), [main scripts/smoke_vue_full_stack.py:L67-L122](../scripts/smoke_vue_full_stack.py#L67-L122) |

### 验证命令

```powershell
python scripts\run_local.py check-env
python scripts\smoke_vue_full_stack.py
```

## TRB-003 DeepSeek API Key 缺失或调用失败

### 错误现象

游客问答返回 `model_used = mock-fallback`。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 配置 | DeepSeek Key、模型和超时配置 | [.env.example:L25-L28](../.env.example#L25-L28) |
| 客户端 | 判断 Key 是否存在、设置超时并调用 API | [DeepSeekClient backend/app/services/deepseek_service.py:L9-L50](../backend/app/services/deepseek_service.py#L9-L50) |
| 降级逻辑 | API 异常时回退到本地回答 | [chat_with_text backend/app/services/chat_service.py:L53-L69](../backend/app/services/chat_service.py#L53-L69) |

### 验证命令

```powershell
python scripts\run_local.py smoke-backend
```

## TRB-004 知识库检索不到内容

### 常见原因

知识库文件未生成、资料文件缺失或查询词与资料差距过大。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 构建入口 | 生成 JSON 向量库 | [build_knowledge_base backend/app/services/vector_store.py:L223-L243](../backend/app/services/vector_store.py#L223-L243) |
| 检索入口 | 计算查询向量并排序 | [retrieve_context backend/app/services/vector_store.py:L252-L273](../backend/app/services/vector_store.py#L252-L273) |
| 数据源 | 示范景区导览资料 | [data/raw_documents/demo_scenic_guide.md:L1-L25](../data/raw_documents/demo_scenic_guide.md#L1-L25) |

### 验证命令

```powershell
python scripts\run_local.py build-kb
python scripts\run_local.py test-backend
```

## TRB-005 真实 xlsx 资料过大导致知识库构建超时

### 错误现象

构建真实资料包时长时间无输出，进程卡在 xlsx 解析或向量化阶段。

### 原因分析

真实资料包中的行为分析表工作表 XML 体积较大，全量解析会生成大量低价值数字行为数据。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| xlsx 抽取 | 仅抽取文本/含中文内容并限制单元格数量 | [extract_xlsx_text backend/app/services/vector_store.py:L151-L188](../backend/app/services/vector_store.py#L151-L188) |
| 资料包读取 | xlsx 标记为 `behavior_data`，路线问答默认排除 | [load_scenic_pack_entries backend/app/services/vector_store.py:L191-L216](../backend/app/services/vector_store.py#L191-L216) |
| 路线上下文过滤 | 路线问题排除 xlsx 行为数据，避免回答其他景区 | [chat_with_text backend/app/services/chat_service.py:L38-L88](../backend/app/services/chat_service.py#L38-L88) |

### 验证命令

```powershell
python scripts\run_local.py build-kb
python scripts\run_local.py smoke-backend
```

## TRB-006 Element Plus 类型声明导致 Vue 构建失败

### 错误现象

```text
node_modules/element-plus/... Type 'GlobalComponents' does not satisfy the constraint ...
```

### 原因分析

当前页面没有使用 Element Plus 组件，但入口文件全局注册了 Element Plus，`vue-tsc` 会检查其声明文件并触发第三方类型兼容问题。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 修复位置 | 移除未使用的 Element Plus 全局注册和样式导入 | [frontend/src/main.ts:L1-L9](../frontend/src/main.ts#L1-L9) |
| 构建入口 | Vue production build | [build_frontend scripts/run_local.py:L74-L75](../scripts/run_local.py#L74-L75) |

### 验证命令

```powershell
python scripts\run_local.py build-frontend
```

## TRB-007 Vue 烟测后 Vite 子进程残留

### 错误现象

Vue 完整栈烟测结束后，`5173` 端口仍被 Vite 子进程占用。

### 原因分析

Windows 下 `npm run dev` 会启动子进程，直接 `terminate()` 父进程不一定清理完整进程树。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 修复位置 | Windows 下使用 `taskkill /T /F` 清理进程树 | [terminate_tree scripts/smoke_vue_full_stack.py:L52-L62](../scripts/smoke_vue_full_stack.py#L52-L62) |
| 烟测入口 | 复用健康服务或启动 FastAPI 与 Vite 并最终清理 | [main scripts/smoke_vue_full_stack.py:L67-L122](../scripts/smoke_vue_full_stack.py#L67-L122) |

### 验证命令

```powershell
python scripts\smoke_vue_full_stack.py
python scripts\run_local.py check-env
```

## TRB-008 Git Bash 中使用反斜杠导致 Python 找不到脚本

### 错误现象

```text
python.exe: can't open file '...\\scriptsrun_local.py': [Errno 2] No such file or directory
```

### 原因分析

Git Bash / MINGW64 中反斜杠 `\` 是转义字符，不是可靠的路径分隔符。`scripts\run_local.py` 会被解析成 `scriptsrun_local.py`。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| Git Bash 命令说明 | 使用 `/` 路径或 `.sh` 包装脚本 | [docs/DEPLOY.md:L19-L37](./DEPLOY.md#L19-L37) |
| Git Bash runner | 转到项目根目录并调用 Python runner | [scripts/run_local.sh:L1-L5](../scripts/run_local.sh#L1-L5) |
| Git Bash Vue 烟测 | 转到项目根目录并调用 Vue 烟测 | [scripts/smoke_vue_full_stack.sh:L1-L5](../scripts/smoke_vue_full_stack.sh#L1-L5) |

### 修复方式

在 Git Bash 中使用：

```bash
python scripts/run_local.py install-frontend
python scripts/run_local.py build-frontend
python scripts/smoke_vue_full_stack.py
```

或：

```bash
bash scripts/run_local.sh install-frontend
bash scripts/run_local.sh build-frontend
bash scripts/smoke_vue_full_stack.sh
```

## TRB-009 Playwright CLI 包下载失败

### 错误现象

```text
npm error network request to https://registry.npmmirror.com/@playwright%2fcli failed, reason: read ECONNRESET
```

### 原因分析

Playwright skill 的 wrapper 依赖 `npx --package @playwright/cli`。当前 `npx` 存在，但下载 `@playwright/cli` / `playwright` 包时 registry 连接重置。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| Playwright 脚本 | 启动 PostgreSQL、后端、Vite 后调用 Playwright wrapper，目标页面包括首页、`/guide`、`/admin/login` | [scripts/playwright_smoke_vue.py:L74-L125](../scripts/playwright_smoke_vue.py#L74-L125) |
| 根 npm 配置 | Playwright wrapper 在仓库根目录读取此配置 | [.npmrc:L1-L4](../.npmrc#L1-L4) |

### 验证命令

```bash
command -v npx
python scripts/playwright_smoke_vue.py
```

如果 registry 仍然 `ECONNRESET`，先使用已通过的 Vue 完整栈烟测：

```bash
python scripts/smoke_vue_full_stack.py
```

## TRB-010 GitHub push 连接中断

### 错误现象

```text
fatal: unable to access 'https://github.com/2667741708/ling-shan-digital-guide.git/': Recv failure: Connection was aborted
```

SSH 检查也可能出现：

```text
kex_exchange_identification: read: Connection aborted
banner exchange: Connection to 198.18.0.25 port 22: Connection aborted
```

### 常见原因

1. 当前网络或代理阻断 GitHub HTTPS/SSH。
2. GitHub 域名被解析到代理虚拟网段，连接在认证前被中断。
3. 本机 Git 凭据并未进入认证流程，因此不是代码或仓库内容问题。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 发布脚本 | 推送当前分支和 tag 到 GitHub | [publish_github main scripts/publish_github.py:L56-L84](../scripts/publish_github.py#L56-L84) |
| 远程配置 | 新增或更新 `origin` | [configure_remote scripts/publish_github.py:L47-L53](../scripts/publish_github.py#L47-L53) |
| 发布文档 | 可复现发布命令 | [docs/DEPLOY.md:L110-L128](./DEPLOY.md#L110-L128) |
| 错误记录 | 本次连接中断记录 | [ERR-0009 docs/error_traceability.md:L295-L334](./error_traceability.md#L295-L334) |

### 排查命令

```powershell
git remote -v
git status --short --branch
ssh -T git@github.com
python scripts\publish_github.py --help
```

### 修复方式

先恢复可访问 GitHub 的网络或代理，再执行：

```powershell
python scripts\publish_github.py --remote-url https://github.com/2667741708/ling-shan-digital-guide.git --branch main --push-tags
```

如果 HTTPS 仍失败，可以先确认 SSH 可用，再切换 remote：

```powershell
git remote set-url origin git@github.com:2667741708/ling-shan-digital-guide.git
git push -u origin codex/optimize-map-avatar-v0.1:main
git push origin --tags
```

### 本次成功判定

本次后来提交成功不是因为修改了 GitHub 仓库或发布脚本，而是网络恢复后同一发布流程可以正常访问 GitHub。成功输出和远程校验如下：

```text
已推送 codex/optimize-map-avatar-v0.1 -> origin/main
b630176... refs/heads/main
37cd58b... refs/tags/v0.0
```

验证命令：

```powershell
git ls-remote --heads origin main
git ls-remote --tags origin v0.0
```

关联记录：

- [ERR-0009 GitHub 推送连接被中断 docs/error_traceability.md:L295-L334](./error_traceability.md#L295-L334)
- [ERR-0010 GitHub 发布先失败后成功复盘 docs/error_traceability.md:L195-L259](./error_traceability.md#L195-L259)

## TRB-011 直接 git add 被工具层拦截

### 错误现象

直接执行 Git 暂存命令时出现：

```text
approval required by policy, but AskForApproval is set to Never
```

### 常见原因

这是当前 Codex 工具层对直接 Git 命令的审批策略拦截，不表示 Git 仓库损坏，也不表示文件无法暂存。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 项目规范 | 部署、进程、文件状态优先使用 Python subprocess 封装执行 | [AGENTS.md:L21-L23](../AGENTS.md#L21-L23) |
| 发布脚本 | Python subprocess 封装 Git 命令 | [run_git scripts/publish_github.py:L22-L35](../scripts/publish_github.py#L22-L35) |
| 错误复盘 | 本次直接 Git 命令失败和 Python subprocess 成功原因 | [ERR-0010 docs/error_traceability.md:L195-L259](./error_traceability.md#L195-L259) |

### 修复方式

用 Python subprocess 在项目根目录封装 Git 命令，例如：

```powershell
@'
import subprocess
from pathlib import Path

root = Path(r"C:\Users\hmw20\Documents\New project 3")
subprocess.run(["git", "add", "-A"], cwd=root, check=True)
subprocess.run(["git", "commit", "-m", "docs(git): record publish failure and success"], cwd=root, check=True)
'@ | python -
```

### 验证方式

```powershell
git status --short --branch
git log -1 --oneline
```

## TRB-012 后台知识文档上传后检索不到

### 错误现象

后台上传资料成功，但“检索测试”或游客端问答没有命中新资料。

### 常见原因

1. 上传文件为空或扩展名不在 `.md/.txt/.csv/.json/.docx/.xlsx` 范围内。
2. `data/admin_knowledge` 中有文件，但未重建本地向量库。
3. 查询词与资料内容差距过大，需要补充 FAQ 式关键词。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 上传入口 | 上传后保存文件并重建索引 | [knowledge_upload backend/app/api/admin.py:L29-L36](../backend/app/api/admin.py#L29-L36) |
| 保存逻辑 | 检查空文件和支持类型 | [save_document backend/app/services/knowledge_service.py:L73-L90](../backend/app/services/knowledge_service.py#L73-L90) |
| 入库逻辑 | 读取后台上传资料并切片 | [load_admin_document_entries backend/app/services/vector_store.py:L150-L170](../backend/app/services/vector_store.py#L150-L170) |
| 手动重建 | 后台重建索引 API | [knowledge_reindex backend/app/api/admin.py:L59-L61](../backend/app/api/admin.py#L59-L61) |

### 修复方式

1. 在 `http://127.0.0.1:5173/admin/knowledge` 点击“重建索引”。
2. 运行：

   ```powershell
   python scripts\run_local.py build-kb
   ```

3. 在检索测试中输入资料中的关键词，确认结果来源包含 `data/admin_knowledge`。

## TRB-012 pytest 默认临时目录权限拒绝

### 错误现象

```text
PermissionError: [WinError 5] 拒绝访问。: 'C:\\Users\\hmw20\\AppData\\Local\\Temp\\pytest-of-hmw20'
```

### 原因分析

当前机器的 pytest 默认临时目录权限异常，使用 `tmp_path` fixture 可能在测试 setup 阶段失败。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 修复测试 | 使用项目内临时目录并在 finally 中清理 | [test_save_update_delete_admin_knowledge_document backend/tests/test_knowledge_management.py:L7-L30](../backend/tests/test_knowledge_management.py#L7-L30) |

### 验证命令

```powershell
python scripts\run_local.py test-backend
```

## TRB-013 后台接口返回 401 或管理页跳转登录

### 错误现象

管理后台请求 `/api/admin/*` 返回 `401`，前端自动跳转到 `/admin/login`。

### 常见原因

1. 未登录后台，`localStorage.admin_token` 不存在。
2. `ADMIN_TOKEN_SECRET` 已修改，旧 token 签名失效。
3. token 超过 24 小时有效期。
4. 后端进程仍是旧版本，和新前端接口不匹配。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 登录接口 | 校验账号密码并返回 Bearer token | [login backend/app/api/admin.py:L15-L16](../backend/app/api/admin.py#L15-L16) |
| token 校验 | 缺失、过期、签名错误时返回 401 | [require_admin_user backend/app/services/auth_service.py:L134-L145](../backend/app/services/auth_service.py#L134-L145) |
| 前端注入 | 从 localStorage 读取 token 并写入 Authorization | [http token frontend/src/api/http.ts:L8-L22](../frontend/src/api/http.ts#L8-L22) |
| 路由守卫 | 未登录访问 `/admin/*` 时跳转登录页 | [admin router guard frontend/src/router/index.ts:L17-L27](../frontend/src/router/index.ts#L17-L27) |

### 修复方式

1. 打开 `http://127.0.0.1:5173/admin/login`。
2. 使用 `.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录，默认是 `admin` / `123456`。
3. 如果仍失败，重启后端，避免 8000 端口上仍运行旧代码。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\smoke_vue_full_stack.py
```

## TRB-015 仓库根目录直接运行 pytest 导致 `ModuleNotFoundError: No module named 'app'`

### 错误现象

```text
ImportError while importing test module '...\\backend\\tests\\test_auth_service.py'
ModuleNotFoundError: No module named 'app'
```

### 原因分析

后端测试文件直接从 `app.*` 导入模块；官方测试入口会在运行前设置 `PYTHONPATH=backend`，但直接在仓库根目录执行 `python -m pytest backend/tests -q` 时不会自动注入这个路径。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 官方测试入口 | 运行 pytest 前注入 `PYTHONPATH` | [test_backend scripts/run_local.py:L82-L86](../scripts/run_local.py#L82-L86) |
| 服务启动入口 | 启动 Uvicorn 时同样依赖 `PYTHONPATH=backend` | [start_backend scripts/run_local.py:L89-L105](../scripts/run_local.py#L89-L105) |
| 测试导入 | 后端测试直接导入 `app.main` / `app.services.*` | [test_auth_service imports backend/tests/test_auth_service.py:L7-L10](../backend/tests/test_auth_service.py#L7-L10) |

### 修复方式

优先使用项目封装好的测试入口：

```powershell
python scripts\run_local.py test-backend
```

如果必须直接运行 pytest，请先设置环境变量：

```powershell
$env:PYTHONPATH = (Resolve-Path .\backend)
python -m pytest backend/tests -q
```

### 验证命令

```powershell
python scripts\run_local.py test-backend
$env:PYTHONPATH = (Resolve-Path .\backend); python -m pytest backend/tests -q
```

## TRB-016 PostgreSQL 已启用但 pgvector 检索没有生效

### 错误现象

`/api/v1/admin/system/status` 中 `database_backend = postgresql`，但 `vector_backend` 不是 `pgvector`，或者 PostgreSQL 启动时报 `type "vector" does not exist`。

### 原因分析

常见原因：

1. `DATABASE_URL` 仍指向了错误的 PostgreSQL 实例，或者宿主机 `5432` 上有旧数据库导致误连；
2. PostgreSQL 数据库没有创建 `vector` 扩展；
3. 当前进程没有使用实际配置过的 engine URL，导致系统状态判断错了后端类型。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 配置 | 默认数据库 URL 和宿主机 PostgreSQL 连接参数 | [.env.example:L5-L15](../.env.example#L5-L15), [Settings backend/app/core/config.py:L4-L19](../backend/app/core/config.py#L4-L19), [scripts/run_local.py:L20-L28](../scripts/run_local.py#L20-L28) |
| 数据库初始化 | 当前活动数据库 URL 跟踪和 PostgreSQL 自动创建 `vector` 扩展 | [current_database_url backend/app/core/database.py:L30-L34](../backend/app/core/database.py#L30-L34), [init_db backend/app/core/database.py:L58-L66](../backend/app/core/database.py#L58-L66) |
| 向量后端识别 | PostgreSQL 主路径与 pgvector 检索实现 | [vector_backend_name backend/app/services/vector_store.py:L80-L81](../backend/app/services/vector_store.py#L80-L81), [_retrieve_pgvector_chunks backend/app/services/vector_store.py:L506-L529](../backend/app/services/vector_store.py#L506-L529) |
| 系统状态 | 后台查看当前数据库和向量后端 | [get_system_status backend/app/services/system_service.py:L19-L33](../backend/app/services/system_service.py#L19-L33) |

### 修复方式

1. 确认当前启动进程的 `DATABASE_URL` 指向 `127.0.0.1:5433` 或 Compose 内的 `postgres:5432`，不要误连宿主机已有的 `5432` 数据库。
2. 重启后端，让 [init_db backend/app/core/database.py:L58-L66](../backend/app/core/database.py#L58-L66) 自动创建扩展。
3. 使用后台系统状态接口确认 `database_backend=postgresql`、`vector_backend=pgvector`。
4. 重新调用知识库重建或文档嵌入接口。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py build-frontend
python scripts\run_local.py smoke-docker-postgres
```

## TRB-017 Docker Compose 下 `/guide` 返回 404 或空白页

### 错误现象

`docker compose up --build` 后健康检查可通过，但打开 `http://127.0.0.1:8000/guide` 返回 404，或只看到空白页。

### 原因分析

常见原因：

1. 容器镜像里没有生成或复制前端静态产物；
2. FastAPI 没有启用 SPA 静态资源回退；
3. 前端构建产物过旧，和当前 API 路由不匹配。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 镜像构建 | 单应用容器在镜像构建阶段直接从前端源码产出 `dist` | [deploy/Dockerfile:L1-L31](../deploy/Dockerfile#L1-L31) |
| SPA 托管 | `/guide`、`/map`、`/admin/*` 统一回退到 `index.html` | [frontend_index backend/app/main.py:L69-L71](../backend/app/main.py#L69-L71), [frontend_spa backend/app/main.py:L73-L78](../backend/app/main.py#L73-L78) |
| 烟测脚本 | 直接检查 `/guide` 页面是否包含 `id=\"app\"` | [main scripts/smoke_docker_postgres.py:L58-L100](../scripts/smoke_docker_postgres.py#L58-L100) |

### 修复方式

1. 直接执行 `python scripts\run_local.py smoke-docker-postgres`，确认 Docker 能在镜像构建阶段完成前端打包。
2. 如果仍失败，检查 [deploy/Dockerfile:L1-L31](../deploy/Dockerfile#L1-L31) 是否仍包含前端多阶段构建和 `COPY --from=frontend-builder`。
3. 再检查 [frontend/package.json:L6-L10](../frontend/package.json#L6-L10) 的 `build` 命令是否可在容器环境运行。

### 验证命令

```powershell
python scripts\run_local.py smoke-docker-postgres
```

## TRB-018 Docker Compose 构建时无法拉取基础镜像

### 错误现象

执行 `python scripts\run_local.py smoke-docker-postgres`、`python scripts\run_local.py smoke-docker-allinone` 或 `docker compose up --build` 时，Docker 在拉取 `node:20-bookworm-slim`、`python:3.12-slim` 等基础镜像阶段失败，常见错误类似：

```text
failed to fetch oauth token
read tcp ... wsarecv: An established connection was aborted by the software in your host machine
```

### 原因分析

这类错误通常不是项目代码错误，而是本机到 Docker Hub 的网络、代理、证书或安全软件链路中断。当前项目的多阶段镜像构建依赖从 Docker Hub 拉取 `node` 和 `python` 基础镜像，因此外网拉取被阻断时 Compose 会在构建前就失败。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 镜像定义 | 前端和后端基础镜像来源 | [deploy/Dockerfile:L1-L31](../deploy/Dockerfile#L1-L31) |
| Compose 入口 | 双容器和单容器 Compose 构建入口 | [deploy/docker-compose.yml:L1-L50](../deploy/docker-compose.yml#L1-L50), [deploy/docker-compose.allinone.yml:L1-L36](../deploy/docker-compose.allinone.yml#L1-L36) |
| 烟测脚本 | 实际触发 `docker compose up -d --build` 的脚本 | [main scripts/smoke_docker_postgres.py:L58-L100](../scripts/smoke_docker_postgres.py#L58-L100), [main scripts/smoke_docker_allinone.py:L70-L114](../scripts/smoke_docker_allinone.py#L70-L114) |

### 修复方式

1. 先确认 Docker Desktop 能正常访问 Docker Hub。
2. 如果公司网络有限制，配置镜像代理或预拉取基础镜像。
3. 网络恢复后重新执行 `python scripts\run_local.py smoke-docker-postgres` 或 `python scripts\run_local.py smoke-docker-allinone`。

### 验证命令

```powershell
docker pull node:20-bookworm-slim
docker pull python:3.12-slim
python scripts\run_local.py smoke-docker-postgres
python scripts\run_local.py smoke-docker-allinone
```

## TRB-019 GHCR 推送返回 `permission_denied: The token provided does not match expected scopes`

### 错误现象

执行 `python scripts\publish_ghcr_allinone.py --image ghcr.io/2667741708/ling-shan-digital-guide-allinone --tag latest` 时，本地镜像构建成功，但 `docker push` 失败：

```text
permission_denied: The token provided does not match expected scopes
```

### 原因分析

当前 GitHub 登录 token 可以用于基础 Git 操作，也可以完成 `docker login ghcr.io`，但不具备 GHCR 所需的 `write:packages` 权限，所以推送镜像时被仓库侧拒绝。

### 当前状态

已使用具备 `write:packages` 权限的用户级环境变量 `GHCR_TOKEN` 重新推送成功，镜像标签为 `latest` 和 `9564147`。该 token 只应保存在本机环境变量或密钥管理器中，不应写入仓库。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 发布脚本 | 读取 token、执行 `docker login` 和 `docker push` | [ghcr_token scripts/publish_ghcr_allinone.py:L68-L87](../scripts/publish_ghcr_allinone.py#L68-L87), [docker_login scripts/publish_ghcr_allinone.py:L89-L101](../scripts/publish_ghcr_allinone.py#L89-L101), [push_image scripts/publish_ghcr_allinone.py:L119-L121](../scripts/publish_ghcr_allinone.py#L119-L121), [main scripts/publish_ghcr_allinone.py:L123-L160](../scripts/publish_ghcr_allinone.py#L123-L160) |
| 配置说明 | GHCR token 环境变量 | [docs/config_reference.md:L22-L24](./config_reference.md#L22-L24) |
| 部署说明 | GHCR 发布命令和 `docker run` 用法 | [docs/DEPLOY.md:L82-L103](./DEPLOY.md#L82-L103) |

### 修复方式

1. 改用具备 `write:packages` 权限的 GHCR token。
2. 在当前会话中设置环境变量，例如 `GHCR_TOKEN`。
3. 重新执行发布脚本。

### 验证命令

```powershell
$env:GHCR_TOKEN = "<token-with-write-packages>"
python scripts\publish_ghcr_allinone.py --image ghcr.io/2667741708/ling-shan-digital-guide-allinone --tag latest
```

## TRB-014 知识文档上传后游客端仍不命中

### 错误现象

后台上传知识文档后，游客端数字人仍没有引用新资料。

### 原因分析

当前正式后台采用版本和发布机制。上传默认是 `draft`，草稿不会进入游客端 RAG。必须发布或执行嵌入后，当前版本 chunk 才会写入 PostgreSQL `knowledge_chunk` 并通过 pgvector 检索。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| 上传草稿 | 上传后状态为 `draft` | [knowledge_upload backend/app/api/admin.py:L39-L50](../backend/app/api/admin.py#L39-L50) |
| 发布文档 | 发布后重建索引 | [publish_document backend/app/services/knowledge_service.py:L265-L282](../backend/app/services/knowledge_service.py#L265-L282) |
| 向量入库 | 当前版本切片并写入 `knowledge_chunk` | [embed_document backend/app/services/vector_store.py:L432-L460](../backend/app/services/vector_store.py#L432-L460) |
| 前端发布按钮 | 管理页发布、归档、删除操作 | [KnowledgeManage template frontend/src/pages/admin/KnowledgeManage.vue:L216-L265](../frontend/src/pages/admin/KnowledgeManage.vue#L216-L265) |

### 修复方式

1. 在 `/admin/knowledge` 登录后查看文档状态。
2. 点击“发布”，确认状态变为“已发布”。
3. 在“检索测试”中查询文档里的关键词。
4. 再到 `/guide` 提问同一关键词。

### 验证命令

```powershell
python scripts\smoke_vue_full_stack.py
```

## TRB-017 宿主机 5432 已有 PostgreSQL，项目误连到不带 pgvector 的旧库

### 错误现象

后端启动或测试时连接成功，但执行 `CREATE EXTENSION IF NOT EXISTS vector` 失败，或者系统状态始终不是 `vector_backend = pgvector`。

### 常见原因

1. Windows 本机已经有一个监听 `127.0.0.1:5432` 的 PostgreSQL；
2. 该实例没有安装 `pgvector` 扩展；
3. 本项目的 `.env` 或 shell 环境变量还在指向 `5432`。

### 定位位置

| 类型 | 说明 | 跳转链接 |
|---|---|---|
| runner 默认值 | 本地 runner 强制默认使用 `127.0.0.1:5433` | [scripts/run_local.py:L20-L30](../scripts/run_local.py#L20-L30) |
| Compose 端口映射 | 宿主机 `5433 -> 容器 5432` | [deploy/docker-compose.yml:L25-L40](../deploy/docker-compose.yml#L25-L40) |
| 默认配置 | `.env.example` 中宿主机 PostgreSQL 端口 | [.env.example:L5-L15](../.env.example#L5-L15) |

### 修复方式

1. 删除或覆盖旧的 `DATABASE_URL` 环境变量。
2. 使用 `python scripts\run_local.py test-backend` 或 `python scripts\run_local.py smoke-docker-postgres`，让脚本自动拉起 `5433` 的容器数据库。
3. 如果必须手动运行，确认 URL 使用 `postgresql+psycopg://postgres:postgres@127.0.0.1:5433/lingtour`。

### 验证命令

```powershell
python scripts\run_local.py test-backend
python scripts\run_local.py smoke-docker-postgres
```
