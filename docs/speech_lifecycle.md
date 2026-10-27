# REQ-036 语音与数字人生命周期（GitHub #7）

## 已定方案与验收

旧代码先动嘴再调用语音，并按字数估计结束；Android 回调没有播报标识，旧回调会污染新状态。本轮只修生命周期，不实现音素或音量级口型、不换模型、不增加语音服务。

- 页面状态为待机 idle、聆听 listening、思考 thinking、等待声音 queued、播报 speaking、暂停 paused 和失败 error。聊天栏与人物旁共用状态文字；失败保持回答文字可读。
- 只有当前播报真实 onstart/onresume 后动嘴；结束、暂停、错误、停止、关闭聊天、新提问、切到后台和 pagehide 立即关闭嘴并清理任务。重复停止安全。旧 Web 回调和旧 Android ID 不得改写当前状态。
- 无中文声音先等待 voiceschanged（最多1500毫秒），仍无可用声音就提示文字可用；不以等待/失败作为播放成功。语音启动事件最多等待8000毫秒；播放异常最长120000毫秒后停止并提示异常（固定故障上限，不根据字数估时）。所有取消均清理监听与定时器。
- 独立 UMD 模块 GuideSpeech.create(options)：注入 synthesis、Utterance、nativeBridge、onChange、onMouth 和测试定时器。接口 speak(text)、stop()、setActivity(idle/listening/thinking)、nativeEvent(kind,id,error)、destroy()、getState()。状态快照包含 status、message；onMouth 布尔值供现有渲染动画使用。模块清理生命周期，main.js 管 UI 和原有嘴部随机插值；模型后加载也只能在当前 speaking 时启动动画。
- Android API-036 协议2：getTtsProtocolVersion()=2、speakWithId(text,id)、stopSpeaking()、isTtsReady()；回调 onTtsStart(id)、onTtsEnd(id)、onTtsError(error,id)、onTtsStop(id)。id 由网页生成包含页面随机标识的唯一串；Kotlin 用 JSONObject.quote 安全编码回调实参，所有引擎操作主线程串行。新网页不接受无 ID 回调；旧 APK 可降级 Web 中文声音，均无则给文字提示。保留旧 speak(text) 给旧网页，但不声称旧协议满足竞态隔离。
- 识别开始前停播报；识别错误和请求失败显示 error，用户取消回 idle；实际收到开始识别事件才显示 listening，申请权限时不冒充已聆听。不增加识别自动重启；旧识别结果不能在关闭聊天后发送。状态清理不能破坏已有聊天超时/重试和探索草稿交接。
- 验证包含可控语音 mock（无声、延迟声线、启动失败、结束/错误/暂停/恢复、重复停止、A被B替代后的迟到回调、协议2及旧协议降级）、实际 main.js 集成、浏览器页面状态/截图、现有全部前端测试、Maven clean verify、HTTP smoke、文档链接。Android 未运行真机或构建时明确记录，不以 mock 代替真机证明。

## 分支与兼容

本分支从创意分支 82d99f5 开始，PR 以 codex/creative-exploration 为基线，只评审 #7 改动。合并顺序为 #16 聊天→#18 创意→本 PR，前项合并后调整目标为 main；其他独立 PR 的知识/统计/认证不自动合并。

无后端 HTTP 接口变更，无新持久化配置。语速/音量管理设置仍由 #14 后续接入。状态仅描述当前网页活动，不承诺 AI 服务在线或设备一定发声。

## 实现和验证记录

