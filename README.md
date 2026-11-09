# 燕小北校园助手 · 三人课设

当前课程原型面向北工大新生与来校访客，校园入口为 [燕小北校园助手](http://localhost:8080/campus.html)。从“卡丢了”“去图书馆”“午饭吃什么”连续对话进入办事、实景和地点预览。[三段演示与运行手册](docs/campus_demo_runbook.md#L1)

校园模块使用独立的打包目录和 `/api/campus/*`。五个现行校区、26个地点、7个事项共19个变体、8项素材已有来源记录。本部重点地点和通州已核实服务可查询，其他校区先展示校区资料。学校已有同名助手，本项目标记课程原型。[产品范围](PRODUCT.md#L1)、[事实与来源](docs/bjut_campus_research.md#L1)

## 技术结构

- Spring Boot 2.7.18，Maven，源码目标 Java 8，团队推荐 JDK 17。
- 校园页使用原生 HTML/CSS/JS 和二维燕小北素材，人物、对话、场景持续联动。
- 校园 JSON 目录打包进 JAR。旧景区数据、`/index.html` 与管理端继续独立运行。
- Android 保留 Kotlin、WebView 和原生语音桥接源码，后续单独构建和真机验收。

## 第一次加入

- [校园演示手册](docs/campus_demo_runbook.md#L1)
- [可转发给组员与 AI 的手册](docs/team_join_guide.md#L1)
- [环境与启动指南](docs/team_setup.md#L1)
- [分支、提交与评审](CONTRIBUTING.md#L1)
- [导入来源](UPSTREAM.md#L1)与[程序索引](docs/program_index.md#L1)

## 启动网页项目

准备 JDK 17 和 Maven，在仓库根目录执行。

```powershell
mvn clean package
java -jar target/ai-guide-1.0.0.jar
```

打开 [校园页](http://localhost:8080/campus.html)。旧版入口为 [景区页](http://localhost:8080/index.html)、[登录页](http://localhost:8080/login.html)和[管理页](http://localhost:8080/admin.html)。IDEA 可打开 `pom.xml` 后运行 `com.guide.GuideApplication`。

默认空 Key 可运行三个本地业务闭环。需要模型增强时，在启动终端设置自己的凭据，Spring Boot 读取环境变量。普通 `.env` 文件需自行加载。

```powershell
$env:DEEPSEEK_API_KEY = '替换为自己的Key'
$env:DEEPSEEK_MODEL = 'deepseek-flash'
java -jar target/ai-guide-1.0.0.jar
```

Key 只放启动环境。本机已验证 JDK 19、绝对 Maven 路径和离线 nofork 构建，命令见[运行手册](docs/campus_demo_runbook.md#L1)。

## 管理员入口与本地管理员账号

旧管理端需要 ADMIN 身份，同时设置 `APP_ADMIN_USERNAME` 和至少8位的 `APP_ADMIN_PASSWORD` 才初始化管理员。已有管理员保留密码，已有游客用户名冲突会导致明确启动失败。会话默认30分钟过期。凭据、用户数据和本机日志按仓库规则排除。[权限实现](src/main/java/com/guide/config/SecurityConfig.java#L36)、[账户初始化](src/main/java/com/guide/service/UserService.java#L59)

## 验证

```powershell
mvn verify
node --test tests/frontend/*.test.js
python -X utf8 scripts/check_data_integrity.py
python -X utf8 scripts/test_data_integrity.py
python -X utf8 scripts/check_doc_links.py
python -X utf8 -m unittest discover -s tests -p test_local_voice_server.py
python -X utf8 scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar
```

2026年11月9日本轮验证为304项Java、276项前端、44项数据脚本测试、3项语音工作进程测试通过，隔离JAR HTTP冒烟覆盖校园与旧景区入口。Python和Node只供可选检查，网页运行使用Java。[测试方法与证据边界](docs/test_reference.md#L1)

## 当前边界

建筑入口坐标与步行路网待核验，地图提供本部校区边界及地点地址预览，高德搜索由用户明确打开。天气显示来源和天气资料时间，失败显示暂不可用或上次资料。真实餐饮评分、菜品价格和营业状态待补充。主动陪伴首版覆盖饭点与图书馆用途，教学区离开和校门事件列入后续。[演示和待验项目](docs/campus_demo_runbook.md#L1)

当前本机未配置真实DeepSeek Key。自动工具调用使用真实HTTP替身，系统声音取决于浏览器手势、设备中文声线和权限，角色声线依赖独立本地服务及登录。燕小北为官方低清图的AI辅助二维重建，原始许可记录为 `upstream-unspecified`。[素材记录](src/main/resources/static/media/campus/SOURCES.md#L1)、[角色语音运行手册](docs/local_voice_runbook.md#L1)

## 景区历史版本与演进

老师提供的“软件杯7.16.rar”为Java演进基线，Python/Vue旧版保留于 `baseline-lingtour-20261019`。以下功能记录归属景区页，部分段落保存了当时的分支与测试状态。当前校园进展以[产品范围](PRODUCT.md#L1)、[运行手册](docs/campus_demo_runbook.md#L1)和[议题进度](docs/issue_progress.md#L1)为准。

### 多轮导览对话

游客现在可以在当前景点连续追问，并用“新对话”清除上下文。会话保存在当前浏览器对应的服务端 Session，闲置 20 分钟过期，最多保留六轮问答。接口、限制与验证见 [会话隔离与景点上下文](docs/conversation_context.md#L3)。

景点详情现在可点击“问问 AI 导游”选择景点，再主动提问；关闭后保留选择，“新对话”回到通用导览。见 [入口与验证](docs/spot_chat_entry.md#L3)。



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
系统声音模式只需Java；可选角色声线还需要独立Python/CUDA服务，见[启动手册](docs/local_voice_runbook.md)。当前已有 Java 服务测试（ChatService、KnowledgeService、SpotService 及自然检索/聊天，共 64 个用例）和 Python 数据检查测试；自动检查验证 Maven 构建与单测、知识/景点数据结构、文档链接和本地启动后的页面/接口/模型资源。结构检查通过不代表景区事实已核验，详见 [知识数据完整性方案](docs/knowledge_integrity.md#L1)。


## 自然提问与可追溯候选（#10）

支持“大佛”“梵宫”等人工别名和原知识关键词，多景点提问分配相关资料，未命中时明确提示补充名称。回答附本地资料 K编号，API带knowledgeReferences；这些是候选参考，不是官方或已核验来源。详见 [自然检索设计](docs/natural_retrieval.md#L1)。本分支接在知识修复PR #21之后，其他未合并功能不自动包含。


语音设置现在作用于实际Web播报，支持音量0、语速和设备中文声线；旧声线设置及Android限制有明确回退说明，见 [语音设置](docs/voice_settings.md#L3)。


新增“游览导演”：按时间、同行人、兴趣生成解释明确的课设方案，减半/雨天可重编排；可进入观察任务，保留已有草稿。游客首页同步改善，见 [设计与验收](docs/director_design.md#L3)。

方案可以逐站准备数字人讲解，回答旁可展开本次检索提供的参考候选；不代表到访或逐句事实核验。交互、边界与验收见 [游览讲解衔接与候选](docs/journey_references_design.md#L1)。

导游追问卡在每次景点讲解后提供抓重点、生活比喻和观察细节的问题草稿。交互和验收见 [设计](docs/followups_design.md#L1)。

跨景点主题讲解以一个问题串起三站，离线可运行，联网增强表达与追问，本页回顾以成功收到的主题讲解为依据。见 [REQ-052设计](docs/superpowers/specs/2026-11-05-theme-guide-design.md#L1)。

### 本地角色声线（#50）

已接入逐句角色配音、预取、停止/打断、嘴型和回听；语音服务不可用时自动回退系统中文声音。文字先显示，不等待配音。启动与切换见[运行手册](docs/local_voice_runbook.md)，素材权重单独准备，不包含在Git仓库中。
