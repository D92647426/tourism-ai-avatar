# 燕小北校园Demo运行手册

2026年11月9日。校园页为北工大课程原型，适配桌面与手机浏览器。日常入口为 [校园页](http://localhost:8080/campus.html)，本机本轮打包预览为 [18089校园页](http://127.0.0.1:18089/campus.html)。预览进程由根代理管理，换机时按下列步骤重新启动。

## 启动与配置

推荐JDK17和Maven，在仓库根目录执行。

```powershell
mvn clean package
java -jar target/ai-guide-1.0.0.jar
```

未设置模型Key时使用标明模式的本地回答。模型增强可在同一终端配置后重启。

```powershell
$env:DEEPSEEK_API_KEY = '替换为自己的Key'
$env:DEEPSEEK_MODEL = 'deepseek-flash'
java -jar target/ai-guide-1.0.0.jar
```

凭据放启动环境，普通 `.env` 需自行加载。排查时可临时用 `java -jar target/ai-guide-1.0.0.jar --ai.api-key=` 强制本地模式。默认端口8080，端口被占用时用 `--server.port=18090` 并同步浏览器地址。[配置入口](../src/main/resources/application.yml#L1)

本机验证环境为JDK19与IDEA附带Maven，依赖已有本地缓存，离线nofork为该环境的验证方式。

```powershell
$env:JAVA_HOME = 'C:/Program Files/Java/jdk-19'
& 'D:/DevTools/IntelliJ IDEA 2025.3.1/plugins/maven/lib/maven3/bin/mvn.cmd' -o -DforkCount=0 verify
& 'C:/Program Files/Java/jdk-19/bin/java.exe' -jar target/ai-guide-1.0.0.jar
```

校园页读取独立打包目录。`/index.html`、`/admin.html`、`data/knowledge.json`等仍归属旧景区模块，管理员导入景区知识时校园目录继续使用打包内容。更新校园事实需修改目录、跑校验并重新构建。[目录加载](../src/main/java/com/guide/campus/CampusCatalog.java#L34)

## 首屏与通用操作

进入后燕小北居中问好，底部输入区自动展开。发送消息后人物移到侧边，办事、地点或地图在主场景显示。底部持续保留输入、建议、来源、回听和停止声音。当前建议面板共4～6项，校区选择含自定义入口。自定义聚焦输入框，继续追问沿用本次条件。

“获取位置”会请求设备权限，拒绝后可输入校区和地标。“新对话”清除本次条件并回到人物舞台，等待中可取消或重试。重试保留请求身份，旧响应和旧选项受版本隔离。[页面入口](../src/main/resources/static/campus.html#L1)、[发送与提交](../src/main/resources/static/js/campus.js#L118)

## 教师演示一　卡丢了

1. 点击“新对话”，输入“我的校园卡丢了，去哪补”。助手追问校区。
2. 选择平乐园，展示一卡通步骤及学综楼四层一站式服务大厅1—3号窗口。展开来源核对现行迁址资料，费用、材料和具体营业时间按未知项展示。
3. 点击“带我过去”，助手询问起点。输入“我在四教”，显示从第四教学楼到办卡窗口的地址预览。
4. 地图显示本部校区边界与地点资料。点击“在高德搜索这个地点”后再核对目标，建筑入口坐标、路网与步行耗时仍需现场核验。
5. 输入“健身房在哪”，原办卡目的地清除。再次“带我过去”会要求补充目标。

验证入口为 [事项回答](../src/main/java/com/guide/campus/CampusLocalAnswers.java#L197)和[路线回归](../src/test/java/com/guide/campus/CampusAssistantTest.java#L39)。

## 教师演示二　图书馆有什么可做

1. 新对话，输入“平乐园，我是访客，图书馆能做什么”。展示逸夫图书馆外观和用途选项。
2. 选择“安静学习”，查看访客提前申请批准备案、身份证登记以及校友证件规则。入校、入馆和借阅分别展示规则或未知项。
3. 点击查看实景，外观图仅说明拍摄视角。页面可打开官方一层布局图，室内具体入口、实时空位和当日开放时间待核验。
4. 输入“我已经在图书馆内”，状态显示已确认在逸夫图书馆，按钮显示“安静环境已静音”，当前外放停止。
5. 输入“我在图书馆外面”，位置恢复未确认，声音按用户原设置恢复。图书馆主题和导航目的地继续保留。输入“如果我在图书馆”或“我想去图书馆”仅更新对话内容。

离线位置规则识别句首或标点子句起始的明确当前声明，如“我在”“我到了”“我已经进入”。规则复用目录别名，支持“图书馆的外面/门口”清除馆内确认，“等我进入图书馆再静音”等未来条件保持原物理证据及时间戳。确认只记录地点ID、来源和确认时点。模型可增强意图与回答，物理位置仍由应用规则和显式终端快照处理。[馆内外识别](../src/main/java/com/guide/campus/CampusLocalAnswers.java#L259)、[状态接入](../src/main/resources/static/js/campus-environment.js#L147)

## 教师演示三　午间轻声邀约

1. 新对话，打开“情境演示”，选择“午间来到北区餐厅”。屏幕持续显示模拟时间、模拟位置和模拟天气。
2. 模拟在1秒后加速30秒停留，空闲时出现轻声气泡。输入草稿、识别、等待、播报或回听时气泡暂缓。
3. 点击“好，看看吧”，气泡进入普通对话并展示本部餐饮候选，建议包含继续追问和自定义，总数4～6项。
4. 选择实际食堂建议，进入对应地点预览，再按需查看路线。营业时段、价格和评分分别显示资料状态。
5. 重新打开“情境演示”并点“退出模拟”。模拟事件与位置清除，页面重新请求真实定位。拒绝后当前位置未确认，找路会询问起点。

“来到图书馆”使用同一模拟生命周期演示到馆用途。模拟仅用于课堂复现，正式陪伴需要页面可见、用户开启及有效位置证据。[模拟入口与退出](../src/main/resources/static/js/campus-environment.js#L120)、[陪伴规则](../src/main/resources/static/js/campus-companion.js#L16)

## 模型、声音与环境边界

模型默认 `deepseek-flash`。校园六个受控工具为地点查询、事项查询、地点详情、天气、路线预览和餐饮候选，最多三轮、每轮六次工具调用，整次前台期限20秒，故障使用本地资料。当前真实DeepSeek Key待提供后另验，自动工具往返使用真实本机HTTP替身。[编排边界](../src/main/java/com/guide/campus/CampusModelOrchestrator.java#L18)

系统声音需浏览器允许自动播放及设备中文声线，首次手势后可点回听。语音输入需要麦克风权限和浏览器识别支持，失败后直接打字。公开配置只消费声线、音量、语速。选择角色声线需启动独立本地语音服务并登录，服务不可用会回退系统声音。真实GPU、手机声音、麦克风与Android桥接继续按设备验收。[声音适配](../src/main/resources/static/js/campus-voice.js#L4)、[角色语音手册](local_voice_runbook.md#L1)

全部建筑入口坐标未知，GPS只报告设备位置与精度，建筑身份采用明确用户确认或模拟。饭点规则使用上海时间、30秒位置时效、40米精度、30秒停留与两次至少相隔20秒采样，已核验区域接入前使用确认地点。真实地图距离、路网导航、餐饮评分、教学区离开和校门事件列为后续，跨校区事项随资料逐项补齐。[设计规则](superpowers/specs/2026-11-09-campus-assistant-design.md#L70)

天气接Open-Meteo，10分钟缓存，显示天气资料时间、获取时间与陈旧状态。根代理记录本机2026年11月9日一次实际请求可达，天气资料时间18点30分、6℃，以后以界面当次状态为准。[天气实现](../src/main/java/com/guide/campus/CampusWeatherService.java#L57)

## 来源与素材

- [学校现行校区简介](https://www.bjut.edu.cn/xxgk/xxjj1.htm)
- [图书馆入馆须知](https://lib.bjut.edu.cn/info/1147/1005.htm)与[服务时间](https://lib.bjut.edu.cn/tsggk/fwsj.htm)
- [官方校园图集](https://admissions.bjut.edu.cn/xysh/bgdyx/xydt.htm)
- [事实核验与一卡通迁址来源](bjut_campus_research.md#L1)
- [角色及实景来源记录](../src/main/resources/static/media/campus/SOURCES.md#L1)

燕小北采用官方低清图AI辅助透明二维重建，完整prompt与生成方式留在素材记录，许可 `upstream-unspecified`。本部地图边界来自OpenStreetMap并带ODbL署名，官方布局图按自身来源打开。

## 检查与证据

```powershell
node --test tests/frontend/*.test.js
python -X utf8 scripts/check_data_integrity.py
python -X utf8 scripts/test_data_integrity.py
python -X utf8 scripts/check_doc_links.py
python -X utf8 -m unittest discover -s tests -p test_local_voice_server.py
python -X utf8 scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar --port 18090
```

HTTP脚本接收 `--jar`、`--java`、`--port`、`--timeout`，默认Java命令java、端口18080、启动期限60秒。输入为打包JAR，输出检查结果JSON，成功退出0，失败退出1。脚本用临时数据及空模型Key启动并停止自己的进程，端口占用会明确失败。失败先查输出断言与服务器日志，再核对JAR是否重建。[复用HTTP入口](../scripts/smoke_teacher_project.py#L76)

本轮worker亲自执行304项Java、276项前端、44项数据和3项Python语音测试，均通过，HTTP冒烟通过5校区、26地点和8素材。旧回归JAR在“未知健身房清目的地”业务断言失败，证明新冒烟可检出已知问题。最终PR与交付包以根代理独立复审记录为准。[测试索引](test_reference.md#L1)

根代理已在1440×1000与390×844执行真实点击，并在最新打包JAR复验馆内静音与馆外恢复。页面使用空Key和真实同源HTTP。自动无障碍检查为0项violations，另有1类10节点对比度需人工判断，根代理已目视复核，本次继续保留人工设备验收。

[桌面图书馆](screenshots/campus-desktop-library.png) · [手机图书馆](screenshots/campus-mobile-library.png) · [手机邀约](screenshots/campus-mobile-offer.png) · [手机餐饮](screenshots/campus-mobile-dining.png) · [手机布局图](screenshots/campus-mobile-floorplan.png)

手机实地GPS、真实DeepSeek Key、地图导航结果、系统声音与本地GPU声线仍待对应环境复验。


## 根代理复核与实施取舍

根代理在最终分支修复后独立运行完整Maven verify，312项Java全部通过，0失败、0错误、0跳过，耗时24.162秒。前端285项、数据44项、Python语音3项、结构与链接检查均通过，最新打包服务的13组校园HTTP检查再次通过。nofork模式保留Maven关于useSystemClassloader无效的环境警告。语音套接字与服务存活检查使用具备本机可见性的环境复验，避免沙箱权限造成误判。

真实浏览器还验证了844×390横屏无横向溢出、减少动态效果时角色transition为0秒，以及输入框Tab后焦点进入语音按钮。当前用户预览服务从target/campus-demo/app.jar运行，使用空模型Key，完整启动命令见本手册开头。

本轮实施采用以下取舍，后续可通过独立提交调整。

1. 沿用户已批准的书面设计连续拆任务实施，版本差异通过功能分支与评审追溯。
2. 在项目父目录使用独立tourism-ai-avatar-campus工作树，方便本次改版与本机演示定位。该目录由Git直接管理。
3. 先完成位置天气与陪伴接口，再接入依赖这些接口的模型工具，保持每个阶段可编译验证。
4. 官方校园总图返回403后，采用已读取的OpenStreetMap校区范围与官方图书馆一层布局。入口和道路精度由[后续坐标核验议题](https://github.com/D92647426/tourism-ai-avatar/issues/59)继续补齐。
5. 首个三场景Demo通过独立campus.html和打包校园目录交付。默认首页及校园资料后台的完整切换由[迁移议题](https://github.com/D92647426/tourism-ai-avatar/issues/62)承接，当前修改校园JSON后需重新构建。
6. 将普通对话版本与物理证据版本分开，并增加“我仍在这里”显式复核。代价是人工确认场景需要复核操作，自动到楼感知继续依赖区域核验。
7. 为修掉审查遗留的错误导航，额外完成一次范围限定的照片切换修复和复核。代价是增加了这轮验证时间。
8. 总服务台的父馆外观关联记录为[后续小修](https://github.com/D92647426/tourism-ai-avatar/issues/63)。代价是该服务点目前显示暂无照片，具体业务与导航目标仍可用。

[人物透明素材](../src/main/resources/static/media/campus/yanxiaobei.png)采用内置image_gen进行AI辅助二维重建，边缘与面部部分细节由模型重构。[完整提示词与处理记录](../src/main/resources/static/media/campus/processing.json#L1)随项目保存，素材来源及许可状态见[来源清单](../src/main/resources/static/media/campus/SOURCES.md#L1)。


## 最终复审补齐的普通操作

在补卡路线中直接问“图书馆怎么走”切换到图书馆，随后“补卡怎么走”重新按当前校区及人群选择办卡窗口。“我在四教”继续只作为实际起点。模型推荐餐厅后直接点击实际返回的餐厅选项，后续“带我过去”使用选中的餐厅。[导航顺序](../src/test/java/com/guide/campus/CampusAssistantTest.java#L75)、[HTTP模型闭环](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L138)

“我在多媒体阅览区”等馆内分区确认与图书馆一样进入静音。输入“我已经出馆了”清除实际地点，保留正在浏览的主题与目标。[离馆规则](../src/main/java/com/guide/campus/CampusLocalAnswers.java#L270)、[页面静音](../tests/frontend/campus-page.test.js#L78)

真实陪伴可先开启再声明“我在平乐园北区餐厅”，等待20秒，在位置状态旁点击“我仍在这里”。继续停留到首次有效确认满30秒，饭点出现气泡，点击接受后才发送正式问答。先声明后开启、后台恢复或证据过期时，请重新点击两次真实确认，两次相隔至少20秒，再满足30秒停留。每次点击都应符合当前实际位置，界面定时器仅刷新状态。草稿、请求、识别和播报期间复核与邀约暂缓。图书馆采用相同复核流程并保持静音。[显式复核和边界回归](../tests/frontend/campus-page.test.js#L7)、[证据时效规则](../src/main/resources/static/js/campus-companion.js#L78)


补卡之后输入“看看图书馆实景”，浏览主题和后续导航目标切换为图书馆，旧补卡事项清除。再说“带我过去”先确认起点，输入“我在四教”后预览到图书馆的路线。当前业务地点照片，以及公共电脑等具体服务区借用父馆外观时，仍保留原服务区目标。[离线照片切换回归](../src/test/java/com/guide/campus/CampusAssistantTest.java#L149)、[模型原样增强回归](../src/test/java/com/guide/campus/CampusModelHttpTest.java#L217)


根代理在非模拟模式使用人工地点声明，实际等待20秒后点击“我仍在这里”，到30秒停留后接收图书馆气泡，再接受并展开用途与实景。正式用户消息在接受后增加，馆内保持静音。该检查验证浏览器正常交互，手机实地GPS单独验收。[实际复核界面](screenshots/campus-real-recheck.png)

最终包还从真实输入框重复验证“平乐园补卡→看看图书馆实景→带我过去→我在四教”，实际回复和预览目标均指向逸夫图书馆。来源、许可与设备边界以本手册上述记录为准。

本次交付提交在[PR #64](https://github.com/D92647426/tourism-ai-avatar/pull/64)，合并状态与自动检查以PR页面为准。已实现与后续工作见[议题进度](issue_progress.md#L1)。
