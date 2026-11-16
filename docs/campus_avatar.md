# 燕小北可动形象

## REQ-062 本轮范围

对应[议题 #69](https://github.com/D92647426/tourism-ai-avatar/issues/69)。

校园助手采用用户提供的《小北校园日常》形象，经 imagegen 重绘透明正面立绘与眼睛、口型差分，再经 RuiC-2D 绑定。校园页中央问好、侧边陪伴和手机角落人物共用一个渲染器。原作者完整设定仍待核实，生成素材的侧背细节包含推断。当前页面使用正面模型。

[页面入口](../src/main/resources/static/campus.html#L23)、[角色控制器](../src/main/resources/static/js/campus-avatar.js#L20)、[v1来源记录](../src/main/resources/static/media/campus/yanxiaobei-avatar/制作记录.md#L1)。

## 交互与声音

鼠标移动控制眼神和小幅转头，离开窗口后平滑回正。触屏滑动保持阅读操作，待机包含自然眨眼、呼吸和发丝轻动。系统启用减少动态效果时收起视线、转头和待机，仍保留说话口型反馈。页面隐藏、人物离开可见区时暂停动画帧。

声音沿用现有 GuideSpeech 生命周期，只有真实开始或恢复播放后才张嘴。问好、回答和回听共用同一路径，停止、静音、图书馆静音、新对话及离页都会闭口。系统及 Android TTS 使用播报期间的近似节奏口型，本地角色音频在用户手势解锁 AudioContext 后按实际音量驱动，静音段闭口。浏览器声音权限及角色语音服务的要求沿用现有设置。

[语音联动](../src/main/resources/static/js/campus-voice.js#L8)、[媒体观察器](../src/main/resources/static/js/local-speech.js#L22)、[动作回归](../tests/frontend/campus-avatar.test.js#L1)。

## 资源与故障处理

模型资源、运行库和许可随 JAR 本地发布。运行库采用 RuiC-2D 提交 5f78bfb852154be71b4352fda6a3c2b759930597 中的 Mesh Avatar，并包含正时间间隔至少更新一次的高刷新率修正。WebGL、脚本或模型资源不可用时显示同一形象的透明立绘，问答及语音继续使用原有入口。WebGL 上下文丢失后可刷新页面重新加载。

[v8背带裤模型参数](../src/main/resources/static/media/campus/yanxiaobei-v8/overalls/rig.json#L1)、[运行库许可](../src/main/resources/static/vendor/ruic2d/LICENSE-mesh-avatar.txt#L1)、[RuiC-2D许可](../src/main/resources/static/vendor/ruic2d/LICENSE-RuiC-2D.txt#L1)。

## 验证与演示

在仓库根目录执行 `node --test tests/frontend/campus-avatar.test.js tests/frontend/local-speech.test.js`，检查鼠标两侧与回正、真实播报开始、停止与旧回调隔离、静音、减少动态效果、隐藏暂停、模型失败、销毁和实际音量驱动。完整前端回归执行 `node --test tests/frontend/*.test.js`。

运行方式沿用[校园 Demo 手册](campus_demo_runbook.md#L1)。打开 `/campus.html` 后移动鼠标观察眼神，点击回听测试口型，发送“平乐园图书馆有什么”观察人物移到侧边。失败先检查 `avatarCanvas` 的 `data-avatar-state`、模型资源 HTTP 状态及控制台，再检查声线和浏览器播放权限。

## 2026-11-16 本机验收

最终前端368项、Java318项、地图数据15项、既有数据44项及Python语音3项通过。独立JAR的校园和景区HTTP冒烟通过，32份新人物及入口资源在工作区、打包JAR和18089实际HTTP响应中逐字节相同。

真实Chromium检查1440×1000、390×844及844×390，中央人物、侧边及角落布局正常，页面无横向溢出。鼠标右移gazeX约0.795、左移约-0.790，待机眨眼最小eyeOpen约0.0017。真实WebGL上下文丢失后切为同形象静态立绘，发送入口继续可用。运行时错误记录为空。人物区域axe检测0项violations，对比度2节点因背景伪元素需人工判断，已目视复查。

无模拟脚本的浏览器确认本机Windows三种中文TTS可用，真实回听进入speaking，点击停止后声音与人物说话状态共同结束。受控系统语音事件验证4种口型，真实WebAudio测试音频验证响声开口和静音段闭口，静音段最大开合约0.00058。本地GPU角色音色和实体手机设备的音频质量继续按各自设备验收。

[桌面预览](screenshots/campus-avatar-desktop.png)、[手机预览](screenshots/campus-avatar-mobile.png)。

## v7 定稿与换装设计资产

2026年11月16日归档三套角色设计图，采用收窄后的下巴、恢复的深灰黑色收拢后翼、大环形呆毛与简化尖发束。资产类型为 `character-design-artwork`，图像、完整提示词、原文件名和校验清单已集中保存。[三套设计稿](designs/yanxiaobei/v7/README.md#L1)、[议题 #71](https://github.com/D92647426/tourism-ai-avatar/issues/71)。

## REQ-064 v8细腿小鞋与形象切换

页面当前加载三套 v8 可动模型，默认背带裤。腿部按约22%、鞋按约20%的收小目标经内置 ImageGen 局部调整，保留 v7 脸型、眼睛、呆毛、头发和后翼设计。三套原图均为1254×1254 RGBA透明PNG，视觉尺寸以实际出图为准。眼睛与口型另生成六张差分，绑定时仅导入受保护的面部区域，18次导入的区域外变化像素均为0。[原图和提示词](designs/yanxiaobei/v8/README.md#L1)、[部署校验清单](../src/main/resources/static/media/campus/yanxiaobei-v8/manifest.json#L1)。

点击右上角“形象”打开衣橱，选择背带裤、兜帽衫或短袖。点击关闭、按Escape或点击面板外部即可收起，键盘关闭后焦点返回入口。手机成功换装后自动收起面板，展示完整人物及声音控件。成功的选择通过 `campus.avatar.appearance.v1` 保存在本机 localStorage，刷新自动恢复。存储受限时本次选择仍生效，界面说明保存状态。[面板](../src/main/resources/static/campus.html#L13)、[交互控制](../src/main/resources/static/js/campus-appearance.js#L7)。

换装先在独立画布准备，最新一次成功选择才提交。失败后现有模型继续可用，旧加载完成后释放其模型和画布。语音始终持有同一控制器，正在播报的口型、音频分析、停止、静音与减少动态效果继续按当前生命周期执行。初次GPU加载失败时显示所选衣装的透明立绘。[切换与提交](../src/main/resources/static/js/campus-avatar.js#L193)、[正常入口接入](../src/main/resources/static/js/campus.js#L12)、[换装回归](../tests/frontend/campus-avatar.test.js#L185)。

重建使用已有 RuiC-2D checkout，安装其所需的Pillow、NumPy与OpenCV后执行 `python -X utf8 scripts/build_campus_avatar_v8.py --ruic <RuiC-2D目录>`。脚本在本仓库target构建，输出rig、built图层、保护区导入报告与摘要清单。[绑定脚本](../scripts/build_campus_avatar_v8.py#L74)、[资产回归](../tests/test_avatar_v8_assets.py#L12)。

## REQ-065 全身动作与情境表情

校园页现支持更明显的全身跟随，以及学习、用餐、思考、期待、庆祝和疑惑六类动作。学习与用餐采用侧身构图，三套衣装均可切换。完整状态、素材、dsh-pet参考、构建与验收见[动作说明](avatar_actions.md#L1)。
