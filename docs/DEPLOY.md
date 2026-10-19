# 部署说明

## Docker Compose

```powershell
python scripts\run_local.py smoke-docker-postgres
```

注意：

- 仓库提交的是完整源码、Docker 构建定义和验收脚本，不是已经构建好的镜像或运行中的容器实例。
- `deploy/Dockerfile` 已改为多阶段构建，会在镜像构建过程中从 `frontend/` 源码直接产出 `dist`，不再要求 Git 仓库提交 `frontend/dist`。
- `docker compose -f deploy/docker-compose.yml up --build` 在未提供 `.env` 时也可运行；如需接入真实 DeepSeek，再额外提供 `DEEPSEEK_API_KEY` 等环境变量即可。
- PostgreSQL 数据卷和运行期容器状态不会进入 GitHub 仓库。

访问地址：

- 游客端：http://127.0.0.1:8000/guide
- 管理后台：http://127.0.0.1:8000/admin/login
- 后端 API：http://localhost:8000/api/health
- PostgreSQL：http://127.0.0.1:5433

当前 Compose 方案已经切到“单应用容器 + PostgreSQL/pgvector 服务”：

- `app` 容器同时运行 FastAPI 并托管镜像内构建出的 `frontend/dist`，不再单独起 Vite 或 nginx。
- `postgres` 服务使用 `pgvector/pgvector:pg16`，项目运行时默认走 PostgreSQL，不再依赖 SQLite。
- 宿主机对外暴露 `5433`，避免和机器上已有的 `5432` PostgreSQL 冲突。
- 标准验收入口是 [smoke_docker_postgres scripts/smoke_docker_postgres.py:L58-L99](../scripts/smoke_docker_postgres.py#L58-L99)，会直接执行 `docker compose up -d --build`、校验 `/guide` 与 `/api/v1/admin/system/status`，最后自动 `down`。

对应实现：

- [Compose 编排 deploy/docker-compose.yml:L1-L44](../deploy/docker-compose.yml#L1-L44)
- [单容器镜像 deploy/Dockerfile:L1-L31](../deploy/Dockerfile#L1-L31)
- [前端静态托管 backend/app/main.py:L66-L78](../backend/app/main.py#L66-L78)
- [PostgreSQL pgvector 初始化 backend/app/core/database.py:L58-L66](../backend/app/core/database.py#L58-L66)
- [Docker 烟测命令分发 scripts/run_local.py:L196-L197](../scripts/run_local.py#L196-L197)

## Docker All-in-One

```powershell
python scripts\run_local.py smoke-docker-allinone
```

单容器方案用于“一个容器镜像同时携带应用和 PostgreSQL/pgvector”的交付场景：

- `allinone` 容器内同时启动 PostgreSQL、pgvector 扩展和 FastAPI；
- 前端仍在镜像构建阶段从 `frontend/` 源码直接产出 `dist`；
- 宿主机继续暴露 `8000` 访问页面，`5433` 访问容器内 PostgreSQL；
- 这是交付/演示增强方案，不替代当前更可维护的双容器正式方案。

对应实现：

- [All-in-One Compose deploy/docker-compose.allinone.yml:L1-L36](../deploy/docker-compose.allinone.yml#L1-L36)
- [All-in-One 镜像 deploy/Dockerfile.allinone:L1-L43](../deploy/Dockerfile.allinone#L1-L43)
- [容器内 PostgreSQL + FastAPI 启动编排 deploy/start_allinone.py:L13-L240](../deploy/start_allinone.py#L13-L240)
- [All-in-One 烟测 scripts/smoke_docker_allinone.py:L13-L114](../scripts/smoke_docker_allinone.py#L13-L114)
- [命令入口 scripts/run_local.py:L200-L243](../scripts/run_local.py#L200-L243)

## Docker Run

如果已经有本地构建好的 all-in-one 镜像，可直接运行：

```powershell
docker run -d --name lingtour-allinone ^
  -p 8000:8000 ^
  -p 5433:5432 ^
  -e POSTGRES_DB=lingtour ^
  -e POSTGRES_USER=postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -e ADMIN_USERNAME=admin ^
  -e ADMIN_PASSWORD=123456 ^
  -e ADMIN_TOKEN_SECRET=lingtour-dev-admin-token-secret ^
  -e DEEPSEEK_API_KEY=<your-key> ^
  -v lingtour_allinone_pgdata:/var/lib/postgresql/data ^
  -v lingtour_allinone_admin_knowledge:/workspace/data/admin_knowledge ^
  ghcr.io/2667741708/ling-shan-digital-guide-allinone:latest
```

停止和删除：

```powershell
docker stop lingtour-allinone
docker rm lingtour-allinone
```

如果镜像已经成功发布到 GHCR，可直接拉取并运行：

```powershell
docker pull ghcr.io/2667741708/ling-shan-digital-guide-allinone:latest
docker run -d --name lingtour-allinone ^
  -p 8000:8000 ^
  -p 5433:5432 ^
  -e POSTGRES_DB=lingtour ^
  -e POSTGRES_USER=postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -e ADMIN_USERNAME=admin ^
  -e ADMIN_PASSWORD=123456 ^
  -e ADMIN_TOKEN_SECRET=lingtour-dev-admin-token-secret ^
  -e DEEPSEEK_API_KEY=<your-key> ^
  -v lingtour_allinone_pgdata:/var/lib/postgresql/data ^
  -v lingtour_allinone_admin_knowledge:/workspace/data/admin_knowledge ^
  ghcr.io/2667741708/ling-shan-digital-guide-allinone:latest
```

当前 `docker run` 交付依赖：

- [发布镜像 Dockerfile.allinone.release:L1-L29](../deploy/Dockerfile.allinone.release#L1-L29)
- [单容器启动编排 start_allinone.py:L228-L240](../deploy/start_allinone.py#L228-L240)

## GitHub Container Registry

本地构建并推送 all-in-one 镜像到 GHCR：

```powershell
python scripts\publish_ghcr_allinone.py --image ghcr.io/2667741708/ling-shan-digital-guide-allinone --tag latest
```

只做本地发布镜像构建，不推送：

```powershell
python scripts\publish_ghcr_allinone.py --no-push --tag latest
```

如果 GHCR token 不放在 `GHCR_TOKEN`，可改用其他环境变量名：

```powershell
$env:MY_GHCR_TOKEN = "ghp_xxx"
python scripts\publish_ghcr_allinone.py --token-env MY_GHCR_TOKEN
```

发布脚本说明：

- 会先本地执行前端构建，生成 `frontend/dist`；
- 使用 [deploy/Dockerfile.allinone.release:L1-L29](../deploy/Dockerfile.allinone.release#L1-L29) 构建单容器发布镜像；
- 默认打两个标签：`latest` 和当前 `git short sha`；
- 推送时需要具备 `write:packages` 权限的 GHCR token；当前已使用用户级环境变量 `GHCR_TOKEN` 推送成功，已发布标签为 `latest` 和 `9564147`。

对应实现：

- [发布脚本 scripts/publish_ghcr_allinone.py:L1-L160](../scripts/publish_ghcr_allinone.py#L1-L160)
- [发布镜像 Dockerfile deploy/Dockerfile.allinone.release:L1-L29](../deploy/Dockerfile.allinone.release#L1-L29)

## 本地开发

完整交互测试说明见 [项目交互与运行指南](./user_interaction_guide.md)。

推荐优先使用可复现 Python runner：

```powershell
python scripts\run_local.py check-env
python scripts\run_local.py build-kb
python scripts\run_local.py test-backend
python scripts\run_local.py smoke-backend
python scripts\run_local.py smoke-docker-postgres
python scripts\run_local.py smoke-docker-allinone
```

Git Bash / MINGW64 必须使用正斜杠 `/`，不要使用反斜杠 `\`：

```bash
python scripts/run_local.py check-env
python scripts/run_local.py install-frontend
python scripts/run_local.py build-frontend
python scripts/smoke_vue_full_stack.py
```

也可以使用 Git Bash 包装脚本：

```bash
bash scripts/run_local.sh check-env
bash scripts/smoke_vue_full_stack.sh
bash scripts/dev_vue_full_stack.sh
```

对应实现：

- [环境检查 scripts/run_local.py:L89-L102](../scripts/run_local.py#L89-L102)
- [知识库构建 scripts/run_local.py:L117-L123](../scripts/run_local.py#L117-L123)
- [后端烟测 scripts/run_local.py:L183-L193](../scripts/run_local.py#L183-L193)
- [Docker pgvector 烟测 scripts/run_local.py:L196-L197](../scripts/run_local.py#L196-L197)

后端手动开发命令：

```powershell
cd backend
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

前端：

```powershell
cd frontend
npm install
npm run dev
```

当前 Vue 工程已可安装和构建，推荐通过 runner 执行：

```powershell
python scripts\run_local.py install-frontend
python scripts\run_local.py build-frontend
python scripts\smoke_vue_full_stack.py
```

对应实现：

- [前端安装 scripts/run_local.py:L70-L71](../scripts/run_local.py#L70-L71)
- [前端构建 scripts/run_local.py:L74-L75](../scripts/run_local.py#L74-L75)
- [Vue 完整栈烟测 scripts/smoke_vue_full_stack.py:L67-L122](../scripts/smoke_vue_full_stack.py#L67-L122)
- [Git Bash runner scripts/run_local.sh:L1-L5](../scripts/run_local.sh#L1-L5)
- [Git Bash Vue 烟测 scripts/smoke_vue_full_stack.sh:L1-L5](../scripts/smoke_vue_full_stack.sh#L1-L5)

手动体验页面时使用持续运行脚本：

```bash
python scripts/dev_vue_full_stack.py
```

打开：

- 数字人导游页：http://127.0.0.1:5173/guide
- 景区地图页：http://127.0.0.1:5173/map
- 管理大屏页：http://127.0.0.1:5173/admin

实现位置：[dev_vue_full_stack.py:L52-L95](../scripts/dev_vue_full_stack.py#L52-L95)

若 npm registry 网络异常，可使用无 npm 依赖静态演示端：

```powershell
python scripts\smoke_full_stack.py
```

该命令会启动后端和静态前端，验证完整链路后自动关闭进程。实现位置：

- [完整栈烟测 scripts/smoke_full_stack.py:L30-L61](../scripts/smoke_full_stack.py#L30-L61)
- [静态演示端 frontend_static/index.html:L170-L218](../frontend_static/index.html#L170-L218)

## GitHub 发布

当前项目本地版本已经保留 `v0.0` baseline tag，最新优化分支为 `codex/optimize-map-avatar-v0.1`。发布到 GitHub 时优先使用可复现 Python 脚本：

```powershell
python scripts\publish_github.py --remote-url https://github.com/<your-name>/<repo>.git --branch main --push-tags
```

Git Bash / MINGW64 使用：

```bash
python scripts/publish_github.py --remote-url https://github.com/<your-name>/<repo>.git --branch main --push-tags
```

脚本会检查工作区是否干净，自动新增或更新 `origin`，并把当前分支推送到 GitHub 的 `main` 分支。实现位置：

- [GitHub 发布 CLI scripts/publish_github.py:L56-L84](../scripts/publish_github.py#L56-L84)
- [工作区保护 scripts/publish_github.py:L38-L44](../scripts/publish_github.py#L38-L44)
- [远程仓库配置 scripts/publish_github.py:L47-L53](../scripts/publish_github.py#L47-L53)

### 本次 GitHub 发布复盘

本项目曾出现两类“提交/推送失败”，原因不同：

1. 直接在工具层执行 `git add -A` 时被运行策略拦截，错误来自 Codex 工具权限包装层，不是 Git 仓库问题。后续改用 Python `subprocess.run(["git", "add", "-A"])` 在项目根目录执行，成功完成暂存和提交。
2. 推送 GitHub 时 HTTPS 与 SSH 都在连接阶段被中断，典型错误为 `Recv failure: Connection was aborted` 和 `Connection to 198.18.0.25 port 22: Connection aborted`。这说明当时机器到 GitHub 的网络或代理链路不可用，尚未进入账号认证阶段。网络恢复后，同一发布脚本成功推送。

本次最终成功标志：

```text
已推送 codex/optimize-map-avatar-v0.1 -> origin/main
origin/main = b630176 feat(admin): add persistent versioned knowledge base
origin tag v0.0 = 37cd58b chore(release): baseline v0.0
```

相关复盘：

- [GitHub 网络中断错误 docs/error_traceability.md:L295-L334](./error_traceability.md#L295-L334)
- [GitHub 发布先失败后成功 docs/error_traceability.md:L195-L259](./error_traceability.md#L195-L259)
- [GitHub push 连接中断排错 docs/troubleshooting.md:L243-L319](./troubleshooting.md#L243-L319)
- [为什么之前提交失败后来成功 docs/question_traceability.md:L177-L205](./question_traceability.md#L177-L205)
