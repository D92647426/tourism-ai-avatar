# 当前 Java API 入口

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
