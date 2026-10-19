# 团队成员上手：Java 基线

## 1. 加入并克隆

请所有者 D92647426 在仓库 Settings → Collaborators 邀请你的 GitHub 用户名，接受邀请后：

```bash
git clone https://github.com/D92647426/tourism-ai-avatar.git
cd tourism-ai-avatar
git config user.name "自己的姓名或昵称"
git config user.email "自己 GitHub 确认过的邮箱"
```

已有本仓库时，先保存或提交自己的修改，再切回 main 并拉取。不要将旧 Python/Vue 分支的结构直接覆盖新 Java 基线。

## 2. 软件准备

网页项目需要 JDK（推荐 17）与 Maven。检查：

```bash
java -version
mvn -version
```

Windows 使用 IDEA 时，可打开根目录 pom.xml 并使用 IDEA 的内置 Maven。确保项目 JDK 和 Maven 使用的 JDK 均有效。

## 3. 编译和运行

根目录执行：

```bash
mvn clean package
java -jar target/ai-guide-1.0.0.jar
```

游客页为 http://localhost:8080/，管理页为 http://localhost:8080/admin.html 。

也可在 IDEA 运行 [GuideApplication.java:L1](../src/main/java/com/guide/GuideApplication.java#L1)。启动后 Ctrl+C 退出，不需要 PostgreSQL、Docker 或单独的 npm 服务。

历史用户账号未导入，可通过登录页注册自己的开发账号。当前用户和后台权限沿用老师的演示实现。

## 4. 模型配置

默认 Key 为空，先用降级模式运行。需要模型时，在自己的启动终端设置环境变量：

```powershell
$env:DEEPSEEK_API_KEY = "自己本地填写"
java -jar target/ai-guide-1.0.0.jar
```

不要把真实 Key 放入提交、群聊或 AI 对话输出。Spring Boot 不自动读取普通 .env 文件。具体字段见 [配置说明 config_reference.md:L1](./config_reference.md#L1)。

## 5. 验证与分支

```bash
mvn verify
python scripts/check_doc_links.py
python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar
```

Python 只用于检查脚本。分支、提交、评审见 [CONTRIBUTING.md:L1](../CONTRIBUTING.md#L1)。

## 6. Android

Android Studio 打开 android 目录，使用 JDK 17、Android SDK 34，Gradle 配置为 8.4。源码含 WebView 和原生语音桥接。压缩包仅带 Gradle wrapper 配置，缺少完整 wrapper 启动文件，需在 Android Studio 配置 Gradle。

本次未构建 APK；不要将 Android 本机 local.properties 或 build 目录提交。App 连接手机能访问的后端地址，网页项目应先跑通。

## 7. 来源

当前来源见 [UPSTREAM.md:L1](../UPSTREAM.md#L1)。旧 Python/Vue 版本保存在 Git 标签 baseline-lingtour-20261019。
