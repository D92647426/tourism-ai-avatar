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
