# 校园原型素材

用于北京工业大学课程原型。学校图片未公布统一再利用许可，标记为 upstream-unspecified。保留原图中的署名，发布到课程之外前需另行核实授权。图片仅为地点与分区预览，不能证明当前开放状态、菜品、价格或建筑入口坐标。

- `yanxiaobei.png` 根据北京工业大学官方燕小北二维横幅，由内置 imagegen 进行 AI 辅助二维重建并输出透明背景。它是课程原型形象，不是官方动画或真实口型模型。完整原始图片来源见 [sources.json](sources.json)，完整处理 prompt、尺寸与方法见 [processing.json](processing.json)。
- `library.jpg`、`fourth-teaching.jpg`、`moon-lake.jpg`、`auditorium.jpg` 来自学校招生校园图集。根代理已逐张目视核对内容及图注，未经额外编辑，原始 URL 见 [sources.json](sources.json)。
- `tiantian-dining.jpg` 展示天天餐厅所在学生综合服务楼。`north-dining.jpg` 为北区餐厅菜品配图。来自[学校英文网餐饮介绍](https://english.bjut.edu.cn/Life_BJUT/Dining.htm)，下载与尺寸记录见 [dining-sources.json](dining-sources.json)。官方介绍配图，拍摄时间未标明。当前菜品和价格请查看现场公示。
- `library-layout-1.jpg` 为[图书馆官方布局页](https://lib.bjut.edu.cn/tsggk/tsgbj/bbxq.htm)第一张一层布局，已读到北出入口、多媒体阅览区与北区咨询台。来源和原图地址见 [library-layout-source.json](library-layout-source.json)。用于分区指引，不用于 GPS 定位。
- 校园范围来自 [OpenStreetMap way 33617299](https://www.openstreetmap.org/way/33617299)，© OpenStreetMap contributors，适用 [ODbL](https://www.openstreetmap.org/copyright)。26 个边界点、数据时间与坐标系见 [pingleyuan-map-data.json](pingleyuan-map-data.json)。建筑入口均仍未核验。

目录绑定、类型与描述由[校园目录接口](/api/campus/catalog)的资源记录维护。`character` 仅用于角色，`photo` 可用于场景背景，`floorplan` 仅用于同页布局展开。所有资源核对日期为 2026-11-09。
