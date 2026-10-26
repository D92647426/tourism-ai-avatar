# 当前 Java API 入口

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
| POST /api/chat | 输入 message、可选 interest，返回 reply、fallback 与推荐路线 | [ChatController.java:L22](../src/main/java/com/guide/controller/ChatController.java#L22) |
| GET /api/spots | 景点列表，可选 keyword | [SpotController.java:L23](../src/main/java/com/guide/controller/SpotController.java#L23) |
| GET /api/spots/{id} | 景点详情 | [SpotController.java:L33](../src/main/java/com/guide/controller/SpotController.java#L33) |
| POST /api/auth/register | 注册本机开发账号 | [AuthController.java:L24](../src/main/java/com/guide/controller/AuthController.java#L24) |
| POST /api/auth/login | 登录校验 | [AuthController.java:L62](../src/main/java/com/guide/controller/AuthController.java#L62) |
| /api/admin/* | 知识、配置、统计等管理接口 | [AdminController.java:L16](../src/main/java/com/guide/controller/AdminController.java#L16) |

空 Key 的聊天示例：请求 JSON 为 {"message":"hello"}，结果应有非空 reply，并标记 fallback。

当前接口的认证与错误行为沿用演示代码，后续业务改进再独立规划。

## 管理后台入口与认证现状

当前原版没有管理员账号或管理接口认证；`/admin.html` 可直接打开。管理页请求：[admin.js:L33](../src/main/resources/static/js/admin.js#L33)，管理控制器：[AdminController.java:L17](../src/main/java/com/guide/controller/AdminController.java#L17)。2026-10-19 本地验证，未带认证的页面和 dashboard 请求均为 HTTP 200。

## REQ-031 客户端请求生命周期

`POST /api/chat` 请求与响应字段不变。页面对一次逻辑请求（含JSON解析）设置30秒总时限；取消/超时仅停止当前浏览器等待，不保证后端计算终止。用户可手动重试，不自动重复生成问答。详情和验收见 [chat_reliability.md:L1](./chat_reliability.md#L1)。
