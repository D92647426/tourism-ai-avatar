# 校园原型素材

用于北京工业大学课程原型。学校图片未公布统一再利用许可，标记为 upstream-unspecified。保留原图中的署名，发布到课程之外前需另行核实授权。图片仅为地点与分区预览，不能证明当前开放状态、菜品、价格或建筑入口坐标。

- `yanxiaobei.png` 根据北京工业大学官方燕小北二维横幅，由内置 imagegen 进行 AI 辅助二维重建并输出透明背景，用作课程原型角色。完整原始图片来源见 [sources.json](sources.json)，完整处理 prompt、尺寸与方法见 [processing.json](processing.json)。
- `library.jpg`、`fourth-teaching.jpg`、`moon-lake.jpg`、`auditorium.jpg` 来自学校招生校园图集。根代理已逐张目视核对内容及图注，未经额外编辑，原始 URL 见 [sources.json](sources.json)。
- `tiantian-dining.jpg` 展示天天餐厅所在学生综合服务楼。`north-dining.jpg` 为北区餐厅菜品配图。来自[学校英文网餐饮介绍](https://english.bjut.edu.cn/Life_BJUT/Dining.htm)，下载与尺寸记录见 [dining-sources.json](dining-sources.json)。官方介绍配图，拍摄时间未标明。当前菜品和价格请查看现场公示。
- `library-layout-1.jpg` 为[图书馆官方布局页](https://lib.bjut.edu.cn/tsggk/tsgbj/bbxq.htm)第一张一层布局，已读到北出入口、多媒体阅览区与北区咨询台。来源和原图地址见 [library-layout-source.json](library-layout-source.json)。用于分区指引，不用于 GPS 定位。
- 校园范围来自 [OpenStreetMap way 33617299](https://www.openstreetmap.org/way/33617299)，© OpenStreetMap contributors，适用 [ODbL](https://www.openstreetmap.org/copyright)。26 个边界点、数据时间与坐标系见 [pingleyuan-map-data.json](pingleyuan-map-data.json)。建筑入口均仍未核验。

目录绑定、类型与描述由[校园目录接口](/api/campus/catalog)的资源记录维护。`character` 仅用于角色，`photo` 可用于场景背景，`floorplan` 仅用于同页布局展开。所有资源核对日期为 2026-11-09。

## 2026-11-16 本部离线地图

新增pingleyuan-features.geojson和campus-map-points.json，来自OSM官方map API，WGS84坐标，ODbL-1.0许可。每份文件保留fetchedAt、sourceUrl、sourceSha256与署名。共187个参考要素及14个匹配地点，入口核验状态为false。Leaflet1.9.4依赖与BSD-2-Clause许可在vendor/leaflet记录。具体来源和重建步骤见[地图手册](../../../../../../docs/campus_map_lab.md#L1)。

## 2026-11-16 可动人物

v1模型位于 `yanxiaobei-avatar/source.png` 和同目录的 rig、built 图层。形象依据用户从微信《小北校园日常》提供的表情素材，通过内置 imagegen 重绘与差分生成，再使用 RuiC-2D 网格绑定。作者及素材授权状态仍为 upstream-unspecified，AI 生成的侧背细节包含推断。完整提示词与处理经过见[制作记录](yanxiaobei-avatar/制作记录.md#L1)。

RuiC-2D 采用提交 5f78bfb852154be71b4352fda6a3c2b759930597，Mesh Avatar 和 RuiC-2D 的 MIT 文本随 vendor/ruic2d 分发。运行库包含高刷新率短时间间隔推进修正，人物的眼睛及口型使用本轮生成图层。交互与回归见[可动形象手册](../../../../../../docs/campus_avatar.md#L1)。

## v8换装运行资源

校园页当前使用 `yanxiaobei-v8` 下的背带裤、兜帽衫和短袖三套可动模型。原图基于v7经内置ImageGen调整细腿、小鞋，并生成六张眼睛和口型差分。RuiC-2D在面部保护区内配准导入，原表情来源许可标记为 `upstream-unspecified`。[生成提示词](yanxiaobei-v8/prompts.json#L1)、[摘要清单](yanxiaobei-v8/manifest.json#L1)、[设计和差分来源](../../../../../../docs/designs/yanxiaobei/v8/README.md#L1)。
