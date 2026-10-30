# 旅游 AI 数字人 · 三人课设

团队仓库：https://github.com/D92647426/tourism-ai-avatar

当前主代码来自老师提供的 **软件杯7.16.rar**，已替换之前的 Python/Vue Demo。旧版本完整保留在 Git 标签 `baseline-lingtour-20261019` 中。

## 技术结构

- Java + Spring Boot 2.7.18，Maven 构建，源码目标 Java 8；团队开发推荐 JDK 17。
- 网页使用 HTML/CSS/JavaScript，随 Spring Boot 一起提供。
- Live2D 展示使用 PIXI 与 Haru 示例模型。
- 景点、知识库、配置等使用 JSON 文件，当前不需要 PostgreSQL。
- `android/` 保留 Kotlin、WebView 和原生语音桥接源码，需另用 Android Studio 配置构建。

## 第一次加入

- [可转发给组员与 AI 的手册](docs/team_join_guide.md#L1)
- [环境与启动指南](docs/team_setup.md#L1)
- [分支、提交与评审](CONTRIBUTING.md#L1)
- [来源和导入处理](UPSTREAM.md#L1)
- [项目结构](docs/architecture.md#L1)

## 启动网页项目

准备 JDK 17 和 Maven，在仓库根目录执行：

```bash
mvn clean package
java -jar target/ai-guide-1.0.0.jar
```

打开：

- 游客页：http://localhost:8080/
- 登录页：http://localhost:8080/login.html
- 管理页：http://localhost:8080/admin.html

也可用 IDEA 打开 `pom.xml`，等待 Maven 同步后运行 `com.guide.GuideApplication`。

未设置 `DEEPSEEK_API_KEY` 时使用本地降级回答。需要真实模型时，在启动终端配置自己的环境变量；不要将 Key 写入源码。Spring Boot 不会自动读取普通 `.env` 文件。

## 管理员入口与本地管理员账号

管理后台 `/admin.html` 需要 ADMIN 身份，登录入口在 `/login.html` 的“管理员登录”链接。默认**不创建**管理员；只有同时设置以下环境变量时，启动阶段才会初始化本地管理员：

```bash
export APP_ADMIN_USERNAME=your-admin-name
export APP_ADMIN_PASSWORD=your-admin-password
mvn spring-boot:run
```

规则：

- 管理员密码至少 8 位；游客密码仍为至少 4 位，已有游客账号不受影响。
- 用户名已被游客占用时启动会明确失败，不会把游客静默提升为管理员。
- 已存在的管理员不会被重复启动覆盖密码。
- 不要提交或打印真实管理员凭据；`data/users.json`、迁移备份与本机日志都不进入 Git。
- 登录后服务端会话默认 30 分钟过期；管理员和游客退出都会使服务端会话失效。

实现见 [SecurityConfig.java:L36](src/main/java/com/guide/config/SecurityConfig.java#L36)、[UserService.java:L59](src/main/java/com/guide/service/UserService.java#L59)。

## 验证

```bash
mvn verify
python scripts/check_doc_links.py
python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar
node --test tests/frontend/*.test.js
```

Python 只用于可选检查脚本与 CI，Node.js 只用于前端行为测试，网页项目运行不依赖 Python、Node.js 或 Docker。当前源码有 41 个 Java 自动化测试（权限边界、CSRF、会话固定、密码迁移/一致性、密码策略、Cookie 属性、真实 HTTP 认证链路）和 27 个前端行为测试（`node:test` + `vm` 直接执行 `static/js` 脚本，覆盖退出/CSRF/兴趣保存/管理员会话切换），分别由 `mvn verify` 与 `node --test` 执行；自动检查同时验证文档链接和本地启动后的页面/接口/模型资源，详见 [测试说明](docs/test_reference.md)。

## 当前边界

知识检索是字符串匹配，推荐路线由预设规则生成，语音主要使用浏览器或 Android 系统能力。Haru 是示例角色，最终角色素材与课设创意尚未定案。Android APK 本次未验证构建；网页已改为服务端会话与 CSRF，但 Android WebView 内 Cookie/CSRF 行为尚未验证，Android 原生代码未改动。

压缩包中的编译产物、个人 IDE 配置、真实接口 Key、历史账号和交互记录未提交。具体处理见 [导入记录](docs/import_manifest.json)。

## 展示设置（#8）

管理员在“数字人形象”中保存名称、首次欢迎语和主题色，游客刷新页面即可看到新设置。后台加载/保存失败会明确提示；已有聊天不会被迟到欢迎语改写。公开配置只读，后台保存仍需管理员会话与 CSRF。声线参数的实际播放消费由 #14 继续处理。

设计、验收和截图见 [展示配置说明:L1](docs/display_config.md#L1)。此功能分支依赖认证PR #15，合并顺序与当前目标分支在PR中说明。
