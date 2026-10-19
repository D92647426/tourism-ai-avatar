# 数字人形象的组成与替换

## Q-0030 当前数字人如何实现，是否方便替换？

当前游客页面使用 PIXI + pixi-live2d-display，加载 Haru 的 Cubism 2 格式模型。实际加载和口型控制在 [main.js:L104](../src/main/resources/static/js/main.js#L104)，首页并未引用独立的 live2d-helper.js，因此修改游客端时不能只改 helper。

职责分为三部分：
1. 对话：Java 调用模型或离线规则，见 [ChatService.java:L53](../src/main/java/com/guide/service/ChatService.java#L53)。
2. 声音：Android 原生 TTS 或浏览器 speechSynthesis，见 [main.js:L258](../src/main/resources/static/js/main.js#L258)。
3. 外观：运行时模型、贴图、表情、动作和物理配置，见 [haru.model.json:L1](../src/main/resources/static/models/haru/haru.model.json#L1)。

因此换形象通常修改前端模型加载与控制，不要求重写问答后端；声音也不由角色图片自带。

## 当前替换的边界

| 操作 | 难度判断 | 实际需要 |
|---|---|---|
| 调整现有大小、位置与比例 | 低 | 调整舞台和缩放；当前存在横向 12/16 缩放，需检查是否挤压形象 |
| 换现成兼容 Live2D 模型 | 中低 | 导入完整资源、改模型路径、调整构图和动作/口型映射，实际浏览器验收 |
| 制作自定义角色 Live2D | 中高，主要在美术和绑定 | 分层立绘、网格与变形参数、表情/动作、运行时导出，再接入 |
| 改为 3D 角色 | 较高 | 另加 3D 渲染与骨骼/表情控制；现有 Live2D 加载器无法直接加载 VRM/GLB |

以上是项目复杂度判断，不是制作工时承诺。

当前路径硬编码为 /models/haru/haru.model.json：[main.js:L127](../src/main/resources/static/js/main.js#L127)。后台 modelName 虽然保存，但游客端配置读取仅更新名称，未用它切换模型：[DigitalHumanConfig.java:L10](../src/main/java/com/guide/model/DigitalHumanConfig.java#L10)、[main.js:L376](../src/main/resources/static/js/main.js#L376)。

当前表情名 f01、旧参数 PARAM_MOUTH_OPEN_Y 和 setParamFloat 控制方式均有现有模型假设：[main.js:L139](../src/main/resources/static/js/main.js#L139)、[main.js:L369](../src/main/resources/static/js/main.js#L369)。现代模型参数、接口与运行时版本需要单独验证，不能保证仅换路径即可兼容。

## 自定义角色的制作材料

原先的 PNG/JPG 三视图可以作为角色设计参考，不能直接替换为可眨眼、转头和说话的 Live2D 运行模型。常规制作路线：
- 以正面形象为基础拆出眼睛、嘴、头发、身体、服饰等图层，并补足遮挡区域。
- 在 Cubism 中建立网格、变形器与运动参数。
- 先完成眨眼、口型、呼吸、轻微头部运动，再增加尾巴和头发物理效果。
- 导出运行文件并接入项目；保留可编辑源文件便于后续精修。

官方资料：
- [PSD 导入](https://docs.live2d.com/en/cubism-editor-manual/psd-import/)
- [运行数据导出：moc3、model3.json 和贴图](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- [标准参数，包括 ParamMouthOpenY](https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/)

建议先做简化版导游角色 Live2D，技术上将模型路径、缩放、表情与口型参数映射独立配置。取得完整模型后验收加载、透明背景、构图、口型、动作切换、停止播报及手机布局。当前尚未实现配置化切换，也未制作定制角色模型。
