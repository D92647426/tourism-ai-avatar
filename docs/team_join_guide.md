# 景区数字人课设入组手册（Java 基线）

仓库：https://github.com/D92647426/tourism-ai-avatar
所有者：D92647426
更新时间：2026-10-19

## 当前版本

仓库已按组长要求换成老师压缩包中的 Java/Spring Boot 项目，网页用 HTML/JS 和 Live2D，另有 Android 源码。原 Python/Vue Demo 已保存在 Git 标签中，日常开发使用当前 main。

## 第一次加入

1. 把自己的 GitHub 用户名发给组长。
2. 组长在仓库 Settings → Collaborators 邀请；你接受邀请。
3. 把下方提示词发给自己的 AI，让其检查环境、克隆、启动和指导首个 PR。

私有仓库未邀请前可能显示 404。AI 可以先准备环境，但仓库权限仍由所有者授权。

## 给 AI 的提示词

```text
请帮我加入并运行我们三个人的景区数字人课设。

仓库：https://github.com/D92647426/tourism-ai-avatar
所有者：D92647426；这是私有仓库。
当前主代码已换成老师提供的 Java/Spring Boot + HTML/JS + Live2D 项目，另有 android 源码。旧 Python/Vue 版本只在 baseline-lingtour-20261019 标签中。课设主创意尚未定案。

请实际操作：
1. 确认我自己的 GitHub 用户名和仓库访问权限。没有权限时，请整理一句“请邀请 GitHub 用户 XXX 加入 tourism-ai-avatar”，让我发给组长。组长邀请且我接受后再克隆；不要绕过权限，也不要将私有仓库 404 当作仓库不存在。
2. 检查 Git、JDK（推荐 17）、Maven；Android 开发另外检查 Android Studio、SDK 34 与 Gradle 8.4。网页不需要 Node.js、Python 后端、PostgreSQL 或 Docker。Python 仅用于可选检查脚本。
3. 克隆到合适位置，Windows 推荐 D:/Code/旅游AI数字人/tourism-ai-avatar。已有目录时先检查远程和未提交改动，不覆盖个人工作。
4. 阅读 README.md、CONTRIBUTING.md、docs/team_setup.md、AGENTS.md。向我确认本仓库专用的 Git 姓名/邮箱，用 git config --local 设置，不复制组长身份，不改全局配置。
5. 在根目录执行 mvn clean package，然后 java -jar target/ai-guide-1.0.0.jar；或者用 IDEA 打开 pom.xml、运行 com.guide.GuideApplication。实际检查 http://localhost:8080/ 可以访问。
6. 模型 Key 默认为空，先跑通降级模式。真实模型使用本机 DEEPSEEK_API_KEY 环境变量；Spring Boot 不自动读普通 .env。不要索取或输出我的 Token、Key、密码。登录与二次验证让我在官方页面自行完成。
7. 参考 GitHub Issues 的起步任务，先讨论我负责什么，选择一项有实际用途的小改动。确定后从最新 main 建任务分支，AI 可用 codex/onboarding-我的GitHub用户名。
8. 运行相应 Maven 构建与检查，有 Python 时运行文档检查和 JAR 启动接口检查。提交 PR、关联 Issue，附效果和验证。不要擅自替团队合并或向 main 强推。
9. 汇报我的账号/权限、本地目录、启动地址、分支/提交/PR、阻塞原因及需组长处理的事项。没有实际跑通时不要声称成功。
```

## 组长邀请入口

https://github.com/D92647426/tourism-ai-avatar/settings/access

按用户名邀请，普通协作使用 Write 权限。每个人使用自己的账号、提交身份和评审记录。

## 最短启动流程

安装 Git、JDK 17 和 Maven，接受邀请后：

```bash
git clone https://github.com/D92647426/tourism-ai-avatar.git
cd tourism-ai-avatar
mvn clean package
java -jar target/ai-guide-1.0.0.jar
```

打开 http://localhost:8080/ 。也可在 IDEA 中打开 pom.xml 并运行应用入口。

## 日常流程

Issue 写目标 → 同步 main → 任务分支 → 有意义的小步提交 → Pull Request → 另一人评审 → 合并。

起步任务：
- https://github.com/D92647426/tourism-ai-avatar/issues/1 ：确定创意与分工。
- https://github.com/D92647426/tourism-ai-avatar/issues/2 ：成员跑通当前 Java 基线并完成第一次 PR。
- https://github.com/D92647426/tourism-ai-avatar/issues/3 ：区分老师源码、旧原型和本组新增贡献。

详细说明见克隆后的 README.md、docs/team_setup.md 和 UPSTREAM.md。
