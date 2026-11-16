# RuiC-2D 与燕小北形象调研

核验日期为2026年11月16日，供三人小组选择角色素材与制作流程。RuiC-2D源码核验版本为 `5f78bfb852154be71b4352fda6a3c2b759930597`。

## RuiC-2D 项目确认

准确项目为HRuiCcc维护的RuiC-2D。用户提供的B站视频标题为《立绘转可动形象，一张插画变直播分身》，作者“青青王-AI”，公开元数据及封面中的RuiC-2D标识与项目对应。[GitHub仓库](https://github.com/HRuiCcc/RuiC-2D)、[用户提供的视频](https://www.bilibili.com/video/BV1nTWv6ZENr/)、[公开视频元数据](https://api.bilibili.com/x/web-interface/view?bvid=BV1nTWv6ZENr)

上游README说明支持从PNG、JPG或WebP正面立绘开始，尝试分割、分层及绑定，并可手动补五官点位。功能包括网格变形、眨眼与口型、时间轴、MediaPipe实时驱动及OBS输出，导出格式包括 `.yxavatar`、`.mavatar`、PNG及WebM。环境要求Node.js 20+、Python 3.10+，配音导入需要FFmpeg。复杂遮挡与缺失部位仍需补绘。[上游README](https://github.com/HRuiCcc/RuiC-2D/blob/5f78bfb852154be71b4352fda6a3c2b759930597/README.md)

项目代码采用MIT，基础Mesh Avatar运行时另附MIT许可。示例角色“大肥鱼1号”的立绘、差分与配音由作者保留相关权利，LivLiv角色包另有素材许可与署名条件。选取角色素材时须分别记录来源与适用许可。[代码许可](https://github.com/HRuiCcc/RuiC-2D/blob/5f78bfb852154be71b4352fda6a3c2b759930597/LICENSE#L1)、[Mesh Avatar许可](https://github.com/HRuiCcc/RuiC-2D/blob/5f78bfb852154be71b4352fda6a3c2b759930597/public/vendor/LICENSE-mesh-avatar.txt#L1)、[角色素材许可](https://github.com/HRuiCcc/RuiC-2D/blob/5f78bfb852154be71b4352fda6a3c2b759930597/characters/LICENSE.md#L1)、[上游示例说明](https://github.com/HRuiCcc/RuiC-2D#开源协议)

## 校园助手接入判断

**以下为源码推断，待实跑。** 可先以已确认可修改的正面角色图测试单图导入，人工修正眼睛、嘴部及遮挡，再用导出包的播放器接入校园页。上游播放器在 `portable=1` 时读取相对路径下的绑定和素材，通过 `MeshAvatar.createMeshAvatar` 创建角色并更新参数，具备静态同源部署的结构依据。[播放器源码](https://github.com/HRuiCcc/RuiC-2D/blob/5f78bfb852154be71b4352fda6a3c2b759930597/public/player.js#L1)、[播放器页面](https://github.com/HRuiCcc/RuiC-2D/blob/5f78bfb852154be71b4352fda6a3c2b759930597/public/player.html#L1)

当前校园语音模块提供布尔型 `onMouth` 播报状态，可以作为开口与闭口的初步衔接点。按真实音量连续驱动嘴型，需要接入实际音频分析，并核验停止、暂停、静音及回听。燕小北单图的生成质量、静态播放器集成、离线资源完整性和手机帧率均待实跑。[现有语音回调](../src/main/resources/static/js/campus-voice.js#L12)、[上游播放器参数更新](https://github.com/HRuiCcc/RuiC-2D/blob/5f78bfb852154be71b4352fda6a3c2b759930597/public/player.js#L6)

## 已找到的燕小北娘化人形

已实际查看《【北工大】傻鸟吉祥物：这照片是你吗？》的公开封面。原帖作者“伊吹渡雨子”，发布于2025年3月9日，公开元数据显示视频长16秒。封面少女具有蓝紫短发、侧边束发、黄色发饰和青蓝眼睛，穿浅青蓝上衣、红色领结及青色背带服，腰部有白色“3”形标志。一手举起，另一手持燕小北鸟形照片，能够确认存在娘化人形二创。[作者原帖](https://www.bilibili.com/video/BV1nFRaYvE5a/)、[已查看的封面原图](https://i0.hdslb.com/bfs/archive/8be439ed0dc7651788cfc408e30f896db63a0557.jpg)、[公开视频元数据](https://api.bilibili.com/x/web-interface/view?bvid=BV1nFRaYvE5a)

作者简介说明根据喜多网图描改。模型下载、分层源文件、Live2D参数、可编辑动作及使用授权尚未核验。封面有举手、持照片及裁切，作为后续角色设定参考时，可向作者核对是否有正面完整立绘和分层稿。现有检索结果无法判断全部公开及校内资源的完整情况。[原帖及简介](https://www.bilibili.com/video/BV1nFRaYvE5a/)

## 鸟形可动素材线索

YufeiWang-cn维护的燕小北Codex桌宠提供鸟形二维动画，README列出57张帧图及空闲、思考、等待、完成、出错、挥手、左右移动和跳跃等动作。已核对仓库文件列表，原生素材由 `pet.json` 和WebP精灵图组成，增强版采用PNG帧图。可作为状态动作组织的技术参考。[桌宠仓库](https://github.com/YufeiWang-cn/bjut-yanxiaobei-codex-pet)、[效果与动作说明](https://github.com/YufeiWang-cn/bjut-yanxiaobei-codex-pet/blob/main/docs/PREVIEW.md)

该仓库的代码和不含角色图像的文档采用MIT，许可证明确排除燕小北角色、名称、图集、动画帧和角色展示图片。FAQ对改图、商用及转载给出了拒绝说明。项目代码许可与角色图片的使用条件应分别核对。[许可证适用范围](https://github.com/YufeiWang-cn/bjut-yanxiaobei-codex-pet/blob/main/LICENSE.md#L1)、[作者FAQ](https://github.com/YufeiWang-cn/bjut-yanxiaobei-codex-pet/blob/main/docs/FAQ.md)

## 三人小组后续验证分工

| 方向 | 下一步产出 | 验收关注点 |
|---|---|---|
| 素材与角色设定 | 整理娘化二创原作者信息，确认素材制作及使用条件，准备正面完整立绘 | 作者、来源、许可和修改范围有记录，五官及可动部位清晰 |
| 单图绑定与动作 | 用RuiC-2D验证一套眨眼、说话和小幅转头动作，导出自有角色包 | 遮挡补绘、边缘破损、口型与动作幅度实际可看 |
| 校园页与语音集成 | 验证静态播放器加载、语音生命周期联动和手机显示 | 离线加载、停止/暂停/回听、减少动态效果及性能符合演示需求 |

本轮完成公开页面、元数据、许可证、播放器源码及人形封面的核对。具体素材的制作效果与校园助手接入结果，以后续运行和视觉验收为准。
