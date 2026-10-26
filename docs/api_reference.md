# 当前 Java API 入口

## API-034 可解释的后台统计（REQ-034 / GitHub #13）

GET /api/admin/dashboard 新字段：todayInteractions/last7DaysInteractions/sentimentSampleCount为非负整数，positiveQuestionRate为0–100的百分比数值或null，periodStart/periodEnd为ISO日期，timezone=Asia/Shanghai，estimated=true只标记问句情绪来自规则估计。图表字段hotQuestions/sentimentTrend/spotRanking/hourlyDistribution沿用结构，趋势新增unclassified。

兼容字段todayVisitors/weekVisitors/satisfactionRate/avgResponseTime保留键但返回null（未采集），**不再返回旧伪值；旧消费者必须迁移到新字段并正确处理null**。Java已弃用getSatisfactionRate入口改为nullable Double，旧代码若拆箱也应迁移，不承诺源码兼容旧的伪口径。

GET /api/admin/reports/sentiment 返回trend、positiveQuestionRate、sentimentSampleCount、periodStart/periodEnd/timezone/estimated、satisfactionRate=null，以及同一快照的topics、suggestions。报告页一次读取整份数据，避免多请求跨日期时混用样本。原reports/topics与reports/suggestions仍可单独读取，但各自形成快照。

空数据示例：`{"todayInteractions":0,"last7DaysInteractions":0,"positiveQuestionRate":null,"sentimentSampleCount":0,"todayVisitors":null,"weekVisitors":null,"satisfactionRate":null,"avgResponseTime":null,"periodStart":"2026-10-20","periodEnd":"2026-10-26","timezone":"Asia/Shanghai","estimated":true}`（省略图表及知识字段）。两条有效中性/负向加一条未知情绪时，问答数3、样本数2、占比0，不能显示95%。

窗口：上海时间today-6日00:00至本次统计时刻；未来、非正时间戳、null日志不计入。未知情绪计问答次数与unclassified，不计入情绪占比分母。完整字段及边界见 [analytics_accuracy.md:L1](./analytics_accuracy.md#L1)。无请求参数，不新增写接口或模型调用；错误HTTP不得当成有效空响应。

位置：[AnalyticsService.java:L1](../src/main/java/com/guide/service/AnalyticsService.java#L1)、[DashboardData.java:L1](../src/main/java/com/guide/model/DashboardData.java#L1)、[SentimentReport.java:L1](../src/main/java/com/guide/model/SentimentReport.java#L1)、[AdminController.java:L1](../src/main/java/com/guide/controller/AdminController.java#L1)。验证：Maven测试及 [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，隔离空Key测试覆盖空数据、发起一次离线问答后的真实0%和报告一致性。

本分支不包含 #5 的认证改动；API路径/策略仍沿用基线。合并 #5 后需以管理员会话运行统计HTTP检查，不能为通过检查而放开管理权限。

## 其他继承基线入口

除上述统计语义更正外，其余 API 沿用老师源码实现：

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
