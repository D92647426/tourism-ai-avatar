# 当前检查与验证

## TEST-033 讲解搭档与共用供应商边界

对应REQ-033。Java执行 `mvn test` 或 `mvn verify`；本机联网依赖解析受限时，依赖已缓存可用 `mvn -o verify`。规则/类型/来源/失败降级：[ExplorationCoachServiceTest.java:L1](../src/test/java/com/guide/service/ExplorationCoachServiceTest.java#L1)；HTTP/畸形JSON：[ExplorationCoachControllerTest.java:L1](../src/test/java/com/guide/controller/ExplorationCoachControllerTest.java#L1)；假供应商与时限：[AiCompletionClientTest.java:L1](../src/test/java/com/guide/service/AiCompletionClientTest.java#L1)；旧chat回归：[ChatServiceTest.java:L1](../src/test/java/com/guide/service/ChatServiceTest.java#L1)、[ChatControllerTest.java:L1](../src/test/java/com/guide/controller/ChatControllerTest.java#L1)。测试函数名直接说明各验收场景，预期无真实网络调用且全通过。

前端执行 `node --test tests/frontend/*.test.js`。快照、模式/来源一致性、超时/取消/迟到JSON、网络恢复见 [coach-request.test.js:L1](../tests/frontend/coach-request.test.js#L1)；页面编辑/模式/站点/包切换失效、草稿保留、安全渲染见 [exploration-page.test.js:L1](../tests/frontend/exploration-page.test.js#L1)。预期新旧用例全部通过，真实模型与Android不在该证据内。

HTTP构建产物检查同 [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，新增 offline_coach 与 coach_validation 项。失败按API400提示/前端用例名检查当前包格式或请求状态，不用真实Key排错。

## TEST-032 观察式导览

对应 REQ-032。执行 `node --test tests/frontend/*.test.js`。规则与异常包见 [exploration-core.test.js:L1](../tests/frontend/exploration-core.test.js#L1)，存储隔离、导入预览、恢复、未保存草稿与安全渲染见 [exploration-page.test.js:L1](../tests/frontend/exploration-page.test.js#L1)，聊天交接保护见 [chat-main.test.js:L1](../tests/frontend/chat-main.test.js#L1)。预期所有用例通过，原聊天测试仍通过；具体数量以执行结果为准。
## TEST-034 后台真实统计

对应REQ-034。Java运行 `mvn clean verify`；依赖已缓存且网络受限时可 `mvn -o clean verify`。切分支后先clean，避免把其他PR的测试产物计入本分支。固定Clock、临时JSON、时区/七日边界/未知样本/0%/快照/并发保存见 [AnalyticsServiceTest.java:L1](../src/test/java/com/guide/service/AnalyticsServiceTest.java#L1)，API转发与null字段见 [AdminControllerTest.java:L1](../src/test/java/com/guide/controller/AdminControllerTest.java#L1)。预期无失败、无真实模型或历史数据访问。

前端 `node --test tests/frontend/*.test.js`，执行真实后台脚本；empty metrics、zero positive share、HTTP failures、stale dashboard response、CDN chart failure、report network failures等用例验证空样本/真实零值/单快照报告/过期刷新/图表缺失。见 [admin-stats.test.js:L1](../tests/frontend/admin-stats.test.js#L1)。应用运行不依赖Node。

HTTP运行 [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，新增empty_analytics/zero_positive_question_rate；检查为隔离空Key环境，管理员权限合并后应适配其测试身份，不绕过权限。失败先对照新API字段和Asia/Shanghai窗口，不能将旧95当默认值。

## TEST-027 Java 基线导入验收

| 检查 | 命令与预期 |
|---|---|
| Maven 构建 | mvn verify，生成可运行 JAR，并执行现有自动化测试 |
| Maven 构建 | mvn verify，生成可运行 JAR；导入基线本身没有业务单元测试，REQ-035 起新增 Java 服务测试（见 TEST-035） |
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

## TEST-040 景点提问

对应 REQ-040。文件、测试函数行为、命令、预期和失败排查见 [验收记录](spot_chat_entry.md#L13)。桌面与手机布局通过实际浏览器操作验证，截图附在同一文档。


TEST-040 的具体 Node 用例：[detail selects real spotId without sending; followups, reopening and reset preserve clear context](../tests/frontend/spot-chat.test.js#L6)、[reload restores server context and text can switch it without sending a stale spotId](../tests/frontend/spot-chat.test.js#L46)、[pending question cannot race a new spot selection or send twice](../tests/frontend/spot-chat.test.js#L63)。命令 `node --test tests/frontend/*.test.js`，预期 32/32；异常时检查详情待发送选择、服务端快照恢复和忙碌标记。Java [snapshotRestoresOnlyCurrentOwnersUnexpiredSpot](../src/test/java/com/guide/service/ConversationServiceTest.java#L111) 用 `mvn -o -Dtest=ConversationServiceTest test` 验证当前/其他身份/过期快照；失败查 owner 与 Clock，完整 Java 预期 48/48。
对应 REQ-029。检查本地仓库名、GitHub origin、README 与入组手册一致；网页标题为“旅游 AI 数字人”；执行 Maven verify、文档链接检查和现有 JAR 启动检查。沿用 [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，无需为纯名称替换新增镜像测试。

## TEST-031 聊天请求与页面行为

对应 REQ-031；执行 `node --test tests/frontend/*.test.js`，预期聊天相关用例通过；创意分支另有新增交接用例，总数见 TEST-032。控制模块的 single-flight、HTTP/网络/JSON错误、超时、取消与迟到回调测试见 [chat-request.test.js:L1](../tests/frontend/chat-request.test.js#L1)；页面入口、状态恢复、重试草稿和语音延迟保护见 [chat-main.test.js:L1](../tests/frontend/chat-main.test.js#L1)。可复现演示矩阵见 [chat_reliability.md:L1](./chat_reliability.md#L1)。失败时按用例标题检查请求状态、计时器清理及对应入口，不使用真实模型排错。Node仅作测试工具，CI使用Node22。

切换含不同测试依赖的分支后，若报告 target/test-classes 中不存在于当前源码的旧测试，先执行 `mvn clean verify` 清除缓存，再运行本页检查；不要据此修改当前分支依赖。2026-10-25 已据此完成本分支构建。

## TEST-036 语音与口型生命周期

对应REQ-036/API-036。`node --test tests/frontend/*.test.js` 当前96项通过：新增 [speech-lifecycle.test.js:L1](../tests/frontend/speech-lifecycle.test.js#L1) 23项测试真实开始/结束、声线延迟、失败超时、暂停/恢复、旧ID、旧APK降级、清理与销毁；[speech-main.test.js:L1](../tests/frontend/speech-main.test.js#L1) 11项运行真实页面脚本，检查UI/文字/口型/取消/后台及探索草稿。假时钟和mock只作用于语音/DOM边界，不声称真实发声。失败先查当前status、语音ID与是否仍有timer，再对照 [speech_lifecycle.md:L1](./speech_lifecycle.md#L1)。

2026-10-27 JDK19 `mvn -o clean verify` 67项Java继承测试通过；空Key隔离HTTP smoke和文档检查通过。Maven不编译Kotlin Android，Android缺工具链，未编译/未真机。截图采用 [浏览器mock:L1](../tests/fixtures/speech-browser-init.js#L1)，桌面/移动验收步骤见 [speech_lifecycle.md:L1](./speech_lifecycle.md#L1)。
## TEST-038 展示配置全链路（REQ-038 / #8）

- `mvn verify`：本分支65项 Java 全通过（0失败/错误/跳过）。新增21项 [ConfigServiceTest.java:L1](../src/test/java/com/guide/service/ConfigServiceTest.java#L1) 覆盖部分更新、类型/长度/颜色/数值边界、音量0、返回副本、保存失败、坏文件/尾随JSON与原文件保留、重建服务读取落盘配置。权限/CSRF 与 API 错误见 [SecurityIntegrationTest.java:L1](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L1)。
- `node --test tests/frontend/*.test.js`：41项全通过；新增14项 [display-config.test.js:L24](../tests/frontend/display-config.test.js#L24) 执行真实页面脚本，验证默认/HTML字面文本/迟到欢迎语/JSON解析超时/明暗主题，后台失败、重复提交、音量0和旧响应隔离。
- `python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar`：15项检查通过。新增临时管理员+真实Cookie/CSRF保存、匿名读取、非法更新原文件不变、重新启动JAR仍读到新值、管理接口仍401。凭据临时随机生成且不打印，数据全部临时隔离，空模型Key，不读取真实用户/交互文件。
- `python scripts/check_doc_links.py`：检查所有文档定位与链接。

本机 Java19、Node24、Python3.12.7环境验证；GitHub CI 使用Java17/Node20/Python3.12，结果以PR检查为准。本轮未验证真实模型、系统发声或Android；语音参数消费属 #14。浏览器截图与操作记录见 [display_config.md:L1](display_config.md#L1)。
## TEST-035 知识数据完整性与资料边界

对应 REQ-035，方案见 [knowledge_integrity.md:L1](./knowledge_integrity.md#L1)。

| 检查 | 命令与预期 |
|---|---|
| Java 服务测试 | mvn -o test；ChatServiceTest 6、KnowledgeServiceTest 9、SpotServiceTest 7，共 22 个用例全通过 |
| Maven 全量构建 | mvn -o clean verify，EXIT 0 |
| 数据结构检查 | python scripts/check_data_integrity.py；两份知识库各 16 条、景点 16 条、打包与外部库一致，末行提示“结构检查不等同事实核验” |
| 数据检查坏样本 | python scripts/test_data_integrity.py；stdlib unittest 覆盖坏 JSON、重复/非正 ID、缺字段、U+FFFD、正文等于标题、打包漂移等 |
| 文档链接 | python scripts/check_doc_links.py |
| HTTP 冒烟 | python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar |

Java 测试用 @TempDir 与反射直接构造服务，不启动 Spring 上下文、不写仓库 data/。样例位置：[KnowledgeServiceTest.java:L39](../src/test/java/com/guide/service/KnowledgeServiceTest.java#L39)、[SpotServiceTest.java:L17](../src/test/java/com/guide/service/SpotServiceTest.java#L17)、[ChatServiceTest.java:L21](../src/test/java/com/guide/service/ChatServiceTest.java#L21)、[test_data_integrity.py:L111](../scripts/test_data_integrity.py#L111)。CI 在 [checks.yml:L1](../.github/workflows/checks.yml#L1) 中执行同样的数据检查与坏样本测试。

真实景区事实、Android APK 与真实模型 API 不在本次验证范围；数据检查只证明结构与打包一致性，不等同事实核验。

## TEST-037 自然提问检索与最终回复

对应REQ-037/API-037；[NaturalRetrievalTest.java:L1](../src/test/java/com/guide/service/NaturalRetrievalTest.java#L1)直接验证知识检索，覆盖12个默认库问题、空白/无关/歧义、多个实体、外景短别名、稳定排序、自定义ID复用、长文本预算、重复关键词、16景点字典及最多3条引用。不能用最终景点回复替代此测试。

[NaturalChatTest.java:L1](../src/test/java/com/guide/service/NaturalChatTest.java#L1)另验简称的最终回复/引用、无命中提示、多个实体、空库景点降级；本机HttpServer模拟模型200/503，验证真实请求体带同一有界资料快照、失败降级只查一次。所有读写使用临时目录，不发请求到真实模型、不读取用户历史。

命令：`mvn -o clean verify`（网络可用可省-o）；`python scripts/check_data_integrity.py`；`python scripts/test_data_integrity.py`；`python scripts/check_doc_links.py`；`python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar`。HTTP smoke新增natural_knowledge_references与ambiguous_question，确认打包JAR的实际API行为。失败先对照别名字典、关键词、评分与返回引用，勿把数据结构检查当作景区事实核验。


2026-10-29 TEST-037最终验收：24项NaturalRetrievalTest、18项NaturalChatTest（含同组12题最终回复）与继承22项合计64项Java；44项Python数据检查测试。完整标题自然句与外景短关键词旁路两项审查发现均有先红后绿回归；查询实际模型使用本机HTTP mock，不是付费联网模型。


TEST-041：完整命令、组合回归和失败排查见 [整合验收](integration_first_round.md#L13)。


TEST-042：对应REQ-042，具体测试函数行为、文件、命令、预期与排查见 [语音验收](voice_settings.md#L17)。完整Node当前预期156/156、Java221/221；真实音质另行设备验收。


TEST-043/044/045：规则/适配器/草稿/实际浏览器测试，文件、命令、预期行为和排查方向见 [验收记录](director_design.md#L27)。


TEST-043 具体用例：[预算/候选/输入不变](../tests/frontend/director.test.js#L7)、[重排差异与恢复](../tests/frontend/director.test.js#L17)、[显式交接及拒绝状态](../tests/frontend/director.test.js#L25)。TEST-044：[跨站草稿、模板与减少动态](../tests/frontend/exploration-page.test.js#L163)。运行 `node --test tests/frontend/*.test.js` 预期160/160；Java完整验收 `mvn -o verify` 预期221/221。检查失败先核对API候选与当前内容包、点击冒泡、matchMedia和草稿保护。

## TEST-046 游客讲解方式

对应 [REQ-046设计](narration_design.md#L1)。[会话沿用/隔离与重置](../src/test/java/com/guide/service/NarrationModeTest.java#L41)、[非法值/失败不提交/过期/身份](../src/test/java/com/guide/service/NarrationModeTest.java#L60)、[本地字段与缺失](../src/test/java/com/guide/service/NarrationModeTest.java#L80)、[模型真实请求JSON](../src/test/java/com/guide/service/NarrationModeTest.java#L113)、[HTTP字段契约](../src/test/java/com/guide/controller/NarrationContractTest.java#L17)；前端 [恢复/草稿/重置](../tests/frontend/narration.test.js#L24)、[忙态与重试快照](../tests/frontend/narration.test.js#L37)。

命令：`mvn -o verify`、`node --test tests/frontend/*.test.js`、`python scripts/check_doc_links.py`、`python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar`。预期非法值400、无跨主体偏好、失败不提交、无自动发问、切模式无旧重试。失败先核对模式枚举/候选会话/请求快照，而非根据真实模型文风判断功能是否实现。实际浏览器和最终计数见 [交付记录](narration_design.md#L25)。

TEST-046复查回归：[免费/特点与外景不串事实](../src/test/java/com/guide/service/NarrationModeTest.java#L133)、[迟到初始化与重置失败](../tests/frontend/narration.test.js#L50)。短追问规则和外景字典边界见 [设计](narration_design.md#L21)。

## TEST-047 / TEST-048

[纯状态/下一站/无效方案与快照](../tests/frontend/journey-core.test.js#L1)、[主页面联动/拒绝/重编/迟到/切站](../tests/frontend/journey-page.test.js#L1)、[候选安全与归属](../tests/frontend/chat-references.test.js#L1)；[请求生命周期](../tests/frontend/chat-request.test.js#L1)另验主聊天HTTP400不重放。实际JAR的模块资源、连续切站/模式及候选source契约见 [smoke](../scripts/smoke_teacher_project.py#L1)。

命令：`node --test tests/frontend/*.test.js`、`mvn -o verify`、`python scripts/check_doc_links.py`、`python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar`。预期不自动发送、不覆盖草稿、重编后旧重试/候选不复活，候选不作逐句事实证明。失败先核对主页面方案来源标记、生命周期身份和本次响应对象。真实浏览器、计数和截图在 [交付设计](journey_references_design.md#L27)追加。

## TEST-049 导游追问卡

[模板、站点快照、文本安全与拒绝](../tests/frontend/chat-followups.test.js#L1) 和 [真实页面、历史选站、模式、重编、忙态及迟到](../tests/frontend/followups-page.test.js#L1)。命令 `node --test tests/frontend/chat-followups.test.js tests/frontend/followups-page.test.js`，预期 9/9。全套运行 `node --test tests/frontend/*.test.js`、`mvn -o verify`、`python scripts/check_doc_links.py` 和 `python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar`。失败先检查当次响应 spotId 与真实景点匹配，以及 GuideChatDraft 草稿/请求守卫。实际截图与完整结果见 [交付记录](followups_design.md#L1)。

## TEST-050 本地追问讲解

[LocalFollowupReplyTest](../src/test/java/com/guide/service/LocalFollowupReplyTest.java#L1) 包含三意图/模式矩阵、完整字段限定语/缺失、自定义名/非模板、当前和解析景点、外景/多实体、在线原问/历史、故障/候选快照与前端模板契约。运行 `mvn -o -Dtest=LocalFollowupReplyTest test`，预期8/8。完整验证 `mvn -o verify`、`node --test tests/frontend/*.test.js`、`python scripts/check_doc_links.py` 及 `python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar`。HTTP 预期三模板 reply 不同，spot/mode/fallback 正确。失败先核对完整模板匹配、景点解析顺序及实际构建 JAR，详见 [设计](local_followups_design.md#L19)。

## TEST-051 按段听讲解

[分段/安全/状态](../tests/frontend/chat-audio.test.js#L1)、[实际主聊天回听/守卫/迟到/无声线/语音待发送计时](../tests/frontend/audio-main.test.js#L1)、[实际方案保持](../tests/frontend/journey-page.test.js#L1)。运行 `node --test tests/frontend/chat-audio.test.js tests/frontend/audio-main.test.js tests/frontend/journey-page.test.js`。完整验证 `node --test tests/frontend/*.test.js`、`mvn -o verify`、`python scripts/check_doc_links.py` 和隔离 JAR HTTP 冒烟。预期只播所选段、正文无丢失、无额外请求，停止/后台后旧事件无效。失败先核对 activeAudioCard 所属及生命周期真实事件，实际计数与 mock 截图见 [设计](segmented_audio_design.md#L1)。

## TEST-052 跨景点主题讲解

[ThemeGuideTest](../src/test/java/com/guide/service/ThemeGuideTest.java#L1) 检查实际ID、缺站/字段、三模式、模型请求及故障、严格JSON类型和会话原子性。运行 `mvn -o -Dtest=ThemeGuideTest test`。[theme-guide.test.js](../tests/frontend/theme-guide.test.js#L1) 检查实际主页面十一项主题闭环/草稿/计数/取消/重编/新对话/目录与文本安全，运行 `node --test tests/frontend/theme-guide.test.js`。

完整验收 `mvn -o verify`、`node --test tests/frontend/*.test.js`、`python scripts/check_doc_links.py`、数据工具及隔离 [HTTP](../scripts/smoke_teacher_project.py#L1)。预期三站离线讲解成功、匹配meta才计入回顾、编辑草稿不发送lecture动作、非法请求状态不提交。失败先核对目录正式名称与实际ID、请求是否仍为准备原文、方案revision及当前请求代际。实际结果与截图写入 [设计验收](superpowers/specs/2026-11-05-theme-guide-design.md#L1)。


TEST-052 关键用例定位

| 测试函数或名称 | 行为 |
|---|---|
| [explicitLectureAndFreeQuestionStayRequestScopedAndInvalidRequestsRollBack](../src/test/java/com/guide/service/ThemeGuideTest.java#L151) | 主题作用域与候选回滚 |
| [actualModelRequestKeepsRawQuestionHistoryModeAndValidatedTheme](../src/test/java/com/guide/service/ThemeGuideTest.java#L234) | 实际模型JSON、原问题和来源上下文 |
| [strictJsonRejectsMalformedTypesAndKeepsOldMockPath](../src/test/java/com/guide/service/ThemeGuideTest.java#L211) | 严格类型与旧调用路径 |
| [selecting a theme reuses itinerary without automatic requests](../tests/frontend/theme-guide.test.js#L34) | 三站闭环与成功回顾 |
| [failed and cancelled responses do not count](../tests/frontend/theme-guide.test.js#L55) | 取消和重编迟到 |
| [entering a theme from pending ordinary chat](../tests/frontend/theme-guide.test.js#L109) | 普通问答切主题时取消旧请求 |

## TEST-053 本地角色声线

- [Java代理测试](../src/test/java/com/guide/service/LocalSpeechServiceTest.java#L11)：真实loopback HTTP验证WAV、重定向、损坏/超限响应、非法输入和2请求并发；[身份/CSRF测试](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L200)：真实会话/CSRF和禁用时503；[控制器契约](../src/test/java/com/guide/controller/LocalSpeechControllerTest.java#L1) 验证二进制类型和安全错误。命令 `mvn -o verify`，失败查Java代理输入、超时与SecurityConfig。
- [前端队列测试](../tests/frontend/local-speech.test.js#L14)：Unicode分句、预取一段、静音/语速、真实main接线、停止/迟到事件、8秒回退、播放拒绝和部分失败不重读已完成句。命令 `node --test tests/frontend/*.test.js`。
- [Python工作进程测试](../tests/test_local_voice_server.py#L17)：输入校验、AI中文读法、HTTP WAV/health和满额503；`python -m unittest discover -s tests -p test_local_voice_server.py`，不需要GPU。不把fake合成器当作真实推理。
- 真实GPU和浏览器另验：按 [运行手册](local_voice_runbook.md#L1) 启动，登录后提问，核对文字先显示、真实playing时嘴型、停止清理、分段回听；停语音服务验证系统声音回退。Android真机与多人吞吐未验证。

TEST-053补充：`LocalSpeechServiceTest.readTimeoutReturns504AndReleasesItsSlot` 通过真实延迟响应验证12秒读取超时映射504，再同时成功处理两个请求，证明超时释放并发额度。


## TEST-054～059 校园首版

2026年11月9日Task5 worker亲自运行全量Maven verify，304项Java通过，Node276项通过，Python数据44项和本地voice3项通过，结构检查与隔离JAR HTTP通过。命令使用本机JDK19、绝对Maven、`-o -DforkCount=0`，socket与atomic file测试在授权提升环境执行。[本机命令](campus_demo_runbook.md#L24)

| 测试编号与需求 | 测试函数或文件 | 预期与失败定位 |
|---|---|---|
| TEST-054 / REQ-054 | [CampusCatalogTest](../src/test/java/com/guide/campus/CampusCatalogTest.java#L1)，[访客来源回归](../src/test/java/com/guide/campus/CampusCatalogTest.java#L95) | 五校区26地点、现行窗口、19变体和来源合法，失败查目录ID、校区与主/补充来源 |
| TEST-055A / REQ-055 | [lostCardIntentSurvivesCampusClarification](../src/test/java/com/guide/campus/CampusAssistantTest.java#L29)、[routeKeepsCardDestinationWhenUserSuppliesStartingPlace](../src/test/java/com/guide/campus/CampusAssistantTest.java#L39) | 补卡消歧后仍选现行窗口，四教只作为起点 |
| TEST-055B / REQ-055 | [真实HTTP模型工具往返](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L22)、[取消并发](../src/test/java/com/guide/campus/CampusConcurrencyTest.java#L16)、[控制器](../src/test/java/com/guide/campus/CampusControllerTest.java#L30) | 已核验ID、三轮六工具/总期限、重放取消与新会话，失败查请求身份与提交归属 |
| TEST-055C / REQ-055 | [RETURN_STAGE](../tests/frontend/campus-page.test.js#L345)、[SHOW_MAP](../tests/frontend/campus-page.test.js#L361)、[SHOW_WEATHER](../tests/frontend/campus-page.test.js#L377) | 实际API入口返回舞台清旧图、空地点校区地图与资料不足、天气正文及已有来源入口，三项分别RED/GREEN |
| TEST-056 / REQ-056 | [CampusWeatherServiceTest](../src/test/java/com/guide/campus/CampusWeatherServiceTest.java#L1)、[校园页面](../tests/frontend/campus-page.test.js#L1) | 缓存时点、超时、无GPS与地图降级，失败查source/timestamp与坐标系 |
| TEST-057A / REQ-057 | [confirmed dining invitation](../tests/frontend/campus-companion.test.js#L40)、[busy defers](../tests/frontend/campus-companion.test.js#L55)、[foreground samples](../tests/frontend/campus-companion.test.js#L108) | 气泡暂缓、30秒停留/20秒采样、前台恢复与过期，失败查时间与可见性 |
| TEST-057B / REQ-057 | [explicitLibraryInteriorUsesCatalogAliasAndConfirmsOnlyPhysicalPlace](../src/test/java/com/guide/campus/CampusAssistantTest.java#L231)、[outsideAndHypotheticalLibraryStatementsNeverConfirmInterior](../src/test/java/com/guide/campus/CampusAssistantTest.java#L243)、[explicitLibraryDepartureClearsPhysicalEvidenceAndPreservesDestination](../src/test/java/com/guide/campus/CampusAssistantTest.java#L252)、[libraryQuestionsAndHypotheticalDepartureDoNotRefreshOrClearPhysicalEvidence](../src/test/java/com/guide/campus/CampusAssistantTest.java#L266) | 馆内确认成立，馆外/门口/附近/离馆清旧位置，主题保留，假设意向不刷新时间 |
| TEST-058 / REQ-058 | [campus-page.test.js](../tests/frontend/campus-page.test.js#L1) | 人物舞台、图片迟到隔离、真实目录素材、键盘和减少动态效果，失败查场景revision与资源ID |
| TEST-059 / REQ-059 | [exitingSimulationWithoutGpsClearsEnvironmentAndAsksForRouteOrigin](../src/test/java/com/guide/campus/CampusAssistantTest.java#L318)、[deniedLocationAfterSimulationRemainsUnknownAndExplicitNullClearsRealPosition](../src/test/java/com/guide/campus/CampusAssistantTest.java#L333)、[页面退出](../tests/frontend/campus-page.test.js#L1) | false/null清模拟位置、time/hour/weather，拒绝定位继续问起点 |
| TEST-054HTTP / REQ-054～059 | [verify_campus](../scripts/smoke_teacher_project.py#L76) | 真实CSRF、5/26目录、重放400/409、两Cookie、三闭环、取消/新会话、8素材magic，失败看业务断言及隔离服务日志 |

```powershell
mvn -o -DforkCount=0 verify
node --test tests/frontend/*.test.js
python -X utf8 scripts/check_data_integrity.py
python -X utf8 scripts/test_data_integrity.py
python -X utf8 scripts/check_doc_links.py
python -X utf8 -m unittest discover -s tests -p test_local_voice_server.py
python -X utf8 scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar --port 18090
```

目标TDD命令为 `mvn -o -DforkCount=0 -Dtest=CampusAssistantTest test`。馆内单项先RED1失败再GREEN1通过，馆外/离馆/假设三项先RED3失败，再全类22通过。旧回归JAR使用同一HTTP入口，在“Unknown gym must clear the old card destination.”断言退出1，业务检查先于素材检查。故障可检出证据留在本轮SDD报告中。

`smoke_teacher_project.py --help` 给出CLI参数，支持--jar必填、--java默认java、--port默认18080、--timeout默认60。脚本仅使用临时数据和空Key，输出JSON，成功0失败1。`verify_campus(base)`可供已有隔离服务调用，只验证接口与资源，进程生命周期由调用方负责。

根代理已在桌面1440×1000和手机390×844点击三个场景，最新打包页到馆/馆外声音状态复验通过。截图链接与实际边界见 [运行手册](campus_demo_runbook.md#L101)。天气当次真实供应商可达、模型HTTP替身和页面空Key证据分别记录，真实DeepSeek Key、手机GPS、声音、麦克风与GPU继续按环境验收。


### TEST-057B 第一轮复审回归

新增 [futureLibraryEntryDoesNotEstablishOrRefreshPhysicalEvidence](../src/test/java/com/guide/campus/CampusAssistantTest.java#L274)、[libraryOutsideWithDeClearsInteriorAndPreservesDestination](../src/test/java/com/guide/campus/CampusAssistantTest.java#L288)、[libraryDoorwayWithDeClearsInteriorAndPreservesDestination](../src/test/java/com/guide/campus/CampusAssistantTest.java#L299)。三项各先RED1失败，再运行 `mvn -o -DforkCount=0 -Dtest=CampusAssistantTest test`，全类25项通过。覆盖未来入馆及离馆不改已有位置时间戳，含“的”的馆外与门口清除确认且保留目的地。原明确到馆用例覆盖“我在/我到了/我已经进入/我已经在图书馆内”和标点子句、目录别名。

同一 [HTTP入口](../scripts/smoke_teacher_project.py#L76)补入上述三个实测句式，分别验证新会话未知位置、已有位置时点和馆外清除。最终计数为304项Java、276项Node，其他检查命令与边界沿用上节。


### TEST-055 / TEST-057 最终全分支复审修复

REQ-055换目标导航与模型业务一致性，REQ-057馆内分区和真实位置复核。定向入口继续使用既有服务、真实本机HTTP模型供应商、纯陪伴模块与实际页面脚本。

| 回归 | 实际入口与预期 |
|---|---|
| F1显式换导航目标 | [explicitNavigationResolvesNewDestinationAndTaskBeforeRouting](../src/test/java/com/guide/campus/CampusAssistantTest.java#L75)，补卡→图书馆→补卡均采用当前目标，四教保持起点 |
| F2馆内分区 | [leavingLibraryAreaClearsPhysicalEvidenceAndKeepsTheTopic](../src/test/java/com/guide/campus/CampusAssistantTest.java#L54)、[confirmed library areas](../tests/frontend/campus-page.test.js#L78)，多媒体阅览区直接确认和从馆内进入都静音，出馆清位置 |
| F3模型最终意图 | [modelDiningRedirectReplacesCardChoicesAndDestinationThroughActualChoice](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L138)、[新地点与未知地点事项](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L165)、[工具场景与同业务照片](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L187)、[分区父馆外观](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L203)，选项、任务、目标和场景一致，照片预览保持服务区目的地 |
| F4真实复核 | [正常顺序与先声明后开启](../tests/frontend/campus-page.test.js#L7)、[跨普通服务端轮次](../tests/frontend/campus-page.test.js#L38)、[旧点击与忙态](../tests/frontend/campus-page.test.js#L48)、[过期及馆内静音](../tests/frontend/campus-page.test.js#L69)、[可选物理版本兼容](../tests/frontend/campus-companion.test.js#L19)，真实点击补充证据，接受才正式发送 |

命令沿用 `mvn -o -DforkCount=0 verify`、`node --test tests/frontend/*.test.js`、数据结构/44项坏样本、3项voice、文档链接与18090隔离JAR HTTP检查。本轮完整输出以最终修复报告为准，失败先核对物理环境版本、当前目标和本轮通过验证的模型动作。首次目标回归分别先失败再修复，分区照片另补真实HTTP先红后绿。

2026年11月9日最终修复验收实跑310项Java、285项Node、44项数据坏样本和3项voice全部通过，数据结构与18090隔离JAR HTTP通过。旧环境迟到及新环境轮次归零另有[先红后绿回归](../tests/frontend/campus-companion.test.js#L27)。模型使用本机HTTP替身，真实Key、设备GPS、麦克风和声音仍按运行手册验收。

F4另通过[错开UI时钟的实际页面回归](../tests/frontend/campus-page.test.js#L20)，确认发生在刷新后300毫秒时，按钮在20～21秒内可用，定时刷新继续保留原位置时间戳。


### TEST-055 照片切换导航限定复审

[unrelatedPhotoChangesCardDestinationBeforeRouting](../src/test/java/com/guide/campus/CampusAssistantTest.java#L149) 和 [modelEnhancingUnrelatedPhotoSeesTheNewDestinationAndClearedTask](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L217) 分别通过离线正常服务入口和真实HTTP供应商入口验证补卡→图书馆照片→未知起点→四教到图书馆路线。两项独立先RED再GREEN，模型增强前的上下文已切换。保留 [modelPhotoOfLibraryAreaPreservesItsServiceDestination](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L203) 的服务区目的地回归。失败先核对照片与业务地点的实际关联，最终动作与本地动作相同只用于判断建议是否需要重建。

本次限定复审实跑 `mvn -o -DforkCount=0 verify` 共312项Java通过，Node285、数据坏样本44、voice3全部通过，结构、文档链接与含照片切换路线的18090隔离JAR HTTP检查通过。

## TEST-060 场景转场与连续交互

对应REQ-060和[#65](https://github.com/D92647426/tourism-ai-avatar/issues/65)。运行 `node --test tests/frontend/campus-motion.test.js tests/frontend/campus-page.test.js`。

| 回归 | 入口与预期 |
|---|---|
| 场景与回复同步 | [scene and reply commit together](../tests/frontend/campus-motion.test.js#L17)，内容共同更新，输入框焦点保留，快照按舞台边界裁切 |
| 快速中断、新对话及离页 | [interrupting an uncaptured turn](../tests/frontend/campus-motion.test.js#L35)、[new conversation](../tests/frontend/campus-motion.test.js#L49)、[page exit](../tests/frontend/campus-motion.test.js#L61)，旧回调执行后也无法覆盖新轮次 |
| 保留场景及返回舞台 | [KEEP_SCENE](../tests/frontend/campus-motion.test.js#L69)、[RETURN_STAGE](../tests/frontend/campus-motion.test.js#L80)，滚动、回复与图片归属符合动作 |
| 减少动态效果及捕获失败 | [三种即时路径](../tests/frontend/campus-motion.test.js#L92)、[捕获失败](../tests/frontend/campus-motion.test.js#L105)、[提前失败](../tests/frontend/campus-motion.test.js#L112)，完整渲染及CSS降级 |
| 照片与背景 | [迟到加载及保留场景](../tests/frontend/campus-motion.test.js#L119)、[双图层](../tests/frontend/campus-motion.test.js#L133)，图片在快照移除后渐显，旧图片及旧RAF不会覆盖新背景 |

2026年11月11日本机完整前端300项通过，其中15项为本轮动效回归。浏览器实际通过1440×1000、390×844、844×390、减少动态效果、快速往返及新对话。检查动画中间帧后修复快照盖住底部输入框的问题，手机及短横屏无横向溢出。动态结束通过标准输入执行只读DOM脚本轮询真实动画状态及照片透明度确认，浏览器错误记录为空。设备采用本机Chromium，手机为视口模拟。失败先检查epoch、快照完成时点及舞台裁切边界。

完整验证沿用 `mvn -o -DforkCount=0 verify`、`node --test tests/frontend/*.test.js`、`python scripts/check_doc_links.py`、数据44项和voice3项，以及隔离JAR HTTP冒烟。

TEST-060另覆盖[保留场景背景迟到](../tests/frontend/campus-motion.test.js#L145)及[离页撤销已提交照片](../tests/frontend/campus-motion.test.js#L156)。场景版本仅在场景提交时替换，普通提问后仍保留当前照片的加载能力。

本轮最终完整复验Java312、前端300、数据坏样本44、voice3全部通过，文档链接及结构检查通过，隔离JAR景区与校园HTTP冒烟通过。18089运行包的三份前端资源逐字节匹配工作区，并完成打包版桌面及手机浏览器复验。
