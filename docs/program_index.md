# 当前程序索引

| 功能 | 位置 |
|---|---|
| Maven 构建 | [pom.xml:L1](../pom.xml#L1) |
| Java 入口 | [GuideApplication.java:L1](../src/main/java/com/guide/GuideApplication.java#L1) |
| 对话服务 | [ChatService.java:L1](../src/main/java/com/guide/service/ChatService.java#L1) |
| 知识服务 | [KnowledgeService.java:L1](../src/main/java/com/guide/service/KnowledgeService.java#L1) |
| 用户服务 | [UserService.java:L1](../src/main/java/com/guide/service/UserService.java#L1) |
| 景点服务 | [SpotService.java:L1](../src/main/java/com/guide/service/SpotService.java#L1) |
| 统计服务 | [AnalyticsService.java:L1](../src/main/java/com/guide/service/AnalyticsService.java#L1) |
| 游客网页 | [index.html:L1](../src/main/resources/static/index.html#L1) |
| 网页交互 | [main.js:L1](../src/main/resources/static/js/main.js#L1) |
| Live2D | [live2d-helper.js:L1](../src/main/resources/static/js/live2d-helper.js#L1) |
| Android | [MainActivity.kt:L1](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L1) |
| 启动接口检查 | [smoke_teacher_project.py:L1](../scripts/smoke_teacher_project.py#L1) |
| GitHub 自动检查 | [checks.yml:L1](../.github/workflows/checks.yml#L1) |
| 打包默认知识库 | [knowledge.json:L1](../src/main/resources/knowledge.json#L1) |
| 知识数据结构检查 | [check_data_integrity.py:L516](../scripts/check_data_integrity.py#L516) |
| 知识数据检查测试 | [test_data_integrity.py:L111](../scripts/test_data_integrity.py#L111) |
| 对话服务测试 | [ChatServiceTest.java:L21](../src/test/java/com/guide/service/ChatServiceTest.java#L21) |
| 知识服务测试 | [KnowledgeServiceTest.java:L39](../src/test/java/com/guide/service/KnowledgeServiceTest.java#L39) |
| 景点服务测试 | [SpotServiceTest.java:L17](../src/test/java/com/guide/service/SpotServiceTest.java#L17) |

## 自然提问检索（REQ-037）

| 功能 | 位置 |
|---|---|
| 名称/别名、确定性排序和上下文预算 | [KnowledgeRetriever.java:L54](../src/main/java/com/guide/service/KnowledgeRetriever.java#L54) |
| 一次检索快照/兼容字符串入口 | [KnowledgeService.java:L297](../src/main/java/com/guide/service/KnowledgeService.java#L297)、[KnowledgeRetrieval.java:L1](../src/main/java/com/guide/service/KnowledgeRetrieval.java#L1) |
| 候选引用DTO/响应 | [KnowledgeReference.java:L1](../src/main/java/com/guide/model/KnowledgeReference.java#L1)、[ChatResponse.java:L30](../src/main/java/com/guide/model/ChatResponse.java#L30) |
| 人工维护的16景点别名 | [retrieval-entities.json:L1](../src/main/resources/retrieval-entities.json#L1) |
