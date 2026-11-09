# 燕小北校园助手Demo实施计划

> For agentic workers — 使用Superpowers子代理开发流程执行任务，读本计划及设计后再实现。用户已确认设计稿并要求拆任务开工，独立模块可在下列接口冻结后并行，最终统一审查。

**Goal**

交付可运行的校园Web首版，覆盖补卡找路、图书馆用途与实景、饭点前台邀约三个闭环。

**Architecture**

校园模块使用独立目录与API，沿用Java8、Spring Boot、现有同源认证与语音。前端采用独立校园页面及纯状态模块，通过统一轮次呈现场景。校园业务先使用核验资料，联网模型、天气和外部地图通过受控适配器增强。

**Tech Stack**

Java8、Jackson、Spring Boot 2.7、原生HTML/CSS/JavaScript、JUnit5、Node test。开发分支为codex/bjut-campus-demo。

**Spec**

[已确认设计](../specs/2026-11-09-campus-assistant-design.md#L1)与[研究事实](../../bjut_campus_research.md#L1)。

## Global Constraints

- 建议共4～6项，含2～4个具体建议、继续追问和自定义。
- 前台可见时先气泡询问，用户回应后进入普通对话。
- 开场人物居中主动问好，随后底部对话自动出现。
- 已核实的一卡通服务点为学综楼4层一站式服务大厅1—3号窗口，坐标未核验保持未知。
- 原始素材保留来源及许可状态，照片接入前检查像素，课堂情境持续标注模拟时间和位置。
- 原有工作区三份未提交文档由根代理保护，开发目录为独立worktree。

## Review Focus

- 初次未选择校区的自然提问需要消歧，明确校区后沿用上下文。
- 取消和新对话使迟到服务端结果失效，显式重试同请求不重复提交。
- 旧推荐和图片迟到不能恢复先前场景，静音由实际环境确认。
- 地点坐标、营业时间与评分缺失时保持可用信息及明确状态。
- HTTP、定位、天气或媒体失败后草稿保留，主动提示不抢占任务。

## 冻结接口

资源`campus/catalog.json`包含`version/campuses/places/tasks/assets`。地点字段使用`id/campusId/name/aliases/category/summary/address/sourceUrl/verifiedAt/coordinateStatus/coordinates/assetIds`。事项含`id/name/aliases/variants`，变体含`id/campusId/audiences/steps/placeId/sourceUrl/unknownFields`。资源含`id/placeId/path/alt/sourceUrl/license`。

Java包为`com.guide.campus`。`CampusCatalog.snapshot()`返回深拷贝ObjectNode，`place(String id)`、`campus(String id)`、`task(String id)`返回找到的ObjectNode深拷贝或null，`searchPlaces(String query,String campusId)`返回List<ObjectNode>。目录加载时校验ID与引用。校区ID固定为pingleyuan、tongzhou、guanzhuang、liulijing、huixin-east，地点与事项使用目录稳定ID。

API采用`GET /api/campus/catalog`、`GET /api/campus/context`、`POST /api/campus/chat`、`POST /api/campus/new`、`POST /api/campus/cancel`、`GET /api/campus/weather`。POST沿用AuthGuard同源CSRF传输。

上下文快照含`conversationId/contextRevision/campusId/placeId`。聊天请求含`requestId/conversationId/contextRevision/message/campusId/placeId/audience/origin/context`，其中context为位置、时间、模拟和天气的有界快照。origin使用`user/choice/proactive_accept`。

聊天返回`conversationId/turnId/contextRevision/reply/speech/mode/sceneAction/choices/references/context`。`sceneAction`含`type/placeIds/taskId/title`，type使用设计允许列表。choices含`id/label/message/kind`，kind为`ask/followup/custom`。references含`title/url`，mode为`local/deepseek/local-fallback`。校区不明时回复追问并提供校区选项，用户自由输入继续有效。

取消请求含`conversationId/requestId`，新对话接口返回新上下文。所有历史和上下文写入以轮次版本为提交依据。

`CampusWeatherService.current(Double latitude,Double longitude)`返回ObjectNode，字段为`status/label/temperatureC/weatherCode/time/fetchedAt/provider/sourceUrl/stale`。位置为空时查询标明为北京市区的天气。模拟天气仅由演示上下文提供并明确标识。

前端纯陪伴模块`CampusCompanion.create(options)`提供`update(snapshot)/offer()/accept(offerId)/dismiss()/reset()/setEnabled(boolean)`。snapshot含`visible/busy/contextRevision/campusId/placeId/position/hour/simulated/quiet`，position含WGS84经纬度、accuracy、timestamp、source和可确认placeId。offer返回`id/message/placeId/messageToSend/expiresAt`或null。options允许注入时钟和核验后区域数据。

## Task 1 校园事实目录

文件由资料实现者负责。

- 新增`src/main/java/com/guide/campus/CampusCatalog.java`。
- 新增`src/main/resources/campus/catalog.json`。
- 新增`src/test/java/com/guide/campus/CampusCatalogTest.java`。

- [x] 编写失败测试，断言五个现行校区、同名图书馆校区区分、迁址窗口及未知坐标、资源关联完整、返回值修改不污染原目录。
- [x] 运行目标JUnit，确认缺少实现时失败。
- [x] 实现上述冻结接口，收录本部和通州已核实地点、事务变体与图片来源，费用及营业状态保持资料实际状态。
- [x] 运行目录测试并记录结果，交根代理审查。

## Task 2 前台上下文与主动邀约

文件由情境实现者负责。

- 新增`CampusWeatherService.java`、`CampusWeatherController.java`及对应JUnit。
- 新增`static/js/campus-companion.js`及`tests/frontend/campus-companion.test.js`。

- [x] 编写气泡暂缓、接受、关闭、过期、冷却、位置抖动、后台恢复和静音场景测试。
- [x] 实现冻结的纯状态接口，使用设计中的30秒时效、40米精度、30秒停留、100/150米边界、10分钟冷却及同饭点去重，未知坐标仅接受明确位置来源。
- [x] 实现Open-Meteo有界请求和10分钟缓存，支持注入HTTP替身，失败返回可辨认状态。
- [x] 运行对应Node和JUnit，交根代理审查。

## Task 3 统一轮次与DS工具

文件由对话实现者负责。

- 新增`CampusAssistantController.java`、`CampusAssistantService.java`及所需有限模型编排类，均位于上述校园包。
- 按需扩展`service/AiCompletionClient.java`，复用已有传输与超时。
- 新增`CampusAssistantTest.java`及HTTP契约测试。

- [x] 编写失败测试，断言卡丢失、图书馆用途、饭点建议、体育签到消歧和校区上下文。
- [x] 编写并发取消、新对话、同请求重试、旧版本、未知数据ID及模型故障测试。
- [x] 实现GET目录/上下文、POST聊天/新对话/取消。用户消息限制2000字，工具最多三轮，数据和动作通过目录校验。
- [x] 实现真实DeepSeek兼容工具调用，工具为find_places/find_tasks/get_place/get_weather/preview_route/get_dining_candidates。先使用目录候选，返回同一结构化轮次，模型最终文字依据工具资料组织。
- [x] 使用本机HTTP模型替身验证工具调用往返，未配置密钥时本地三场景可完整演示。
- [x] 运行目标JUnit及现有模型客户端测试，交根代理审查。

## Task 4 校园人物舞台与场景

文件由前端实现者负责。

- 新增`static/campus.html`、`static/css/campus.css`、`static/js/campus.js`及所需纯场景模块。
- 新增`static/media/campus/`中经视觉检查的角色与实景素材，路径与目录资源清单一致。
- 新增`tests/frontend/campus-page.test.js`。

- [x] 按真实页面入口编写失败测试，覆盖初始舞台、自动出现输入、对话场景、总计4～6项、旧响应与图片隔离。
- [x] 使用现有AuthGuard与GuideSpeech接入API、声音、回听和打断，底部对话持续保留，页面可键盘操作且支持减少动态效果。
- [x] 获取并检查官方角色及图书馆等图片，保留来源。人物二维轻动效，实景按当前地点淡入。
- [x] 接入前台定位、服务端天气、地图/办事/地点预览和显式外部地图搜索，实际坐标核验状态可见。
- [x] 接入主动纯状态和模拟轨迹控制，模拟入口位于对话后的控制区，支持退出并重新定位。
- [x] 运行目标Node测试、浏览器手机/桌面实测并修复可复现问题。

视觉方案采用雨燕形象与校园光线。基色纸白#F3F6FA、墨蓝#183B66、晴空#A8D8EE、羽灰#52677C和燕喙橙#E6A15C。中文正文优先系统黑体，人物名使用较舒展字距。空场景以人物为中心，展开后内容左对齐，实景柔化后承载角色，避免装饰性数据卡占据开场。

## Task 5 集成、议题与交付

- [x] 运行完整Maven verify、Node前端、数据检查、文档链接检查与HTTP冒烟。
- [x] 通过真实HTTP从口语提问走完三个场景，并验证取消、新会话及明确位置未知时继续问起点。浏览器拒绝定位由根代理实测。
- [x] 更新需求、API、配置、测试、程序索引与运行说明，按实际行号记录本轮验证。
- [ ] 为各阶段建立可追踪GitHub议题，完成项与后续餐饮评分、坐标实地核验、跨校区资料扩充分别列出。
- [ ] 独立执行规格与代码审查，修复实际发现，保存可运行Demo并提供启动方式。

## 后续独立计划

高德周边真实餐饮评分、具体菜品近期口碑、建筑入口与路网实地采样、更多校区办事细节、原生App后台和小程序适配分别在本次统一接口上扩充。每项以实测数据和独立验收推进。


## 2026年11月9日Task5集成记录

Task1～4已实现并经根代理分阶段复审。Task5 worker补充到馆与馆外语言回归，复用既有HTTP脚本加入 `verify_campus(base)`，完成本轮负责文档。GitHub更新、独立最终审查、交付包和PR由根代理收尾，上方对应复合事项保留待完成状态。[运行手册](../../campus_demo_runbook.md#L1)、[真实HTTP入口](../../../scripts/smoke_teacher_project.py#L76)

| 检查 | worker亲自运行结果 |
|---|---|
| 到馆表达TDD | 新增单项RED1失败、GREEN1通过 |
| 馆外/离馆/假设TDD | 三项RED3失败，全部CampusAssistantTest22项通过 |
| 允许场景动作TDD | RETURN_STAGE、SHOW_MAP空地点、SHOW_WEATHER各自RED1失败、GREEN1通过 |
| Maven离线nofork verify | 304项，0失败/错误/跳过，BUILD SUCCESS |
| Node全部前端 | 276项通过，0失败 |
| Python数据脚本 | 结构检查通过，44项测试通过 |
| Python语音工作进程 | 3项通过 |
| 扩展隔离JAR HTTP | 旧景区保留检查与校园13组检查通过，5校区/26地点/8素材 |
| 旧JAR负向检查 | 在未知健身房清目的地断言退出1，素材检查尚未运行 |

本机使用JDK19、绝对Maven、`-o -DforkCount=0`，socket/atomic-file测试使用已授权提升环境。新增语言规则支持“我已经在图书馆内”，排除馆外、门口、附近和假设句，明确离馆清 `position:null` 并保留主题与导航目的地。[回归测试](../../../src/test/java/com/guide/campus/CampusAssistantTest.java#L192)

本轮采用独立校园入口与打包目录，旧景区和管理端继续保留。前台事件首版覆盖饭点和图书馆用途，教学区离开与校门由后续#61推进。入口坐标、真实评分、更多跨校区资料、真手机GPS与真实模型Key继续单独验收。[实施差异](../specs/2026-11-09-campus-assistant-design.md#L1)


Task5第一轮独立复审补充三条位置回归，未来条件“等我进入图书馆再静音”保持物理证据时点，“图书馆的外面/门口”清除馆内确认并保留目的地。离线规则限定句首或标点子句起始的明确当前声明，模型回答增强继续遵守应用位置边界。[回归与命令](../../test_reference.md#L269)
