# 当前检查与验证

## TEST-034 后台真实统计

对应REQ-034。Java运行 `mvn clean verify`；依赖已缓存且网络受限时可 `mvn -o clean verify`。切分支后先clean，避免把其他PR的测试产物计入本分支。固定Clock、临时JSON、时区/七日边界/未知样本/0%/快照/并发保存见 [AnalyticsServiceTest.java:L1](../src/test/java/com/guide/service/AnalyticsServiceTest.java#L1)，API转发与null字段见 [AdminControllerTest.java:L1](../src/test/java/com/guide/controller/AdminControllerTest.java#L1)。预期无失败、无真实模型或历史数据访问。

前端 `node --test tests/frontend/*.test.js`，执行真实后台脚本；empty metrics、zero positive share、HTTP failures、stale dashboard response、CDN chart failure、report network failures等用例验证空样本/真实零值/单快照报告/过期刷新/图表缺失。见 [admin-stats.test.js:L1](../tests/frontend/admin-stats.test.js#L1)。应用运行不依赖Node。

HTTP运行 [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，新增empty_analytics/zero_positive_question_rate；检查为隔离空Key环境，管理员权限合并后应适配其测试身份，不绕过权限。失败先对照新API字段和Asia/Shanghai窗口，不能将旧95当默认值。

## TEST-027 Java 基线导入验收

| 检查 | 命令与预期 |
|---|---|
| Maven 构建 | mvn verify，生成可运行 JAR；原项目没有业务单元测试，不据此声称单测通过 |
| 页面和接口 | python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar |
| 文档 | python scripts/check_doc_links.py |
| Git | 检查真实 Key、用户数据、构建产物未跟踪，旧基线标签存在 |

启动接口检查使用独立临时数据目录、空模型 Key 和本机地址，验证首页、景点、降级问答、Live2D 配置与模型文件，退出时只停止自己启动的进程。

实现：[smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)。CI：[checks.yml:L1](../.github/workflows/checks.yml#L1)。

本次不执行 Android APK 构建，也不使用老师的真实模型 Key。

Local verification (2026-10-19): Maven build passed with JDK 19; HTTP smoke passed with 16 spots, offline chat and Live2D resources. Android and real-model calls were not run.

## TEST-029 项目名称与路径一致性

对应 REQ-029。检查本地仓库名、GitHub origin、README 与入组手册一致；网页标题为“旅游 AI 数字人”；执行 Maven verify、文档链接检查和现有 JAR 启动检查。沿用 [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，无需为纯名称替换新增镜像测试。
