# AR、分支故事与全景：官方来源核查

核查日期：2026-11-02。范围为选型研究，未下载或接入这些库，未做真机或性能验收。下述“建议接法”是本项目设计判断，和上游已有功能分开表述。衔接基础为 [PR #32 的游览导演与观察体验](https://github.com/D92647426/tourism-ai-avatar/pull/32)、[观察内容包与记录](../exploration_design.md#L3)；前者是否合并以 PR 页面为准。

## 优先判断

建议先用 inkjs 做一幕包含三个决策节点、两种结局的“证据导览故事”：游客选择解释、收集可追溯线索、修正判断，数字人负责追问。第二步才接 MindAR，把印刷证据卡变成故事的入口；第三步在取得合适且可使用的全景素材后接 Pannellum。这样课堂能完整演示，扫描失败也能手动继续。这里的“结局”是游客做出的讲解方案，不是擅自编造历史真相。

## MindAR：扫描预先制作的证据卡

- 官方仓库：[hiukim/mind-ar-js](https://github.com/hiukim/mind-ar-js)；支持图像和人脸跟踪，浏览器通过 WebGL GPU 和 worker 运算。基础跟踪不需要云端付费大模型；设备仍需可用摄像头和图形能力。不是通用建筑识别、GPS 导航或任意物体重建器，仓库把位置/标记跟踪另指向 AR.js。
- [官方快速入门](https://hiukim.github.io/mind-ar-js-doc/quick-start/overview/)展示静态 HTML 中识别指定图像并叠加对象；[目标编译文档](https://hiukim.github.io/mind-ar-js-doc/quick-start/compile/)要求预先提取图像特征并生成 `.mind`，且特征数量及分布会影响目标选择。因此应先制作两张特征丰富的原创证据卡，不能承诺拿现有三视图就能稳定追踪。
- [安装文档](https://hiukim.github.io/mind-ar-js-doc/installation/)提供 A-Frame 和 Three.js 接法；Three.js 的现行示例使用 ES Module，A-Frame 也提供普通 script 接法。建议放在独立 AR 页面，按需加载固定版本，先不让它和首页 Live2D 同时抢占图形资源。后一句是本项目的资源管理决定，未做性能测量。
- [官方 Three.js 适配源码](https://github.com/hiukim/mind-ar-js/blob/master/src/image-target/three.js)暴露 `start()`、`stop()`、`addAnchor(targetIndex)` 以及 `onTargetFound/onTargetLost`。建议只把允许的 `targetIndex` 映射为本站证据 ID；识别成功显示待确认线索，由用户主动领取。离开页面停止摄像头和渲染，重复进入不得残留媒体轨道。不要将检测事件直接当作到访或完成任务的证明。
- 摄像头需用户授权和安全上下文，依据 [W3C Media Capture](https://www.w3.org/TR/mediacapture-streams/)；[Secure Contexts](https://www.w3.org/TR/secure-contexts/#is-origin-trustworthy)说明 HTTPS 与回环地址的信任规则。电脑 localhost 可作开发入口，手机访问电脑的普通 HTTP 局域网地址不能据此当作 localhost；手机演示准备 HTTPS，并对拒绝权限/无摄像头提供手动入口。MindAR 的[运行教程](https://hiukim.github.io/mind-ar-js-doc/quick-start/run/)也要求经服务打开，并给出打印图片或另一块屏幕作为目标的测试方法。
- 许可证：[MindAR LICENSE](https://github.com/hiukim/mind-ar-js/blob/master/LICENSE)，**MIT**，需保留版权与许可声明。此结论针对库代码；卡片图片、叠加模型、音频和依赖另列来源，不推定示例中的模型自动获得同一授权。

## ink / inkjs：有状态、有分支的导览故事

- 官方源：[inkle/ink](https://github.com/inkle/ink)是交互叙事脚本语言；[y-lohse/inkjs](https://github.com/y-lohse/inkjs)是社区维护的 JavaScript 移植，适合浏览器集成。不是 AI 自动编剧或事实核查系统；人物、证据及分支仍需小组编写、核对。
- inkjs README 支持直接 script 引入或 npm，并提供 `new inkjs.Story(storyContent)`、`Continue()`、`currentChoices`。它提供旧浏览器构建及 JSON/编译器兼容表，不能把“同为 ink”当作任意版本兼容保证。建议锁定运行库和编译器组合，发布预编译故事 JSON，不在游客端编译外来故事。
- [ink 官方运行文档](https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md)说明 `ChooseChoiceIndex(index)` 推进分支以及 `state.ToJson()/LoadJson()` 保存恢复。这是可复玩状态机，不需要专用 GPU、摄像头或收费模型。建议固定上限的故事长度、可选项和存档大小，展示层用纯文本；模型只对用户主动提交的讲解给建议，不代替引擎决定证据和结局。
- 通过现有 Spring Boot 静态资源加载故事，使用 HTTP(S)；inkjs README 特别说明直接 `file://` 加载外部 JSON 有浏览器限制。本模块本身不调用摄像头，HTTPS 不是其故事逻辑的必要条件；上线仍沿用应用的 HTTPS 部署。
- 最小接法：页面包装 Story，以“继续/选择/重开/导出决定轨迹”操作推进；只接已有观察草稿和显式聊天入口，不直接修改公共知识库。建议验收两条完整路径、返回重玩、版本不符存档、恶意文本、空内容和无模型 Key，防止出现只有选项没有完整结局的空壳。
- 许可证：[ink LICENSE](https://github.com/inkle/ink/blob/master/LICENSE.txt)、[inkjs LICENSE](https://github.com/y-lohse/inkjs/blob/master/LICENSE.md)均为 **MIT**。保留两者适用的版权与许可；引擎许可不等于授予第三方游戏故事、景区图片或角色内容的使用权。小组原创脚本和引用资料分别记录来源。

## Pannellum：课堂中的全景观察场

- 官方源：[mpetroff/pannellum](https://github.com/mpetroff/pannellum)、[功能说明](https://pannellum.org/features/)。支持等距柱状、立方体和多分辨率全景、WebGL/CSS 3D 渲染与热点，不依赖前端框架。它是全景查看器，不负责把一张普通照片变为可自由行走的三维景区。
- [全景游览例](https://pannellum.org/documentation/examples/tour/)支持多个场景连接；[热点例](https://pannellum.org/documentation/examples/hot-spots/)展示按方位添加说明。需要真实全景或明确标注的原创示意全景，不能拿合成演示画面宣称实地采集；代码开放不提供景区图像授权。
- [配置参考](https://pannellum.org/documentation/reference/)的 `clickHandlerFunc` 可把热点点击接为当前站观察入口；[API](https://pannellum.org/documentation/api/)提供 `loadScene`、`addHotSpot`、`resize` 和 `destroy`。建议独立容器按需创建，关闭时销毁；热点只带白名单内容 ID，外部内容不执行任意函数或 HTML。这套校验需我们自己实现。
- [仓库部署说明](https://github.com/mpetroff/pannellum#how-to-use)要求经 Web 服务提供资源；预构建 JS/CSS 可由 Spring Boot 提供，普通图像浏览不需摄像头或收费模型。浏览器及显卡驱动要支持对应渲染路径；大图加载速度、低端手机和 Live2D 并存需要实测。基础拖拽方案先不依赖陀螺仪权限。多分辨率素材生成另有 Python/Hugin 等制作工具要求，游客无需运行制作工具。
- 许可证：[COPYING](https://github.com/mpetroff/pannellum/blob/master/COPYING)，**MIT**。保留库许可，照片的作者、许可、来源单独展示；第三方地图/街景服务不因查看器 MIT 而自动可下载或再分发。

## 下一轮可验证的门槛

| 顺序 | 最小可演示范围 | 进入后续的条件 |
|---|---|---|
| 1 故事闭环 | 1 幕原创故事、3 个决策节点、2 条完整路径；线索/推测/资料分开，导出选择轨迹 | 无 Key 能走完，脚本与存档版本检查通过，资料来源逐条可看 |
| 2 AR 入口 | 2 张原创卡，扫描进入同一故事；手动入口始终可用 | 实际 Android Chrome 与 iOS Safari 测权限、弱光、跟丢、关闭；不通过则保留为实验入口 |
| 3 全景观察 | 1 个有来源的全景、3 个热点接既有观察任务 | 先取得合法适配素材，再验收桌面/手机加载与无图形能力提示 |

本次没有给出星数、最近提交时间或长期维护承诺；正式引入时重新锁版本、核对发布包许可证及依赖。研究不意味着这些功能已完成，不应在答辩中展示为已集成成果。
