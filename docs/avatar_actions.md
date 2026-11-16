# 燕小北情境动作与全身跟随

## REQ-065 范围

三套v8衣装各有桌前学习、端碗用餐、托腮思考、馋嘴期待四种独立绑定姿态，共12套。学习与用餐采用三分之四侧身，各图独立设置双眼和嘴部坐标。雀跃回应与疑惑提醒基于待机模型的眨眼、眉毛、脸红、侧头和重心动画呈现。[绑定与构建](../scripts/build_campus_avatar_actions.py#L44)、[运行控制](../src/main/resources/static/js/campus-avatar.js#L21)。

鼠标带动全身的轻微位移、倾斜和重心，同时控制头部、眼神、呼吸、发丝和后翼。桌前学习保持桌面稳定，手部有轻微点按。动画依实际帧间隔更新，页面隐藏与角色离屏暂停。减少动态效果时保留姿态、表情和播报口型。[动作采样](../src/main/resources/static/js/campus-avatar-actions.js#L42)、[跟随与绘制](../src/main/resources/static/js/campus-avatar.js#L38)。

## 自动与手动

“图书馆、学习、自习、电脑、课本”进入学习，“食堂、吃饭、用餐、美食”进入用餐，“饿了、馋、想吃、流口水”进入期待。感谢触发雀跃，迷路及不懂触发疑惑。明确否定的活动被移除后再判定，用户可说“停止动作”回待机。完成轮次还结合结构化地点场景，普通追问继续当前主题。[关键词](../src/main/resources/static/js/campus-avatar-actions.js#L14)、[场景解析](../src/main/resources/static/js/campus-avatar-actions.js#L28)。

右上角“形象”面板增加动作与表情入口。点击动作预览8秒，随后回到当前对话动作。手机成功选择后收起面板。“跟随对话”可暂停自动触发，手动预览继续可用。新请求结束旧预览，取消、新对话和离页使旧请求与定时器失效。[动作控制器](../src/main/resources/static/js/campus-avatar-actions.js#L55)。

换装沿用当前动作，准备好新模型后提交。加载失败保留已显示模型并可重试，迟到模型会释放。语音持有同一角色控制器，真实开始、暂停、恢复、停止和音量继续驱动嘴部。馋嘴原图自带张嘴和口水表情。[模型提交](../src/main/resources/static/js/campus-avatar.js#L193)、[正常请求](../src/main/resources/static/js/campus.js#L98)。

## 素材与参考

选型参考本机dsh-pet 0.3.8的“思考冒泡、忙碌点按、吃白饭、吃长寿面、雀跃庆祝、垂头叹气冒汗”分类，以及事件状态驱动、透明素材平滑切换的组织方式。原项目采用透明视频，相关源码入口为assets/config.jsonc、src/shared/work-status.ts和src/client/pet.ts。本轮燕小北姿态由内置ImageGen根据v8生成，并经RuiC-2D网格绑定。[dsh-pet项目](https://github.com/PC2005-cloud/dsh-pet)。

12张透明原图、生成原文件名、首轮及侧身调整完整提示词保存在打包资源目录。原图均1254×1254 RGBA，构建只创建派生图层。168份运行文件以LF规范化元数据后记录SHA-256。[提示词与来源](../src/main/resources/static/media/campus/yanxiaobei-actions/prompts.json#L1)、[校验清单](../src/main/resources/static/media/campus/yanxiaobei-actions/manifest.json#L1)。

## 重建与验证

使用已有RuiC-2D checkout及Pillow、NumPy、OpenCV，执行 `python -X utf8 scripts/build_campus_avatar_actions.py --ruic <目录>`。工作目录为本仓库target，输出为打包资源目录。`--help`显示参数，成功退出0，文件或绑定失败返回非0并打印异常。[构建入口](../scripts/build_campus_avatar_actions.py#L85)。

- `node --test tests/frontend/*.test.js`，包含27项角色/动作入口和1项真实运行库schema回归。
- `python -X utf8 -m unittest discover -s tests -p 'test_avatar*_assets.py'`，检查三代资源、摘要、姿态与完整提示词。
- `python scripts/smoke_teacher_project.py --jar target/ai-guide-1.0.0.jar`，检查独立JAR业务与全部动作资源的实际HTTP摘要。

失败先查所选动作、模型HTTP状态、姿态rig与运行库schema，然后查请求版本和预览计时。绑定构建器与运行库的默认值可能不同，schema回归会拦截动作duration大于period的情况。[语义校验](../tests/frontend/campus-avatar-assets.test.js#L11)、[资产校验](../tests/test_avatar_action_assets.py#L11)、[正常入口回归](../tests/frontend/campus-avatar.test.js#L282)。

## 本机验收

2026年11月16日前端386项、Java318项、三组人物资产9项通过。真实Chromium在1440×1000逐个切换12套姿态，最终仅1个角色画布，运行时错误为空。全身跟随实测右移约8.4px、左移约7.47px，并同时产生正负倾斜矩阵，减少动态效果后归零。390×844正常输入图书馆学习与食堂吃饭均进入对应姿态及场景，无横向溢出。衣橱axe为0项violations、0项incomplete。手机为视口模拟，实体手机与角色音色服务继续按设备验收。

| 侧身学习 | 馋嘴期待 |
|---|---|
| ![学习](screenshots/campus-actions-study.png) | ![馋嘴](screenshots/campus-actions-hungry.png) |

实际IAB的340×566窗口还暴露过人物被问候及对话挤到零高度的问题。紧凑竖屏已采用整页滚动和最小人物区域，复测人物区域199px、无横向溢出，输入区可向下滚动访问。
