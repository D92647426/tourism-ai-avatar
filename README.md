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

## 管理员入口与本地管理员账号

管理后台 `/admin.html` 需要 ADMIN 身份，登录入口在 `/login.html` 的“管理员登录”链接。默认**不创建**管理员；只有同时设置以下环境变量时，启动阶段才会初始化本地管理员：

```bash
export APP_ADMIN_USERNAME=your-admin-name
export APP_ADMIN_PASSWORD=your-admin-password
mvn spring-boot:run
```

规则：

- 管理员密码至少 8 位；游客密码仍为至少 4 位，已有游客账号不受影响。
- 用户名已被游客占用时启动会明确失败，不会把游客静默提升为管理员。
- 已存在的管理员不会被重复启动覆盖密码。
- 不要提交或打印真实管理员凭据；`data/users.json`、迁移备份与本机日志都不进入 Git。
- 登录后服务端会话默认 30 分钟过期；管理员和游客退出都会使服务端会话失效。

实现见 [SecurityConfig.java:L36](src/main/java/com/guide/config/SecurityConfig.java#L36)、[UserService.java:L59](src/main/java/com/guide/service/UserService.java#L59)。

## 验证

```bash
mvn verify
python scripts/check_data_integrity.py
python scripts/test_data_integrity.py
python scripts/check_doc_links.py
python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar
node --test tests/frontend/*.test.js
```

Python 只用于可选检查脚本与 CI，Node.js 只用于前端行为测试，网页项目运行不依赖 Python、Node.js 或 Docker。当前源码有 41 个 Java 自动化测试（权限边界、CSRF、会话固定、密码迁移/一致性、密码策略、Cookie 属性、真实 HTTP 认证链路）和 27 个前端行为测试（`node:test` + `vm` 直接执行 `static/js` 脚本，覆盖退出/CSRF/兴趣保存/管理员会话切换），分别由 `mvn verify` 与 `node --test` 执行；自动检查同时验证文档链接和本地启动后的页面/接口/模型资源，详见 [测试说明](docs/test_reference.md)。

## 当前边界

知识检索是字符串匹配，推荐路线由预设规则生成，语音主要使用浏览器或 Android 系统能力。Haru 是示例角色，最终角色素材与课设创意尚未定案。Android APK 本次未验证构建；网页已改为服务端会话与 CSRF，但 Android WebView 内 Cookie/CSRF 行为尚未验证，Android 原生代码未改动。
Python 只用于可选检查脚本与 CI，网页项目运行不依赖 Python、Node.js 或 Docker。本组已新增统计回归测试；原导入基线没有业务单元测试。自动检查验证 Maven 构建、文档链接和本地启动后的页面/接口/模型资源。

## 当前边界

后台统计已按 #13 更正：问答次数不再称访客量，问句正向占比只作规则估计并显示样本，空数据不再显示95%满意度；未采集的真实评价/独立访客/响应耗时为null。所有图表统一含今天的近7天、上海时区。新字段与旧客户端迁移见 [统计口径](docs/analytics_accuracy.md#L1)。

知识检索是字符串匹配，推荐路线由预设规则生成，语音主要使用浏览器或 Android 系统能力。Haru 是示例角色，最终角色素材与课设创意尚未定案。Android APK 本次未验证构建。

压缩包中的编译产物、个人 IDE 配置、真实接口 Key、历史账号和交互记录未提交。具体处理见 [导入记录](docs/import_manifest.json)。

### 多轮导览对话

游客现在可以在当前景点连续追问，并用“新对话”清除上下文。会话保存在当前浏览器对应的服务端 Session，闲置 20 分钟过期，最多保留六轮问答。接口、限制与验证见 [会话隔离与景点上下文](docs/conversation_context.md#L3)。

景点详情现在可点击“问问 AI 导游”选择景点，再主动提问；关闭后保留选择，“新对话”回到通用导览。见 [入口与验证](docs/spot_chat_entry.md#L3)。

当前开发状态见 [议题进度清单](docs/issue_progress.md#L1)。
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
## 展示设置（#8）

管理员在“数字人形象”中保存名称、首次欢迎语和主题色，游客刷新页面即可看到新设置。后台加载/保存失败会明确提示；已有聊天不会被迟到欢迎语改写。公开配置只读，后台保存仍需管理员会话与 CSRF。声线参数的实际播放消费由 #14 继续处理。

设计、验收和截图见 [展示配置说明:L1](docs/display_config.md#L1)。此功能分支依赖认证PR #15，合并顺序与当前目标分支在PR中说明。
Python 只用于可选检查脚本与 CI，网页项目运行不依赖 Python、Node.js 或 Docker。当前已有 Java 服务测试（ChatService、KnowledgeService、SpotService 及自然检索/聊天，共 64 个用例）和 Python 数据检查测试；自动检查验证 Maven 构建与单测、知识/景点数据结构、文档链接和本地启动后的页面/接口/模型资源。结构检查通过不代表景区事实已核验，详见 [知识数据完整性方案](docs/knowledge_integrity.md#L1)。

## 当前边界

知识检索是字符串匹配，推荐路线由预设规则生成，语音主要使用浏览器或 Android 系统能力。知识库与景点资料是未核验的课程示例，价格、开放时间、交通等变动信息以景区公告为准。Haru 是示例角色，最终角色素材与课设创意尚未定案。Android APK 本次未验证构建。

压缩包中的编译产物、个人 IDE 配置、真实接口 Key、历史账号和交互记录未提交。具体处理见 [导入记录](docs/import_manifest.json)。

## 自然提问与可追溯候选（#10）

支持“大佛”“梵宫”等人工别名和原知识关键词，多景点提问分配相关资料，未命中时明确提示补充名称。回答附本地资料 K编号，API带knowledgeReferences；这些是候选参考，不是官方或已核验来源。详见 [自然检索设计](docs/natural_retrieval.md#L1)。本分支接在知识修复PR #21之后，其他未合并功能不自动包含。


语音设置现在作用于实际Web播报，支持音量0、语速和设备中文声线；旧声线设置及Android限制有明确回退说明，见 [语音设置](docs/voice_settings.md#L3)。


新增“游览导演”：按时间、同行人、兴趣生成解释明确的课设方案，减半/雨天可重编排；可进入观察任务，保留已有草稿。游客首页同步改善，见 [设计与验收](docs/director_design.md#L3)。

方案可以逐站准备数字人讲解，回答旁可展开本次检索提供的参考候选；不代表到访或逐句事实核验。交互、边界与验收见 [游览讲解衔接与候选](docs/journey_references_design.md#L1)。

导游追问卡在每次景点讲解后提供抓重点、生活比喻和观察细节的问题草稿。交互和验收见 [设计](docs/followups_design.md#L1)。

跨景点主题讲解以一个问题串起三站，离线可运行，联网增强表达与追问，本页回顾以成功收到的主题讲解为依据。见 [REQ-052设计](docs/superpowers/specs/2026-11-05-theme-guide-design.md#L1)。
