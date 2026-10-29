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

## API-037 自然检索候选引用（REQ-037 / GitHub #10）

`POST /api/chat` 路径/请求不变：message字符串，可选interest/userId仍沿用现有协议；本议题不增加可信身份或多轮记忆。响应保留reply、fallback、interest、recommendedRoutes，新增knowledgeReferences数组。无候选为[]；每项id为本地知识正整数ID、title最多80字符、source为`local-knowledge:{id}`。这是提供给本次模型/降级路径的候选，不代表模型实际引用、史实核验或官方出处，不生成虚假的来源URL。

空Key示例：`{"message":"大佛有什么故事？"}` → HTTP200，`{"reply":"…【资料 K4】…","fallback":true,"knowledgeReferences":[{"id":4,"title":"灵山大佛详解","source":"local-knowledge:4"}]}`（省略继承字段/示例正文）。`{"message":"它有什么故事？"}`在本地降级时回复请补充景点名称、knowledgeReferences=[]。有景点卡片但无知识时，仍可介绍卡片，并明确没有匹配知识；不能将景点规则当作检索命中。

不新增错误码或认证策略。空白/无关/含糊检索为空，不抛检索错误；模型调用失败沿用fallback=true，并复用同一候选快照。无实际声称消解所有自然语言或跨轮指代。完整规则见 [natural_retrieval.md:L1](./natural_retrieval.md#L1)，位置 [ChatService.java:L65](../src/main/java/com/guide/service/ChatService.java#L65)、[KnowledgeReference.java:L1](../src/main/java/com/guide/model/KnowledgeReference.java#L1)。验证 `mvn test` 或 [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，仅用临时数据/空Key或本机mock。
