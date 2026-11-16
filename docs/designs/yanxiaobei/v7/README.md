# 燕小北 v7 形象定稿与换装

对应[议题 #71](https://github.com/D92647426/tourism-ai-avatar/issues/71)与 REQ-063。资产类型为 `character-design-artwork`，用于小组共享本轮确认的角色设计图。

## 确认的造型

二头身、简化尖发束、大环形呆毛及小呆毛、B字发夹和白花、无黄色星星的紫瞳。下巴采用 v6 收窄版，收拢后翼恢复 v5 深灰黑色。背带裤为本轮换装基准，兜帽衫和短袖沿用该角色设计。

## 衣装预览

| 背带裤 | 兜帽衫 | 短袖T恤 |
|---|---|---|
| ![背带裤](overalls.png) | ![兜帽衫](hoodie.png) | ![短袖T恤](tshirt.png) |

三张原图均为1254×1254、RGBA透明PNG，按字节复制。下载原图可点击[背带裤](overalls.png)、[兜帽衫](hoodie.png)和[短袖T恤](tshirt.png)。

## 来源与生成记录

角色依据用户提供的微信《小北校园日常》表情素材，经内置 imagegen 重绘与逐轮调整。原表情作者与完整设定待核实，图像来源许可状态为 `upstream-unspecified`。

完整提示词包含基准图、两套衣装和兜帽衫鬓角羽尖修正，见[prompt-set.json](prompt-set.json#L1)。原文件名、尺寸、SHA-256和设计依据见[manifest.json](manifest.json#L1)。现有角色及资料来源见[素材记录](../../../../src/main/resources/static/media/campus/SOURCES.md#L1)。

## 验证

执行 `python -X utf8 -m unittest discover -s tests -p test_avatar_design_assets.py`，检查文件摘要、PNG尺寸及RGBA类型、衣装对应关系和完整提示词。归档前另以Pillow逐张验证PNG完整性及实际透明通道范围0～255。

[可动形象说明](../../../campus_avatar.md#L1)记录运行时模型、语音生命周期和已有验收。[资产回归](../../../../tests/test_avatar_design_assets.py#L1)记录本轮设计文件的自动检查。
