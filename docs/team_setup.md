# 团队成员第一次加入

对应 REQ-026：三人 GitHub 协作。

## 1. 接受邀请并克隆

所有者在 GitHub 仓库 Settings → Collaborators 邀请另外两人。成员登录自己的账号、接受邀请后克隆私有仓库。

```bash
git clone https://github.com/D92647426/whale-tour-course.git
cd whale-tour-course
git config user.name "自己的名字或常用昵称"
git config user.email "自己 GitHub 确认过的邮箱"
```

可以用 GitHub 隐私邮箱。以上设置只作用于本仓库，提交前用 `git config user.name` 和 `git config user.email` 核对。

Windows 首次 HTTPS 连接按 Git Credential Manager 提示登录 GitHub；密码和 Token 不要发到群里或写进源码。

## 2. 最快启动：Docker

安装 Git 和 Docker Desktop，启动 Docker，在根目录执行：

```powershell
Copy-Item .env.example .env
docker compose -f deploy/docker-compose.yml up --build
```

打开 `http://127.0.0.1:8000/guide`。终端按 Ctrl+C 停止前台服务；之后运行 `docker compose -f deploy/docker-compose.yml down` 停止容器并保留数据卷。

`.env` 是个人配置，不上传。模板模型 Key 为空，未配置时使用降级回答。默认开发管理员 `admin / 123456` 只用于本机。

## 3. 前后端开发

准备 Python 3.12、Node.js 22 和 Docker Desktop，首次在根目录：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
docker compose -f deploy/docker-compose.yml up -d postgres
```

在 `frontend` 目录安装依赖：

```powershell
npm ci
```

回到根目录启动开发服务：

```powershell
.\.venv\Scripts\python.exe scripts/dev_vue_full_stack.py
```

访问 `http://127.0.0.1:5173/guide`，后端为 `http://127.0.0.1:8000`。开发脚本使用默认端口并检查 PostgreSQL。

模型 Key 可通过本机终端环境变量配置。此开发脚本不会自动把根目录 `.env` 的全部字段传给后端进程；需要在所用终端显式设置 `DEEPSEEK_API_KEY`。不要写进代码。

## 4. 本地检查

根目录文档检查：

```powershell
.\.venv\Scripts\python.exe scripts/check_doc_links.py
```

前端目录：

```powershell
npm test
npm run build
```

后端检查在根目录运行，先启动 Docker：

```powershell
.\.venv\Scripts\python.exe scripts/run_local.py test-backend
```

测试会建立独立数据库，使用本机课程数据库执行。

## 5. 分支与贡献记录

遵循 [协作流程 CONTRIBUTING.md:L1](../CONTRIBUTING.md#L1)。约定 `main` 经 PR 和另一人评审合并。私有仓库的强制分支保护取决于账号套餐；支持时再启用，不将流程约定表述为已开启的服务端保护。

来源见 [UPSTREAM.md:L1](../UPSTREAM.md#L1)，原始说明见 [README.upstream.md:L1](../README.upstream.md#L1)。

创意候选见 [creative_directions.md:L1](./creative_directions.md#L1)，尚未共同定案。首次协作从确定范围、每人完成一次小 PR 开始。
