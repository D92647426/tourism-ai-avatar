# 景区数字人课设入组手册（可直接转发）

仓库：https://github.com/D92647426/whale-tour-course
组长 GitHub：D92647426
适用对象：另外两位组员，以及协助他们的 AI。
更新时间：2026-10-19。

## 一、你只需要先做两件事

1. 登录你自己的 GitHub 账号，把账号用户名发给组长。用户名是个人主页 github.com/ 后面的账号路径，不一定等于昵称。
2. 接受组长发来的仓库邀请，再让自己的 AI 按下面的提示词操作。

仓库是私有的，没有邀请时打开链接可能显示 404。组员的 AI 可以检查环境和辅助入组，但访问权限仍由仓库所有者邀请授权。

## 二、发给你自己的 AI

复制以下整段提示词，或把单独的“AI 入组提示词.txt”附件发给 AI：

```text
请帮我加入并跑通我们三个人的景区数字人课设项目。

团队仓库：
https://github.com/D92647426/whale-tour-course
仓库所有者：D92647426
仓库目前是私有仓库。小组最终创意尚未定案，请不要擅自把某个候选方案当成已确认需求。

请按以下顺序实际操作：

1. 检查 Git、GitHub 登录状态，以及 Docker、Python、Node.js 环境。使用我自己的 GitHub 账号，明确告诉我当前账号名；不要把本机 git user.name 当成已经验证的 GitHub 账号。如果缺少必要软件，先说明缺什么以及安装方式。
2. 先检查我是否有仓库访问权限。私有仓库没接受邀请时可能显示 404，不能据此判断仓库不存在。如果无权限，请整理一句“请仓库所有者 D92647426 邀请 GitHub 用户 XXX 加入 whale-tour-course”，让我发给组长，完成邀请后再继续依赖访问权限的步骤。你不能替代组长授权或绕过邀请。
3. 有权限后，将仓库克隆到合适的本地目录。Windows 推荐 D:/Code/whale-tour-course。目录已存在时，先核对 Git 远程与工作区状态，保留未提交改动，不覆盖已有项目。
4. 阅读 README.md、CONTRIBUTING.md、docs/team_setup.md 和 AGENTS.md。向我确认本仓库专用的 Git 姓名与邮箱，使用 git config --local 配置；使用我自己的身份，不复制组长的身份。不要修改我的全局 Git 配置。
5. 根据项目上手指南安装依赖并启动。只有在 .env 不存在时才从 .env.example 复制；保留原有配置。API Key 通过本地配置保存，不输出、不上传。没有 Key 时先用降级模式跑通。
6. 实际验证能打开游客导览页，告诉我可访问的本地地址。失败时给出已核实的原因和下一步，不将“启动过命令”当成运行成功。
7. 带我查看 GitHub Issues 的起步任务。先讨论我负责的内容，再挑一项有实际作用的小任务；不要为了制造提交改无意义内容。
8. 确定任务后，从最新 main 建立自己的工作分支；由 AI 建立时可以使用 codex/onboarding-我的GitHub用户名。完成相应修改与必要检查后创建 PR，目标 main，关联任务并说明效果和验证情况。不要替团队擅自合并 PR，不向 main 强推。
9. 最后报告：我的账号、权限情况、本地目录、启动地址、已完成事项、分支/提交/PR 链接，以及需要组长处理的事项。

不要让我提供或发送 GitHub 密码、Token、API Key。遇到登录或二次验证，请让我在官方页面自行完成；不要把凭据写进源码、对话输出或 Git 历史。
```

## 三、组长怎样邀请

组长打开：
https://github.com/D92647426/whale-tour-course/settings/access

在仓库 Settings → Collaborators 中添加组员的 GitHub 用户名。普通协作选择 Write 权限即可，组员接受邀请后可以推送自己的分支并提交 PR。各自保留自己的账号、提交身份与评审记录。

也可以等两位组员把用户名发回后，请组长的 AI 邀请准确的账号。第一次查无权限的组员，可以先让 AI 检查本机软件并阅读本手册，稍后再接受邀请与克隆。

## 四、第一次启动的最短路径

接受邀请并安装 Git、Docker Desktop 后：

```powershell
git clone https://github.com/D92647426/whale-tour-course.git
cd whale-tour-course
Copy-Item .env.example .env
docker compose -f deploy/docker-compose.yml up --build
```

打开：http://127.0.0.1:8000/guide

如已有 .env，请保留现有文件。默认本机开发管理员为 admin / 123456；模型 Key 为空时先使用本地降级问答。前端热更新和后端开发步骤见克隆后的 docs/team_setup.md。

## 五、日常协作

Issue 写目标 → 同步 main → 各自任务分支 → 有意义的小步提交 → Pull Request → 另一人评审 → 合并。

起步任务：
- https://github.com/D92647426/whale-tour-course/issues/1 ：确定创意与分工。
- https://github.com/D92647426/whale-tour-course/issues/2 ：每位成员跑通项目并完成一次 PR。
- https://github.com/D92647426/whale-tour-course/issues/3 ：梳理上游复用与本组新增贡献。

源码是已有开源项目加上本地 Demo 改动的快照。具体来源见 UPSTREAM.md。课设主创意尚未正式确认，讨论稿见 docs/creative_directions.md。
