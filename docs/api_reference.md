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

## API-035 资料边界的语义变化（REQ-035）

未新增、删除或替换任何路由，请求/响应字段与 HTTP 状态保持基线形状；变化只在既有接口的文本语义：

| 接口 | 语义变化 | 位置 |
|---|---|---|
| POST /api/chat | 系统提示新增“不得用未核验资料补写事实、待补充不代表已知、变动信息以景区公告为准”；空 Key 或模型失败时，本地 reply 附未核验课程示例边界；知识库兜底以“课程示例资料库”开头；门票/交通分支删除硬编码餐饮价格（原 50 元/位、35 元/位），提示以景区公告为准 | [ChatService.java:L150](../src/main/java/com/guide/service/ChatService.java#L150)、[ChatService.java:L213](../src/main/java/com/guide/service/ChatService.java#L213) |
| 对话上下文 | 景点资料每块声明未核验静态课程示例，开放时间/门票/交通按示例字段标注；知识正文带“待补充”或课程示例前缀 | [SpotService.java:L90](../src/main/java/com/guide/service/SpotService.java#L90) |

响应仍为 reply、fallback、interest、recommendedRoutes 等原字段；不改检索匹配顺序与推荐排名。方案见 [knowledge_integrity.md:L1](./knowledge_integrity.md#L1)，验证见 [test_reference.md:L24](./test_reference.md#L24)。