代码：[生命周期模块:L80](../src/main/resources/static/js/speech-lifecycle.js#L80)、[页面状态与回调:L336](../src/main/resources/static/js/main.js#L336)、[Android 协议入口:L255](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L255)、[Android 回调按 ID 分派:L347](../android/app/src/main/java/com/guide/lingshan/MainActivity.kt#L347)。

2026-10-27：Codex 实际运行 `node --test tests/frontend/*.test.js` 96 项通过（继承62项，新增生命周期23项、真实main脚本集成11项）；`mvn -o clean verify` 67 项继承 Java 测试通过，空 Key 隔离 HTTP smoke 通过（含讲解搭档与 Live2D 资源）。此 Maven 检查不编译 Android。

DeepSeek Harness 按已定接口实现生命周期模块/23项测试和 Kotlin 协议；Codex 完成界面、main适配、11项集成回归，并复查真实代码/运行输出。复查修正了 Android 语言可用判断：setLanguage 的 LANG_AVAILABLE、LANG_COUNTRY_AVAILABLE、LANG_COUNTRY_VAR_AVAILABLE 均可用，不能只等于 SUCCESS；依据 [Android 官方 TextToSpeech.setLanguage 文档](https://developer.android.com/reference/android/speech/tts/TextToSpeech#setLanguage(java.util.Locale))，核对日2026-10-27。同时补齐 speak/stop RuntimeException 收尾。

未安装 Android SDK、Gradle wrapper jar/运行器或 Kotlin 编译器，本轮不下载整个工具链，Android 仅静态复核，**未编译、未真机验证**。网页真实声线、系统发声质量与音素准确度也未验证。固定播放故障上限120秒可能中断超长播报，界面会提示异常，不伪装自然结束。

## 可重复浏览器验收

使用空模型 Key、隔离的临时数据启动 JAR；测试自己的预览端口，避免读写历史用户/聊天数据。浏览器 mock 在 [speech-browser-init.js:L1](../tests/fixtures/speech-browser-init.js#L1)，不打包进 static，不用于生产。`agent-browser --session tourism-speech-7 --init-script <该脚本绝对路径> open http://127.0.0.1:18081/`；只对本机预览生效，注入独立测试身份和不发声的可控引擎。

1. 点击聊天入口、输入“你好”并发送；思考后显示“正在准备声音”，此时嘴闭合，文字回答保留。
2. 通过 `agent-browser eval 'window.__speechDemo.start()'` 注入开始事件；状态变“正在讲解”，人物嘴部开始动画。该步骤是 mock，不是真实声音。
3. 点击停止，状态待机且嘴闭合；快速开始下一问后再触发旧结束回调，旧事件不影响新状态（自动回归也覆盖）。关面板或切后台同样停止。
4. `window.__speechDemo.setVoices([])` 后发送新问题，1500毫秒后看到“未检测到中文语音，文字内容仍可阅读”，无持续动嘴；恢复声线需传入 `[{lang:'zh-CN'}]`。
5. 在1440×1000和390×844下核对状态、聊天输入、停止按钮和探索内容可用，关闭聊天后人物可见，无水平溢出。截图和最终观察在PR记录，均标注可控mock。

Android 真机另验：安装新 APK 并设置同一局域网服务地址，确认中文系统TTS已安装，开始后停止/连续提问/切后台，核对嘴部停止和旧ID无效；旧 APK 应使用Web中文声线或明确文字提示，不能靠无ID回调动嘴。此项仍待组员执行。


本轮浏览器观察：1440×1000下mock开始前为queued，注入开始后为speaking且模型已加载/嘴部动画运行；停止后闭嘴。390×844下模拟无中文声线时，聊天栏显示文字仍可阅读，mouth=false；documentElement.scrollWidth与视口均为390，无水平溢出。截图：[桌面mock讲解状态](./screenshots/speech-lifecycle-desktop.png)、[手机mock无声线状态](./screenshots/speech-lifecycle-mobile.png)。测试浏览器与隔离预览进程已关闭。


## Standards 审查

以82d99f5为基线检查本议题diff，未发现实质规范违反或确认的新增缺陷；Android结论只限静态检查。

## Spec 审查

发现1项P2：请求/识别错误由页面直接绘制，控制器内部已为idle，关闭时去重导致错误标签残留。已在 [停止适配:L432](../src/main/resources/static/js/main.js#L432) 显式重绘控制器快照，并在 [页面回归:L99](../tests/frontend/speech-main.test.js#L99) 增加失败→关闭、识别错误→后台的验证；11项main集成检查通过。
