# 当前检查与验证

## TEST-027 Java 基线导入验收

| 检查 | 命令与预期 |
|---|---|
| Maven 构建 | mvn verify，生成可运行 JAR；导入基线本身没有业务单元测试，REQ-035 起新增 Java 服务测试（见 TEST-035） |
| 页面和接口 | python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar |
| 文档 | python scripts/check_doc_links.py |
| Git | 检查真实 Key、用户数据、构建产物未跟踪，旧基线标签存在 |

启动接口检查使用独立临时数据目录、空模型 Key 和本机地址，验证首页、景点、降级问答、Live2D 配置与模型文件，退出时只停止自己启动的进程。

实现：[smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)。CI：[checks.yml:L1](../.github/workflows/checks.yml#L1)。

本次不执行 Android APK 构建，也不使用老师的真实模型 Key。

Local verification (2026-10-19): Maven build passed with JDK 19; HTTP smoke passed with 16 spots, offline chat and Live2D resources. Android and real-model calls were not run.

## TEST-029 项目名称与路径一致性

对应 REQ-029。检查本地仓库名、GitHub origin、README 与入组手册一致；网页标题为“旅游 AI 数字人”；执行 Maven verify、文档链接检查和现有 JAR 启动检查。沿用 [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)，无需为纯名称替换新增镜像测试。

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
