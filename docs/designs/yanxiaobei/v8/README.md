# 燕小北 v8 可动换装

REQ-064采用v7定稿继续调整腿和鞋，三套衣装均接入校园助手。

| 背带裤 | 兜帽衫 | 短袖 |
|---|---|---|
| ![背带裤](../../../../src/main/resources/static/media/campus/yanxiaobei-v8/overalls/source.png) | ![兜帽衫](../../../../src/main/resources/static/media/campus/yanxiaobei-v8/hoodie/source.png) | ![短袖](../../../../src/main/resources/static/media/campus/yanxiaobei-v8/tshirt/source.png) |

## 设计与生成

内置 ImageGen 以v7原图为编辑目标，将腿部收细约22%、鞋子收小约20%，形成二头身的轻巧比例。百分比为生成提示目标，实际结果经过目视确认。脸、紫瞳、下巴、大呆毛与小呆毛、B字发夹及白花、简化尖发束、深灰黑收拢后翼延续已确认设计。三张原图均为1254×1254透明RGBA，保存在打包资源目录。

[衣装完整提示词](../../../../src/main/resources/static/media/campus/yanxiaobei-v8/prompts.json#L1)、[差分完整提示词](expression-prompts.json#L1)、[文件与SHA-256](../../../../src/main/resources/static/media/campus/yanxiaobei-v8/manifest.json#L1)。

## 差分与绑定

`expressions`保存闭眼、半闭眼和A、半张A、I、O共六张生成原图。三套衣装共享相同脸部坐标，使用RuiC-2D配准及保护蒙版导入。每套模型有八张眼睛/口型贴图、眼球与睫毛图层、基础纹理及独立rig。运行时按视线、眨眼、真实播放事件和音量驱动。

[构建入口](../../../../scripts/build_campus_avatar_v8.py#L74)、[坐标与网格](../../../../scripts/build_campus_avatar_v8.py#L25)、[使用与验证](../../../campus_avatar.md#L45)。

## 来源

参考用户提供的微信《小北校园日常》素材及本轮确认设计。原表情作者设定与来源许可状态沿用项目素材记录。生成与绑定工具及来源见[素材记录](../../../../src/main/resources/static/media/campus/SOURCES.md#L23)。
