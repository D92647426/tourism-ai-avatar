# CLI 使用说明

本文档记录项目可复现运行命令。涉及服务启动、测试、Docker 和发布时，优先使用这些脚本，而不是手工拼接不可复现命令。

## 1. 本地 Runner

主入口：

```powershell
python scripts\run_local.py --help
```

实现位置：

[run_local main scripts/run_local.py:L204-L254](../scripts/run_local.py#L204-L254)

支持命令：

```text
check-env
install-backend
install-frontend
build-frontend
build-kb
test-backend
serve-backend
smoke-backend
smoke-docker-postgres
smoke-docker-allinone
all
```

## 2. 常用开发命令

| 目标 | 命令 | 说明 |
|---|---|---|
| 检查环境 | `python scripts\run_local.py check-env` | 检查 Python、Node、Docker 等基础依赖 |
| 安装后端依赖 | `python scripts\run_local.py install-backend` | 安装 FastAPI/SQLAlchemy 等后端依赖 |
| 安装前端依赖 | `python scripts\run_local.py install-frontend` | 执行前端 npm 安装 |
| 构建前端 | `python scripts\run_local.py build-frontend` | 执行 Vue 类型检查和 Vite build |
| 构建知识库 | `python scripts\run_local.py build-kb` | 生成/刷新 PostgreSQL 知识库 chunk |
| 后端测试 | `python scripts\run_local.py test-backend` | 自动拉起 PostgreSQL 后运行 pytest |
| 启动后端 | `python scripts\run_local.py serve-backend` | 启动 FastAPI 服务 |
| 后端烟测 | `python scripts\run_local.py smoke-backend` | 验证登录、知识库、RAG 和问答链路 |

## 3. 前后端联调

推荐命令：

```powershell
python scripts\dev_vue_full_stack.py
```

实现位置：

[dev_vue_full_stack main scripts/dev_vue_full_stack.py:L52-L95](../scripts/dev_vue_full_stack.py#L52-L95)

访问地址：

```text
游客导览：http://127.0.0.1:5173/guide
灵山地图：http://127.0.0.1:5173/map
管理后台：http://127.0.0.1:5173/admin
后端健康：http://127.0.0.1:8000/api/v1/health
```

## 4. Docker 命令

Compose 双容器：

```powershell
docker compose -f deploy/docker-compose.yml up --build
```

验证命令：

```powershell
python scripts\run_local.py smoke-docker-postgres
```

实现位置：

[smoke_docker_postgres scripts/smoke_docker_postgres.py:L58-L99](../scripts/smoke_docker_postgres.py#L58-L99)

All-in-One 单容器：

```powershell
docker compose -f deploy/docker-compose.allinone.yml up --build
```

验证命令：

```powershell
python scripts\run_local.py smoke-docker-allinone
```

实现位置：

[smoke_docker_allinone scripts/smoke_docker_allinone.py:L70-L114](../scripts/smoke_docker_allinone.py#L70-L114)

## 5. GHCR 发布

查看参数：

```powershell
python scripts\publish_ghcr_allinone.py --help
```

本地构建但不推送：

```powershell
python scripts\publish_ghcr_allinone.py --no-push --tag latest
```

真实推送需要本机环境变量中存在有效 `GHCR_TOKEN`，不要把 token 写入仓库文件。

发布脚本：

[publish_ghcr_allinone main scripts/publish_ghcr_allinone.py:L123-L160](../scripts/publish_ghcr_allinone.py#L123-L160)

## 6. GitHub 发布脚本

查看参数：

```powershell
python scripts\publish_github.py --help
```

脚本会检查工作区是否干净，再配置远程和推送分支/tag。

实现位置：

[publish_github main scripts/publish_github.py:L56-L84](../scripts/publish_github.py#L56-L84)

## 7. 文档链接检查

```powershell
python scripts\check_doc_links.py
```

用途：检查 Markdown 中的相对链接和行号链接是否可解析。

相关测试记录：

[TEST-023 docs/test_reference.md:L267-L276](./test_reference.md#L267-L276)

## 8. 常见失败入口

| 现象 | 先看文档 |
|---|---|
| npm install/build 失败 | [TRB-001 docs/troubleshooting.md:L1-L34](./troubleshooting.md#L1-L34) |
| PostgreSQL 连接失败 | [TRB-013 docs/troubleshooting.md:L256-L277](./troubleshooting.md#L256-L277) |
| pgvector/RAG 检索异常 | [TRB-014 docs/troubleshooting.md:L279-L302](./troubleshooting.md#L279-L302) |
| Playwright 下载失败 | [TEST-010 docs/test_reference.md:L87-L97](./test_reference.md#L87-L97) |
