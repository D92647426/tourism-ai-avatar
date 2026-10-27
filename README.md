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
python scripts/check_doc_links.py
python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar
```

Python 只用于可选检查脚本与 CI，网页项目运行不依赖 Python、Node.js 或 Docker。Java 基线没有业务单元测试；本组新增前端行为测试。自动检查验证 Maven 构建、文档链接和本地启动后的页面/接口/模型资源。

## 当前边界

知识检索是字符串匹配，推荐路线由预设规则生成，语音主要使用浏览器或 Android 系统能力。Haru 是示例角色，最终角色素材尚未定案；观察式导览创意已实现首版。Android APK 本次未验证构建。

压缩包中的编译产物、个人 IDE 配置、真实接口 Key、历史账号和交互记录未提交。具体处理见 [导入记录](docs/import_manifest.json)。

## 创意首版：今天你当导游（#17）

已加入“讲解搭档”（#19）：根据当前任务和观察草稿给建议、追问一个细节，并显示资料来源与真实生成方式。无模型Key时使用明确标注的本地提示；修改观察或切站后旧反馈失效。不会冒充事实核验或评分。详情见 [搭档设计与验收](docs/exploration_coach_design.md#L1)。

首页领取观察任务、用自己的话讲解、对照资料并保存为个人旅程。支持将发现交给数字人继续提问、下载旅程手册，以及通过 JSON 内容包切换景区；附校园观察示例。关键词对照不判分，课堂演示不冒充到访。玩法、资料边界和90秒演示见 [体验指引](docs/exploration_guide.md#L1)。

## 聊天发送与重试（#6）

等待回复时阻止重复发送，30秒未完成显示超时。可取消等待或手动重试上一个问题，新草稿不会被重试覆盖；取消不保证后端计算终止。说明与演示矩阵见 [聊天可靠性](docs/chat_reliability.md#L1)。前端行为检查使用 Node.js 22：`node --test tests/frontend/*.test.js`；应用运行仍不依赖 Node。

## 数字人语音状态（#7）

人物嘴部跟随实际播报事件，等待声音、无中文声线、失败和停止都有明确状态。生命周期改进、Android协议2兼容与手动验收见 [speech_lifecycle.md:L1](docs/speech_lifecycle.md#L1)。当前分支96项前端、67项Java检查通过；Android未编译/未真机，浏览器截图用不发声的可控mock，不能作为真实声音验收。此改动接在聊天/创意PR之后，知识/认证/统计PR另行评审。
