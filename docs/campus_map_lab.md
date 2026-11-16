# 校园地图与虚拟定位测试

REQ-061，议题[#67](https://github.com/D92647426/tourism-ai-avatar/issues/67)。2026年11月16日。

## 使用步骤

1. 启动后打开[校园助手](http://127.0.0.1:18089/campus.html)，待底部输入区出现，点击“地图测试”。
2. 选择校区与模拟地点。本部14处提供OSM参考点，选中后填写经纬度。坐标待补充的地点支持按地点身份模拟。地图空白处点选或编辑坐标后，模拟地点改为“建筑未知”。
3. 设置定位精度和手动模拟时钟，点击“应用虚拟定位”。地图与持续状态显示虚拟来源，问答读取该条件。
4. 点击“推进30秒并采样”，面板时钟显示秒数。选择北区餐厅并设12点可测试饭点邀约，选择图书馆可测试到馆邀约与静音。返回对话后展示空闲时的气泡，回应气泡进入正常问答。
5. 询问目的地并选择“带我过去”，地图显示当前位置、目标参考点与方向虚线。纯坐标起点也支持地址和方向预览。入口、可通行路网及真实步行耗时仍需核验。
6. “退出虚拟定位”清除虚拟条件，按设备权限恢复定位。新对话会清除本次条件。切到后台后虚拟采样暂停，返回时须重新应用。

[面板与真实入口](../src/main/resources/static/js/campus-location-lab.js#L5)、[模拟环境](../src/main/resources/static/js/campus-environment.js#L155)、[正常页面回归](../tests/frontend/campus-location-lab.test.js#L17)。

## 地图内容与交互

本部离线数据含校界1项、建筑57项、道路81项、运动场地47项、水体1项，共187项。14个地点参考点通过目录名称或明确别名对应OSM要素，保留来源及抓取日期。建筑采用面积质心，部分餐厅采用OSM节点。地图支持拖动、双指和按钮缩放、地点弹窗、回到校区。在线底图由用户展开后加载。

其他校区提供目录地点与坐标输入，详细底图按已收录数据展示。图书馆分区等室内点及北区餐厅等未知坐标在选项中标明状态。正式地点目录的入口坐标与核验状态按原事实维护。

[离线矢量](../src/main/resources/static/media/campus/pingleyuan-features.geojson#L1)、[参考点及未知列表](../src/main/resources/static/media/campus/campus-map-points.json#L1)、[交互地图](../src/main/resources/static/js/campus-map.js#L34)。

## 状态和生命周期

新虚拟定位采用手动时钟，点击推进才增加时间并产生新采样。旧“情境演示”的两个按钮继续自然走时，并在1秒后加速30秒。虚拟样本统一携带simulated=true及source=simulated，模拟校区随选择变化。普通真实GPS上报经纬度和精度，建筑身份由实际证据确定。

进入虚拟模式先同步取消边界，旧GPS和迟到响应按代次隔离。关闭面板释放地图并保留输入草稿，重新打开建立可见地图，资源失败后重试。地图在已有视图中心建立后添加几何，位置更新只改变叠加层。隐藏、退出、重置和销毁覆盖独立回归。

## 依赖与数据更新

Leaflet固定1.9.4，使用BSD-2-Clause许可，代码和图片随JAR发布。OSM数据使用ODbL并在地图与文件元数据中署名。

[依赖来源](../src/main/resources/static/vendor/leaflet/SOURCE.md#L1)、[Leaflet许可](../src/main/resources/static/vendor/leaflet/LICENSE#L1)、[OSM来源](https://api.openstreetmap.org/api/0.6/map?bbox=116.471439%2C39.8702655%2C116.4829918%2C39.8780729)。

```powershell
python -X utf8 scripts/update_campus_map.py --help
python -X utf8 scripts/update_campus_map.py --timeout 30
python -X utf8 scripts/update_campus_map.py --source-file target/campus-map-source.osm
```

脚本默认读取打包目录，输出上述两份地图文件。--catalog切换输入目录文件，--output和--points-output指定输出，--source-file用于离线重建，--timeout默认30秒。成功返回0，下载、解析、生成或写入失败返回1，非法命令行参数返回2。输入为公开OSM XML和校园目录，输出为GeoJSON与参考点JSON。写入前完成校验，提交失败尝试恢复原文件。

## 验证

```powershell
node --test tests/frontend/campus-map.test.js tests/frontend/campus-location-lab.test.js tests/frontend/campus-virtual-position.test.js
python -X utf8 -m unittest discover -s tests -p test_campus_map_data.py
mvn -o -DforkCount=0 verify
node --test tests/frontend/*.test.js
python -X utf8 scripts/check_doc_links.py
python -X utf8 scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar --port 18090
```

浏览器按桌面、手机、短横屏和减少动态效果分别检查。地图库边界桩只用于确定性的模块回归，真实Leaflet图层、原生对话框、触摸布局及标准表单由实际浏览器验收。真实设备GPS、手机语音与入口路网核验按各自议题继续推进。

## 本轮验收记录

本机完整Java318、前端356、地图数据15、既有数据44、voice3与隔离HTTP全部通过。实际Chromium验证桌面、手机和短横屏、减少动态效果、地图选点、时间原生键盘输入、坐标极值、地点/坐标起点方向预览、饭点邀约、跨校区及退出，运行包浏览器错误记录为空。当前预览采用空模型Key的本地校园资料回答，手机以视口模拟验证。

浏览器发现并修复了几何添加早于视图中心、关闭面板后迟到初始化、失败重开重试和后台暂停状态反馈问题，均已加入回归。
