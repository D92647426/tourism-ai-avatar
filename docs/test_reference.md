# 当前检查与验证

## TEST-027 Java 基线导入验收

| 检查 | 命令与预期 |
|---|---|
| Maven 构建 | mvn verify，生成可运行 JAR，并执行现有自动化测试 |
| 页面和接口 | python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar |
| 文档 | python scripts/check_doc_links.py |
| Git | 检查真实 Key、用户数据、构建产物未跟踪，旧基线标签存在 |

启动接口检查使用独立临时数据目录、空模型 Key 和本机地址，验证首页、景点、降级问答、公开配置、匿名管理接口 401、缺少 CSRF 的写请求 403、Live2D 配置与模型文件，退出时只停止自己启动的进程。

实现：[smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)。CI：[checks.yml:L1](../.github/workflows/checks.yml#L1)。

本次不执行 Android APK 构建，也不使用老师的真实模型 Key。

Local verification (2026-10-19): Maven build passed with JDK 19; HTTP smoke passed with 16 spots, offline chat and Live2D resources. Android and real-model calls were not run.

Local verification (2026-10-23): Maven verify passed with JDK 19 and 31 tests; smoke passed with 16 spots and the extended checks
`homepage, spots, csrf_token, public_config, admin_anonymous_401, csrf_missing_rejected, offline_chat, live2d_definition, live2d_model_file, live2d_helper`.

## TEST-029 项目名称与路径一致性

对应 REQ-029。检查本地仓库名、GitHub origin、README 与入组手册一致；网页标题为“旅游 AI 数字人”；执行 Maven verify、文档链接检查和现有 JAR 启动检查。沿用 [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，无需为纯名称替换新增镜像测试。

## TEST-030 管理员登录、接口权限与密码保护（REQ-030 / GitHub #5）

对应 [REQ-030](./requirements_traceability.md)。测试全部使用独立临时数据文件与测试属性，不读取、不改写仓库真实 `data/users.json`，也不调用付费模型。

| 测试类 | 覆盖点 | 数量 |
|---|---|---|
| [SecurityIntegrationTest.java:L54](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L54) | 匿名 401、游客 403、管理员 GET/写成功、退出后会话失效、登录更换 session id、缺/错 CSRF 403、带合法 CSRF 的匿名写管理 401、注册角色注入被忽略、登录/注册/me/users 响应无密码字段、任意 userId 不能改他人兴趣、公开配置匿名可读、公开页面与景点保持可访问 | 15 |
| [UserServiceMigrationTest.java:L33](../src/test/java/com/guide/service/UserServiceMigrationTest.java#L33) | 旧明文迁移先备份、数据字段保留、BCrypt 匹配、文件不再含明文、迁移幂等、损坏/缺凭据时失败且不改原文件、新注册只存哈希、重名、管理员初始化双空/半配置/策略/游客冲突/重复启动不覆盖 | 11 |
| [PasswordPolicyTest.java:L14](../src/test/java/com/guide/security/PasswordPolicyTest.java#L14) | 游客 4 位、管理员 8 位、空密码、长度与 BCrypt 72 字节上限 | 4 |
| [CookieAttributeTest.java:L41](../src/test/java/com/guide/security/CookieAttributeTest.java#L41) | 真实 HTTP 下 XSRF-TOKEN 可读且与响应体一致、JSESSIONID HttpOnly + SameSite=Lax | 1 |

运行命令：

```bash
mvn verify
```

预期：`Tests run: 31, Failures: 0, Errors: 0, Skipped: 0`，并生成 `target/ai-guide-1.0.0.jar`。

失败排查方向：

- CSRF 相关测试若全部 403，确认测试通过真实 `GET /api/auth/csrf` 获取 token（Cookie 双提交），不要用 `with(csrf())`；开发配置使用 `CookieCsrfTokenRepository`，直接注入 request attribute 不生效。
- 若响应中的中文断言失败，确认读取 MockMvc 响应体时按 UTF-8 解码，`getContentAsString()` 默认用 ISO-8859-1 会制造乱码。
- 管理员相关测试失败时，确认测试属性注入了 `APP_ADMIN_USERNAME`/`APP_ADMIN_PASSWORD`，且数据文件路径指向临时目录。

浏览器端建议手工验证（未自动化）：

1. 游客登录后访问 `/admin.html`，应提示无权限；
2. 管理员登录后可读写管理后台，退出后刷新应回到登录入口；
3. 页面 30 分钟无操作后会话过期，管理页应重新要求登录且不产生重定向循环。
