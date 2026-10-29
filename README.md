# 旅游 AI 数字人 · 三人课设

团队仓库：https://github.com/D92647426/tourism-ai-avatar

当前主代码来自老师提供的 **软件杯7.16.rar**，已替换之前的 Python/Vue Demo。旧版本完整保留在 Git 标签 `baseline-lingtour-20261019` 中。

## 技术结构

- Java + Spring Boot 2.7.18，Maven 构建，源码目标 Java 8；团队开发推荐 JDK 17。
- 网页使用 HTML/CSS/JavaScript，随 Spring Boot 一起提供。
- Live2D 展示使用 PIXI 与 Haru 示例模型。
- 景点、知识库、配置等使用 JSON 文件，当前不需要 PostgreSQL。
- `android/` 保留 Kotlin、WebView 和原生语音桥接源码，需另用 Android Studio 配置构建。

## 第一次加入

- [可转发给组员与 AI 的手册](docs/team_join_guide.md#L1)
- [环境与启动指南](docs/team_setup.md#L1)
- [分支、提交与评审](CONTRIBUTING.md#L1)
- [来源和导入处理](UPSTREAM.md#L1)
- [项目结构](docs/architecture.md#L1)

## 启动网页项目

准备 JDK 17 和 Maven，在仓库根目录执行：

```bash
mvn clean package
java -jar target/ai-guide-1.0.0.jar
```

打开：

- 游客页：http://localhost:8080/
- 登录页：http://localhost:8080/login.html
- 管理页：http://localhost:8080/admin.html

也可用 IDEA 打开 `pom.xml`，等待 Maven 同步后运行 `com.guide.GuideApplication`。

未设置 `DEEPSEEK_API_KEY` 时使用本地降级回答。需要真实模型时，在启动终端配置自己的环境变量；不要将 Key 写入源码。Spring Boot 不会自动读取普通 `.env` 文件。

## 验证

```bash
mvn verify
python scripts/check_data_integrity.py
python scripts/test_data_integrity.py
python scripts/check_doc_links.py
python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar
```

Python 只用于可选检查脚本与 CI，网页项目运行不依赖 Python、Node.js 或 Docker。当前已有 Java 服务测试（ChatService、KnowledgeService、SpotService 及自然检索/聊天，共 49 个用例）和 Python 数据检查测试；自动检查验证 Maven 构建与单测、知识/景点数据结构、文档链接和本地启动后的页面/接口/模型资源。结构检查通过不代表景区事实已核验，详见 [知识数据完整性方案](docs/knowledge_integrity.md#L1)。

## 当前边界

知识检索是字符串匹配，推荐路线由预设规则生成，语音主要使用浏览器或 Android 系统能力。知识库与景点资料是未核验的课程示例，价格、开放时间、交通等变动信息以景区公告为准。Haru 是示例角色，最终角色素材与课设创意尚未定案。Android APK 本次未验证构建。

压缩包中的编译产物、个人 IDE 配置、真实接口 Key、历史账号和交互记录未提交。具体处理见 [导入记录](docs/import_manifest.json)。

## 自然提问与可追溯候选（#10）

支持“大佛”“梵宫”等人工别名和原知识关键词，多景点提问分配相关资料，未命中时明确提示补充名称。回答附本地资料 K编号，API带knowledgeReferences；这些是候选参考，不是官方或已核验来源。详见 [自然检索设计](docs/natural_retrieval.md#L1)。本分支接在知识修复PR #21之后，其他未合并功能不自动包含。
