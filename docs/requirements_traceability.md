# 当前基线需求追踪

## REQ-026 三人协作

仓库保留独立 Git 历史、Issue/PR 模板、个人身份与评审流程。见 [CONTRIBUTING.md:L1](../CONTRIBUTING.md#L1)、[team_join_guide.md:L1](./team_join_guide.md#L1)。

## REQ-027 将仓库切换为老师压缩包源码

用户明确要求主代码替换为老师提供的压缩包内容。导入 Java/Spring Boot、网页 Live2D、JSON 数据样本和 Android 源码，保留 Git 与协作配置。旧基线标签为 baseline-lingtour-20261019。

| 内容 | 位置 |
|---|---|
| 源码与环境 | [pom.xml:L1](../pom.xml#L1)、[application.yml:L1](../src/main/resources/application.yml#L1) |
| 来源与排除项 | [UPSTREAM.md:L1](../UPSTREAM.md#L1)、[import_manifest.json:L1](./import_manifest.json#L1) |
| 启动说明 | [team_setup.md:L1](./team_setup.md#L1) |
| 验证 | [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1)、[checks.yml:L1](../.github/workflows/checks.yml#L1) |

本次不改变老师应用业务逻辑。配置中的真实 Key 外置，历史账号和聊天记录不上传，启动脚本不强杀占用端口的进程。

## REQ-028 集中整理本地项目资料

把 D:/Code 下与景区数字人课设相关的目录和资料集中到 D:/Code/旅游AI数字人。保留主仓库历史和未提交改动，恢复本地预览，更新入组路径。记录见 [local_workspace.md:L1](./local_workspace.md#L1)。

## REQ-029 统一旅游 AI 数字人项目名称

项目中文名为“旅游 AI 数字人”，GitHub 仓库名为 tourism-ai-avatar，本地集中目录为 D:/Code/旅游AI数字人，正式仓库为其下 tourism-ai-avatar。说明、入组手册、界面标题与团队任务采用统一名称，角色方案使用通用称呼。模型供应商的真实接口地址、环境变量与模型 ID 属于连接配置，保持有效值。

位置：[README.md:L1](../README.md#L1)、[local_workspace.md:L1](./local_workspace.md#L1)、[index.html:L6](../src/main/resources/static/index.html#L6)。验证：文档链接、Maven 构建、页面与接口检查。

## REQ-035 知识数据完整性（GitHub #9）

知识初始化改用打包 JSON 默认库并做最小结构校验；知识 1/2/3 错配正文改为“待补充”，4–16 标注未核验课程示例；修正景点上下文标签与“、”分隔符并关闭资源流；对话服务增加资料边界提示并删除硬编码餐饮价格。只修复可信输入基础，不编造史实、不改检索算法与模型接口。方案与逐条审查见 [knowledge_integrity.md:L1](./knowledge_integrity.md#L1)。

| 内容 | 位置 |
|---|---|
| 知识数据（外部库） | [data/knowledge.json:L1](../data/knowledge.json#L1) |
| 知识数据（打包默认库） | [knowledge.json:L1](../src/main/resources/knowledge.json#L1) |
| 加载、降级与结构校验 | [KnowledgeService.java:L64](../src/main/java/com/guide/service/KnowledgeService.java#L64) |
| 景点上下文与示例边界 | [SpotService.java:L90](../src/main/java/com/guide/service/SpotService.java#L90) |
| 对话资料边界 | [ChatService.java:L31](../src/main/java/com/guide/service/ChatService.java#L31) |
| 数据检查工具 | [check_data_integrity.py:L516](../scripts/check_data_integrity.py#L516) |
| 测试 | [KnowledgeServiceTest.java:L39](../src/test/java/com/guide/service/KnowledgeServiceTest.java#L39)、[SpotServiceTest.java:L17](../src/test/java/com/guide/service/SpotServiceTest.java#L17)、[ChatServiceTest.java:L21](../src/test/java/com/guide/service/ChatServiceTest.java#L21)、[test_data_integrity.py:L111](../scripts/test_data_integrity.py#L111) |
| CI 接入 | [checks.yml:L1](../.github/workflows/checks.yml#L1) |

验证命令见 [test_reference.md:L24](./test_reference.md#L24) 的 TEST-035。结构检查通过不等同景区事实核验。
