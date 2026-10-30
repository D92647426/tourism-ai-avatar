# 当前检查与验证

## TEST-027 Java 基线导入验收

| 检查 | 命令与预期 |
|---|---|
| Maven 构建 | mvn verify，生成可运行 JAR，并执行现有自动化测试 |
| 页面和接口 | python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar |
| 文档 | python scripts/check_doc_links.py |
| 前端行为 | node --test tests/frontend/*.test.js |
| Git | 检查真实 Key、用户数据、构建产物未跟踪，旧基线标签存在 |

启动接口检查使用独立临时数据目录、空模型 Key 和本机地址，验证首页、景点、降级问答、公开配置、匿名管理接口 401、缺少 CSRF 的写请求 403、Live2D 配置与模型文件，退出时只停止自己启动的进程。

实现：[smoke_teacher_project.py:L60](../scripts/smoke_teacher_project.py#L60)。CI：[checks.yml:L1](../.github/workflows/checks.yml#L1)。

本次不执行 Android APK 构建，也不使用老师的真实模型 Key。

Local verification (2026-10-19, 初始基线): Maven build passed with JDK 19; HTTP smoke passed with 16 spots, offline chat and Live2D resources. Android and real-model calls were not run.

Local verification (2026-10-23, self-hosted JDK 19 / Maven 3.9.11): `mvn verify` passed with 41 Java tests；smoke passed with 16 spots and the extended checks
`homepage, spots, csrf_token, public_config, admin_anonymous_401, csrf_missing_rejected, offline_chat, live2d_definition, live2d_model_file, live2d_helper`；`node --test tests/frontend/*.test.js` passed with 27 frontend tests.

## TEST-029 项目名称与路径一致性

对应 REQ-029。检查本地仓库名、GitHub origin、README 与入组手册一致；网页标题为“旅游 AI 数字人”；执行 Maven verify、文档链接检查和现有 JAR 启动检查。沿用 [smoke_teacher_project.py:L60](../scripts/smoke_teacher_project.py#L60)，无需为纯名称替换新增镜像测试。

## TEST-030 管理员登录、接口权限与密码保护（REQ-030 / GitHub #5）

对应 [REQ-030](./requirements_traceability.md) 与 [API-030](./api_reference.md)。测试全部使用独立临时数据文件与测试属性，不读取、不改写仓库真实 `data/users.json`，也不调用付费模型。

| 测试类 | 覆盖点与关键测试函数 | 数量 |
|---|---|---|
| [SecurityIntegrationTest.java:L54](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L54) | 匿名 401（`anonymousAdminGetReturns401`、`anonymousAdminWriteWithValidCsrfReturns401`）、游客 403（`guestAdminGetReturns403`、`guestAdminWriteWithValidCsrfReturns403`）、管理员 GET/写成功（`adminCanReadDashboardAndWriteConfig`）、退出后会话失效（`logoutInvalidatesServerSessionAndSubsequentRequestIs401`）、登录更换 session id（`loginRotatesSessionId`）、缺/错 CSRF 403、注册角色注入被忽略（`registerIgnoresClientSuppliedAdminRole`）、响应无密码字段（`authResponsesNeverExposePasswordFields`、`adminUsersListNeverExposesPasswordFields`）、任意 userId 不能改他人兴趣（`interestUpdateUsesSessionIdentityInsteadOfClientUserId`）、公开配置匿名可读（`publicConfigIsAnonymousReadableWithoutCredentials`） | 15 |
| [UserServiceMigrationTest.java:L33](../src/test/java/com/guide/service/UserServiceMigrationTest.java#L33) | 旧明文迁移先备份、id/username/interest/createdAt 保留、BCrypt 匹配、文件不再含明文或 `password` 键、迁移幂等、损坏/缺凭据时失败且不改原文件、新注册只存哈希、重名、管理员初始化双空/半配置/策略/游客冲突/重复启动不覆盖 | 11 |
| [UserServiceConsistencyTest.java:L38](../src/test/java/com/guide/service/UserServiceConsistencyTest.java#L38) | 内存/落盘一致：`registerRollsBackInMemoryWhenSaveFails`、`bootstrapAdminRollsBackInMemoryWhenSaveFails`、`updateInterestRollsBackWhenSaveFails`、`duplicateIdIsRejectedAndFileIsPreserved`、`duplicateUsernameIsRejectedAndFileIsPreserved`、`nullRootIsRejectedAndFileIsPreserved`、`nullRecordIsRejectedAndFileIsPreserved`、`concurrentRegistrationsAreAllPersisted`、`loadFailureDoesNotLeaveHalfLoadedUsers` | 9 |
| [PasswordPolicyTest.java:L14](../src/test/java/com/guide/security/PasswordPolicyTest.java#L14) | 游客 4 位、管理员 8 位、空密码、长度与 BCrypt 72 字节上限 | 4 |
| [CookieAttributeTest.java:L41](../src/test/java/com/guide/security/CookieAttributeTest.java#L41) | 真实 HTTP 下 XSRF-TOKEN 可读且与响应体一致、JSESSIONID HttpOnly + SameSite=Lax（`csrfCookieIsReadableAndSessionCookieIsHardened`）；cookie+CSRF → 管理员登录 → 管理 GET/写 → 退出 → 旧会话 401 全链路（`realHttpAdminFlowRequiresSessionAndCsrfAndEndsOnLogout`） | 2 |

运行命令：

```bash
mvn verify
```

预期：`Tests run: 41, Failures: 0, Errors: 0, Skipped: 0`，并生成 `target/ai-guide-1.0.0.jar`。

### TEST-030-FE 前端行为测试

用 Node 内置 `node:test` + `node:vm` 直接执行 `src/main/resources/static/js` 下的真实脚本，不安装浏览器或第三方前端框架，也不复制实现来造假；应用运行本身不依赖 Node。

| 测试文件 | 覆盖点 | 数量 |
|---|---|---|
| [security.test.js](../tests/frontend/security.test.js) | 退出成功才清缓存；HTTP 500/网络异常/`success!==true` 均 reject 且保留本地身份；写请求带 `X-XSRF-TOKEN` 与 same-origin；CSRF 首次失败后可重试；403 只刷新一次 token 重试一次 | 9 |
| [login.test.js](../tests/frontend/login.test.js) | 注册/登录清掉上一账号兴趣缓存；管理员登录跳后台；兴趣保存失败/401 不跳转、不写缓存、可见错误；成功才写缓存并进入应用 | 7 |
| [main.test.js](../tests/frontend/main.test.js) | 启动以服务端 interest 为准（空值清旧缓存）；未登录跳登录页；兴趣失败/401/成功；退出失败可见错误不跳转、成功跳转 | 7 |
| [admin.test.js](../tests/frontend/admin.test.js) | 匿名/游客 gate 状态；管理员登录加载当前激活 tab；过期重登重新加载该 tab；切换账号退出失败提示、成功后回管理员登录层；侧边栏退出失败提示 | 5 |

运行命令：

```bash
node --test tests/frontend/*.test.js
```

预期：`tests 27 / pass 27 / fail 0`。Node 仅用于测试，CI 中由 [checks.yml:L1](../.github/workflows/checks.yml#L1) 的 setup-node 步骤执行。

失败排查方向：

- CSRF 相关测试若全部 403，确认测试通过真实 `GET /api/auth/csrf` 获取 token（Cookie 双提交），不要用 `with(csrf())`；开发配置使用 `CookieCsrfTokenRepository`，直接注入 request attribute 不生效。
- 若响应中的中文断言失败，确认读取 MockMvc 响应体时按 UTF-8 解码，`getContentAsString()` 默认用 ISO-8859-1 会制造乱码。
- 管理员相关测试失败时，确认测试属性注入了 `APP_ADMIN_USERNAME`/`APP_ADMIN_PASSWORD`，且数据文件路径指向临时目录。
- 前端测试若报 DOM 元素缺失，检查 `tests/frontend/harness.js` 的沙箱是否覆盖了脚本用到的元素和 `document.querySelector` 选择器；脚本通过 `vm.runInContext` 读取真实 `static/js` 文件。
- 回滚类测试依赖“把临时目录替换成同名普通文件”制造落盘失败；不要在仓库真实 `data/` 下运行。

浏览器端建议手工验证（未自动化）：

1. 游客登录后访问 `/admin.html`，应提示无权限，可点“切换账号登录”真正退出并回到管理员登录层；
2. 管理员登录后可读写管理后台，退出后刷新应回到登录入口；
3. 页面 30 分钟无操作后会话过期，管理页应重新要求登录且不产生重定向循环。

## TEST-039 多轮对话验收

对应 [REQ-039](conversation_context.md#L3)。本分支预期：Java 47/47、Node 29/29；无模型密钥的 HTTP 冒烟通过。

| 测试函数 / 脚本 | 运行命令 | 预期结果 | 失败排查 |
|---|---|---|---|
| [twoSessionsAndPrincipalChangesCannotReadEachOthersHistory](../src/test/java/com/guide/service/ConversationServiceTest.java#L51)、[explicitSpotSwitchResetsHistoryAndNewConversationInvalidatesOldId](../src/test/java/com/guide/service/ConversationServiceTest.java#L69) | `mvn -o -Dtest=ConversationServiceTest test` | 第二个 Cookie/主体不能沿用 ID；换景点清空旧轮次，重开获得新 ID | 查 `ConversationService.owner`、Session 属性与景点识别 |
| [failedAnswerDoesNotPublishTurnAndIdleHistoryExpires](../src/test/java/com/guide/service/ConversationServiceTest.java#L83)、[historyRetainsOnlySixCompletedExchangesAndRejectsUnknownSpot](../src/test/java/com/guide/service/ConversationServiceTest.java#L97) | 同上 | 失败轮次不入历史；闲置 20 分钟 410；仅留六轮；未知景点 400 | 查时钟注入、提交时机与 `MAX_TURNS` |
| [sendsSystemContextThenBoundedHistoryThenCurrentQuestion](../src/test/java/com/guide/service/ChatHistoryRequestTest.java#L24) | `mvn -o -Dtest=ChatHistoryRequestTest test` | 模型请求依次包含当前景点、历史问答、新问题 | 查 `ChatService.callAiApi` 消息序列与 mock JSON |
| [pronounFollowupsUseCurrentSpotHistoryAndHours](../src/test/java/com/guide/service/ChatFallbackContextTest.java#L15) | `mvn -o -Dtest=ChatFallbackContextTest test` | 无模型密钥时“它有什么故事/什么时候开放”引用所选景点的历史和时间 | 查 `spotReplyForQuestion` 与景点数据字段 |
| [conversation.test.js](../tests/frontend/conversation.test.js#L6) 的两项 Node 测试 | `node --test tests/frontend/*.test.js` | 第二轮沿用 ID、重开换 ID 且携带 CSRF、410 显示可操作提示 | 查 `main.js` 会话变量、`AuthGuard.apiFetch` 和测试 DOM harness |
| [smoke_teacher_project.py](../scripts/smoke_teacher_project.py#L1) 的真实 HTTP 校验 | `python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar --java <java可执行文件> --port 18080` | 两个 Cookie 隔离、重开失效、换景点的故事和时间来自新景点 | 查服务器日志、Cookie/CSRF 是否同一 opener，以及景点数据 |
