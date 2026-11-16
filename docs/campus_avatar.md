# 燕小北可动形象

## REQ-062 本轮范围

对应[议题 #69](https://github.com/D92647426/tourism-ai-avatar/issues/69)。

校园助手采用用户提供的《小北校园日常》形象，经 imagegen 重绘透明正面立绘与眼睛、口型差分，再经 RuiC-2D 绑定。校园页中央问好、侧边陪伴和手机角落人物共用一个渲染器。原作者完整设定仍待核实，生成素材的侧背细节包含推断。当前页面使用正面模型。

[页面入口](../src/main/resources/static/campus.html#L15)、[角色控制器](../src/main/resources/static/js/campus-avatar.js#L9)、[来源与完整生成提示词](../src/main/resources/static/media/campus/yanxiaobei-avatar/制作记录.md#L1)。

## 交互与声音

鼠标移动控制眼神和小幅转头，离开窗口后平滑回正。触屏滑动保持阅读操作，待机包含自然眨眼、呼吸和发丝轻动。系统启用减少动态效果时收起视线、转头和待机，仍保留说话口型反馈。页面隐藏、人物离开可见区时暂停动画帧。

声音沿用现有 GuideSpeech 生命周期，只有真实开始或恢复播放后才张嘴。问好、回答和回听共用同一路径，停止、静音、图书馆静音、新对话及离页都会闭口。系统及 Android TTS 使用播报期间的近似节奏口型，本地角色音频在用户手势解锁 AudioContext 后按实际音量驱动，静音段闭口。浏览器声音权限及角色语音服务的要求沿用现有设置。

[语音联动](../src/main/resources/static/js/campus-voice.js#L8)、[媒体观察器](../src/main/resources/static/js/local-speech.js#L22)、[动作回归](../tests/frontend/campus-avatar.test.js#L1)。

## 资源与故障处理

模型资源、运行库和许可随 JAR 本地发布。运行库采用 RuiC-2D 提交 5f78bfb852154be71b4352fda6a3c2b759930597 中的 Mesh Avatar，并包含正时间间隔至少更新一次的高刷新率修正。WebGL、脚本或模型资源不可用时显示同一形象的透明立绘，问答及语音继续使用原有入口。WebGL 上下文丢失后可刷新页面重新加载。

[模型参数](../src/main/resources/static/media/campus/yanxiaobei-avatar/rig.json#L1)、[运行库许可](../src/main/resources/static/vendor/ruic2d/LICENSE-mesh-avatar.txt#L1)、[RuiC-2D许可](../src/main/resources/static/vendor/ruic2d/LICENSE-RuiC-2D.txt#L1)。

## 验证与演示

在仓库根目录执行 `node --test tests/frontend/campus-avatar.test.js tests/frontend/local-speech.test.js`，检查鼠标两侧与回正、真实播报开始、停止与旧回调隔离、静音、减少动态效果、隐藏暂停、模型失败、销毁和实际音量驱动。完整前端回归执行 `node --test tests/frontend/*.test.js`。

运行方式沿用[校园 Demo 手册](campus_demo_runbook.md#L1)。打开 `/campus.html` 后移动鼠标观察眼神，点击回听测试口型，发送“平乐园图书馆有什么”观察人物移到侧边。失败先检查 `avatarCanvas` 的 `data-avatar-state`、模型资源 HTTP 状态及控制台，再检查声线和浏览器播放权限。

## 2026-11-16 本机验收

最终前端368项、Java318项、地图数据15项、既有数据44项及Python语音3项通过。独立JAR的校园和景区HTTP冒烟通过，32份新人物及入口资源在工作区、打包JAR和18089实际HTTP响应中逐字节相同。

真实Chromium检查1440×1000、390×844及844×390，中央人物、侧边及角落布局正常，页面无横向溢出。鼠标右移gazeX约0.795、左移约-0.790，待机眨眼最小eyeOpen约0.0017。真实WebGL上下文丢失后切为同形象静态立绘，发送入口继续可用。运行时错误记录为空。人物区域axe检测0项violations，对比度2节点因背景伪元素需人工判断，已目视复查。

无模拟脚本的浏览器确认本机Windows三种中文TTS可用，真实回听进入speaking，点击停止后声音与人物说话状态共同结束。受控系统语音事件验证4种口型，真实WebAudio测试音频验证响声开口和静音段闭口，静音段最大开合约0.00058。本地GPU角色音色和实体手机设备的音频质量继续按各自设备验收。

[桌面预览](screenshots/campus-avatar-desktop.png)、[手机预览](screenshots/campus-avatar-mobile.png)。
