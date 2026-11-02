# 当前 Java API 入口

基础地址：`http://localhost:8080`。请求/响应均为 JSON；认证依赖服务端 HttpSession（Cookie `JSESSIONID`），状态变更请求还必须携带 CSRF token。

## 公开接口（无需登录）

| API 编号 | 方法与地址 | 用途 | 位置 |
|---|---|---|---|
| API-001 | POST /api/chat | 输入 message、可选 interest，返回 reply、fallback 与推荐路线；匿名可用，但需 CSRF 头 | [ChatController.java:L22](../src/main/java/com/guide/controller/ChatController.java#L22) |
| API-002 | GET /api/spots | 景点列表，可选 keyword | [SpotController.java:L23](../src/main/java/com/guide/controller/SpotController.java#L23) |
| API-003 | GET /api/spots/{id} | 景点详情 | [SpotController.java:L33](../src/main/java/com/guide/controller/SpotController.java#L33) |
| API-004 | GET /api/digital-human-config | 公开只读的数字人展示配置，不含用户/凭据 | [PublicConfigController.java:L34](../src/main/java/com/guide/controller/PublicConfigController.java#L34) |

API-001 请求示例：`{"message":"hello"}`；空 Key 时响应示例：`{"reply":"...","fallback":true,"recommendedRoutes":[]}`。缺少/错误 CSRF 时返回 403。

API-004 响应示例：`{"name":"灵灵","welcomeMessage":"...","voiceType":"female","modelName":"haru","primaryColor":"#c8963e","volume":1.0,"speechRate":1.0}`；该端点供游客页读取展示配置，管理端的 `GET/PUT /api/admin/digital-human-config` 仍需 ADMIN。

## CSRF 约定（REQ-030）

- 先 `GET /api/auth/csrf`，响应体为 `{"headerName":"X-XSRF-TOKEN","parameterName":"_csrf","token":"..."}`，同时下发 `XSRF-TOKEN` Cookie（非 HttpOnly，供页面脚本读取）。
- 浏览器端由 [security.js:L48](../src/main/resources/static/js/security.js#L48) 统一封装：带 `credentials: 'same-origin'`，非 GET/HEAD/OPTIONS 请求自动加 `X-XSRF-TOKEN` 头；403 时只刷新一次 token 并重试一次。
- 服务端使用 `CookieCsrfTokenRepository`（[SecurityConfig.java:L110](../src/main/java/com/guide/config/SecurityConfig.java#L110)），不能全局关闭 CSRF。

## 认证接口（API-030）

| API 编号 | 方法与地址 | 用途 | 位置 |
|---|---|---|---|
| API-030-01 | GET /api/auth/csrf | 取 CSRF token（Cookie 双提交：`XSRF-TOKEN` + 响应字段 token） | [AuthController.java:L60](../src/main/java/com/guide/controller/AuthController.java#L60) |
| API-030-02 | POST /api/auth/register | 注册游客账号；忽略客户端传入的 role，永远 GUEST；密码 ≥4 位 | [AuthController.java:L76](../src/main/java/com/guide/controller/AuthController.java#L76) |
| API-030-03 | POST /api/auth/login | 登录并建立服务端 HttpSession；成功返回 role；失败 401 | [AuthController.java:L103](../src/main/java/com/guide/controller/AuthController.java#L103) |
| API-030-04 | GET /api/auth/me | 读取当前服务端身份；匿名 401 | [AuthController.java:L131](../src/main/java/com/guide/controller/AuthController.java#L131) |
| API-030-05 | POST /api/auth/interest | 更新当前登录用户的兴趣；忽略客户端 userId；需登录 + CSRF | [AuthController.java:L150](../src/main/java/com/guide/controller/AuthController.java#L150) |
| API-030-06 | POST /api/auth/logout | 退出并使服务端会话失效，返回 200 JSON | [SecurityConfig.java:L117](../src/main/java/com/guide/config/SecurityConfig.java#L117) |

请求/响应示例：

- API-030-02：请求 `{"username":"alice","password":"pass1234"}`；200 `{"success":true,"userId":"ab12cd34","username":"alice","role":"GUEST"}`。400 示例：`{"success":false,"message":"密码至少 4 位"}`、`{"success":false,"message":"用户名已存在"}`。
- API-030-03：请求 `{"username":"admin","password":"********"}`；200 `{"success":true,"userId":"...","username":"admin","interest":null,"role":"ADMIN"}` 并下发新的 `JSESSIONID`；401 `{"success":false,"message":"用户名或密码错误"}`。登录会更换 session id（会话固定防护）。
- API-030-04：200 返回与登录相同的安全字段；匿名 401 `{"success":false,"message":"未登录或会话已过期，请重新登录"}`。
- API-030-05：请求 `{"interest":"摄影打卡"}`（客户端传 userId 会被忽略，以服务端会话身份为准）；200 返回更新后的安全字段；400 `{"success":false,"message":"兴趣偏好不能为空"}`；匿名 401；CSRF 缺失/错误 403。
- API-030-06：200 `{"success":true,"message":"已退出登录"}`；之后旧 `JSESSIONID` 访问 `/api/admin/**` 返回 401。

所有认证响应使用独立 DTO（[UserView.java:L13](../src/main/java/com/guide/dto/UserView.java#L13)、[AuthResult.java:L13](../src/main/java/com/guide/dto/AuthResult.java#L13)），响应中不会出现 `password` 或 `passwordHash`。

## 管理接口（API-030-07）
## API-033 讲解搭档（REQ-033 / GitHub #19）

`POST /api/exploration/coach`，`Content-Type: application/json`。实现：[ExplorationCoachController.java:L1](../src/main/java/com/guide/controller/ExplorationCoachController.java#L1)、[ExplorationCoachService.java:L1](../src/main/java/com/guide/service/ExplorationCoachService.java#L1)。

| 字段 | 请求约束 |
|---|---|
| packId / packVersion | 必填字符串，1–64 位既有内容包 ID 规则 |
| task | 必填对象，含 id、spotName、title、prompt、reference、source、cues；沿用内容包类型与长度上限，不使用其他字段 |
| observation | 必填字符串，去首尾空白后4–1200字；不是服务端已核实事实 |
| mode | demo 或 onsite，个人选择，不验证到访 |

完整字段限制及响应契约见 [exploration_coach_design.md:L13](./exploration_coach_design.md#L13)。请求示例由当前包生成：`{packId: pack.id, packVersion: pack.version, task: pack.tasks[0], observation: "我注意到两只手的姿态不同。", mode: "demo"}`，字段值须按 JSON 编码；示例包见 [lingshan-demo.json:L1](../src/main/resources/static/exploration/lingshan-demo.json#L1)。

200 响应示例：`{"reply":"可以把看到的细节与推测分开。","followUp":"哪一个细节支持你的解释？","mode":"local-coach","fallback":true,"reference":"本次任务资料原文","source":{"title":"资料标题","url":"https://example.org/source","status":"inherited-unverified"},"notice":"资料由内容包提供，未经独立核验，不判分。"}`。mode 为 local-coach/model-coach，fallback 如实标注本次是否使用本地规则；followUp由任务规则生成，模型仅补充reply。source/reference只取本次有效请求，模型不可改写引用。

非法字段、非对象根或畸形JSON返回400：`{"code":"INVALID_CONTEXT","message":"中文原因"}`，不回显完整观察。错误Content-Type可能由Spring返回415；未预期服务器故障为500。该接口不写analytics/用户数据、不抓取来源链接，不能称为独立资料核验。取消浏览器等待不保证后端调用立即停止。

验证：`mvn test`；隔离运行 `python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar` 验证无Key本地提示、来源回填和400错误。当前基线公开接口；后续合并 #15 时沿用框架CSRF，页面已兼容AuthGuard.apiFetch。

## 继承基线入口

基线 API 保持老师源码实现：

| 方法与地址 | 用途 | 位置 |
|---|---|---|
| /api/admin/** | 知识、配置、统计、用户列表等管理接口，服务端要求 ADMIN | [AdminController.java:L26](../src/main/java/com/guide/controller/AdminController.java#L26) |
| GET /api/admin/users | 用户列表；返回 `UserView`，不含密码字段 | [AdminController.java:L147](../src/main/java/com/guide/controller/AdminController.java#L147) |

保护规则由 [SecurityConfig.java:L137](../src/main/java/com/guide/config/SecurityConfig.java#L137) 的 `authorizeRequests` 强制执行（`/api/admin/**` → `hasRole("ADMIN")`），不依赖页面检查：

- 匿名 + 合法 CSRF：401 `{"success":false,"message":"未登录或会话已过期，请重新登录"}`。
- 已登录游客 + 合法 CSRF：403 `{"success":false,"message":"无权限访问该接口"}`。
- 管理员：200；写操作需合法 CSRF。
- 任意身份缺少/错误 CSRF：403 `{"success":false,"message":"CSRF 校验失败，请刷新页面后重试"}`（与匿名 401 明确区分）。

## 认证、错误码与验证方式

| 状态码 | 含义 | 典型场景 |
|---|---|---|
| 200 | 成功 | 公开读取、管理员读写、登录/注册/退出成功 |
| 400 | 参数或凭据格式错误 | 用户名长度、密码策略、兴趣为空、注册重名 |
| 401 | 未登录或会话过期 | 匿名访问 `/api/admin/**`、匿名 `/api/auth/me`、登出后访问管理接口 |
| 403 | 已登录无权限或 CSRF 失败 | 游客访问管理接口；缺少/错误 CSRF token |

测试方式：

- Java 集成测试真实走 `GET /api/auth/csrf` 再带 `X-XSRF-TOKEN`：权限边界见 [SecurityIntegrationTest.java:L199](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L199)，会话固定/退出见 [L294](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L294)、[L309](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L309)，角色注入见 [L328](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L328)，兴趣身份隔离见 [L378](../src/test/java/com/guide/security/SecurityIntegrationTest.java#L378)。
- 真实 HTTP（随机端口）的 Cookie/CSRF 与管理全链路见 [CookieAttributeTest.java:L128](../src/test/java/com/guide/security/CookieAttributeTest.java#L128)、[L168](../src/test/java/com/guide/security/CookieAttributeTest.java#L168)。
- 浏览器脚本行为（退出失败、CSRF 重试、兴趣保存、管理员重登）用 Node 内置测试执行：`node --test tests/frontend/*.test.js`，文件见 [security.test.js](../tests/frontend/security.test.js)、[login.test.js](../tests/frontend/login.test.js)、[main.test.js](../tests/frontend/main.test.js)、[admin.test.js](../tests/frontend/admin.test.js)。

## 管理后台入口与认证现状（已修复）

2026-10-19 的基线状态是“没有管理员账号、管理接口无认证、`/admin.html` 可直接打开、未认证 dashboard 返回 200”。GitHub #5 / REQ-030 已修复该状态，基线记录保留为历史：

- 后台 API 的保护由 [SecurityConfig.java:L137-L138](../src/main/java/com/guide/config/SecurityConfig.java#L137-L138) 的 `authorizeRequests` 强制执行；
- 管理页进入时通过 [admin.js:L150](../src/main/resources/static/js/admin.js#L150) 调 `/api/auth/me` 校验身份，未登录显示管理员登录入口（[admin.html:L13](../src/main/resources/static/admin.html#L13)），游客显示无权限并可真正切换账号；
- 管理员由启动环境变量 `APP_ADMIN_USERNAME`/`APP_ADMIN_PASSWORD` 初始化，默认不创建，见 [config_reference.md](./config_reference.md)。

## API-039 会话聊天

对应 [REQ-039](conversation_context.md#L3)。两条接口均允许游客访问、以 Cookie 绑定会话，写请求须携带现有 CSRF 令牌。服务函数是 [ChatController.chat](../src/main/java/com/guide/controller/ChatController.java#L24) → [ConversationService.chat](../src/main/java/com/guide/service/ConversationService.java#L74) 和 [ChatController.start](../src/main/java/com/guide/controller/ChatController.java#L31) → [ConversationService.start](../src/main/java/com/guide/service/ConversationService.java#L49)。

| API | 方法与路径 | 请求参数 | 响应字段 | 错误码 |
|---|---|---|---|---|
| API-039a | `POST /api/chat` | JSON `message` 必填（1–600 字符）；`conversationId`、`spotId`、`interest` 可选 | `reply` 文本、`fallback` 布尔值、`conversationId` 服务端随机 ID、`spotId` 当前景点 ID 或 `null`，以及原有路线字段 | 400 消息为空/过长或景点不存在；403 CSRF 错误、其他会话/已重置 ID；410 当前会话闲置过期；502 空回复 |
| API-039b | `POST /api/chat/new` | 无请求体要求，可发送 `{}` | `conversationId` 新 ID、`spotId: null` | 403 CSRF 错误 |

示例（省略从 `GET /api/auth/csrf` 取得的 Cookie 和令牌值）：

```http
POST /api/chat
Content-Type: application/json
X-XSRF-TOKEN: <token>

{"message":"它有什么故事","spotId":11}
```

```json
{"reply":"【灵山大佛】的故事：……","fallback":true,"conversationId":"550e8400-e29b-41d4-a716-446655440000","spotId":11}
```

```http
POST /api/chat/new
X-XSRF-TOKEN: <token>

{}
```

```json
{"conversationId":"e5215c50-3b20-4d88-93bb-a56e82f87ca1","spotId":null}
```

测试命令：`mvn -o clean verify`、`node --test tests/frontend/*.test.js`、`python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar --java <java可执行文件> --port 18080`。具体上下文和限制见 [会话设计](conversation_context.md#L9)。

## API-040 景点详情提问

复用 API-039 的 `POST /api/chat` 与 `/api/chat/new`，参数/响应/错误码/服务函数/示例保持上节约定。入口和数据流见 [交互约定](spot_chat_entry.md#L9)，测试命令 `node --test tests/frontend/*.test.js`。


API-040b：`GET /api/chat/context` 无请求参数，Cookie 识别当前会话；200 响应示例 `{"conversationId":"服务端ID","spotId":11}`，空/过期/其他身份时两字段为 `null`。服务函数 [ConversationService.current](../src/main/java/com/guide/service/ConversationService.java#L60)，控制器 [ChatController.current](../src/main/java/com/guide/controller/ChatController.java#L37)。不返回聊天历史、不接受外部会话 ID，无业务错误码；测试 `mvn -o -Dtest=ConversationServiceTest test`，HTTP 验证由冒烟脚本覆盖。
当前原版没有管理员账号或管理接口认证；`/admin.html` 可直接打开。管理页请求：[admin.js:L33](../src/main/resources/static/js/admin.js#L33)，管理控制器：[AdminController.java:L17](../src/main/java/com/guide/controller/AdminController.java#L17)。2026-10-19 本地验证，未带认证的页面和 dashboard 请求均为 HTTP 200。

## REQ-031 客户端请求生命周期

`POST /api/chat` 请求与响应字段不变。页面对一次逻辑请求（含JSON解析）设置30秒总时限；取消/超时仅停止当前浏览器等待，不保证后端计算终止。用户可手动重试，不自动重复生成问答。详情和验收见 [chat_reliability.md:L1](./chat_reliability.md#L1)。

## API-036 Android语音桥协议2（REQ-036）

此为WebView JavaScript桥，无新增HTTP路径/权限策略。入口 [MainActivity.kt:L255](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L255)，页面接线 [main.js:L347](../src/main/resources/static/js/main.js#L347)。

| 调用 | 输入/返回 | 语义 |
|---|---|---|
| AndroidSpeech.getTtsProtocolVersion() | 无输入；整数2 | 声明可按ID回调 |
| AndroidSpeech.isTtsReady() | 无输入；布尔值 | 系统中文语言可用，不保证实际已发声 |
| AndroidSpeech.speakWithId(text,id) | 两个字符串；无返回 | id由网页生成唯一串，主线程提交 |
| AndroidSpeech.stopSpeaking() | 无输入/返回 | 隔离当前任务、停止引擎、回调stop |

回调：onTtsStart(id)、onTtsEnd(id)、onTtsError(error,id)、onTtsStop(id)，字符串用JSONObject.quote编码；not-ready/speak-failed/playback-error/error-数字为引擎失败，显示文字仍可读。示例 `speakWithId('欢迎','gs-pageNonce-1')` → `onTtsStart('gs-pageNonce-1')` → `onTtsEnd('gs-pageNonce-1')`；只有当前ID生效，重复/旧/无ID回调忽略。保留旧speak(text)给旧网页，新网页拒绝依赖旧协议回调，改用Web或文字提示。测试命令 `node --test tests/frontend/speech*.test.js`；Android仍需构建/真机。见 [完整验收:L1](./speech_lifecycle.md#L1)。
## API-038 数字人展示配置（REQ-038 / #8）

`GET /api/digital-human-config` 公开只读；管理员 `GET/PUT /api/admin/digital-human-config` 保留会话/ADMIN，PUT 还需 CSRF。返回字段仅 name、welcomeMessage、primaryColor、voiceType、modelName、volume、speechRate。

PUT 接受部分对象，例如 `{"name":"山川向导","welcomeMessage":"欢迎一起发现风景。","primaryColor":"#245D73"}`；200 返回完整配置，颜色标准化为小写，缺字段保持原值（包括音量0）。空对象只读回当前快照。

- 名称 trim 后1–40，欢迎语1–500；名称不能含控制字符，欢迎语允许 LF/制表。使用文本显示，不解析 HTML。
- 颜色只支持六位 `#RRGGBB`；voiceType/modelName 非空无控制字符，分别最多200/100字符；volume 有限数0–1，speechRate 有限数0.5–2。
- 非对象、null、未知字段、错类型或非法值：400 `{"code":"INVALID_CONFIG","message":"具体校验提示"}`，整次不保存。空/损坏 HTTP JSON 由 Spring 返回400。
- 写盘失败：500 `{"code":"CONFIG_SAVE_FAILED","message":"…未保存…"}`，不发布候选内存、不泄露文件路径；客户端保留草稿。
- 401/403/CSRF 规则沿用 API-030；游客页面不能为展示配置读取管理接口。

实现：[AdminController.java:L116](../src/main/java/com/guide/controller/AdminController.java#L116)、[ConfigService.java:L128](../src/main/java/com/guide/service/ConfigService.java#L128)。完整规则与故障边界见 [display_config.md:L1](display_config.md#L1)。
