# 当前检查与验证

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

## TEST-031 聊天请求与页面行为

对应 REQ-031；执行 `node --test tests/frontend/*.test.js`，预期 24/24 通过。控制模块的 single-flight、HTTP/网络/JSON错误、超时、取消与迟到回调测试见 [chat-request.test.js:L1](../tests/frontend/chat-request.test.js#L1)；页面入口、状态恢复、重试草稿和语音延迟保护见 [chat-main.test.js:L1](../tests/frontend/chat-main.test.js#L1)。可复现演示矩阵见 [chat_reliability.md:L1](./chat_reliability.md#L1)。失败时按用例标题检查请求状态、计时器清理及对应入口，不使用真实模型排错。Node仅作测试工具，CI使用Node22。

切换含不同测试依赖的分支后，若报告 target/test-classes 中不存在于当前源码的旧测试，先执行 `mvn clean verify` 清除缓存，再运行本页检查；不要据此修改当前分支依赖。2026-10-25 已据此完成本分支构建。
