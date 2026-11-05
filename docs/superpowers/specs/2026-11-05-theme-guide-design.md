# 跨景点主题讲解设计

## REQ-052 与用户确认

2026-11-05用户确认“离线完整、联网增强”，选择跨景点主题讲解，并明确要求写议题后开工。此授权包含按已确认设计整理实施步骤并执行。首版一个主题、三站、一次回顾。

主题为“从整体到细节，怎样看懂眼前的景观？”，灵山大佛看整体/姿态，九龙灌浴看群雕/组合，灵山梵宫看建筑/装饰。主题内容是有来源边界的观察方法和讲解衔接，当前景点简介仍按原字段摘录并标待核验。

## API-052

GET /api/themes 返回主题数组。每个主题有 id/title/question/notice/stops。站点含 spotId/name/focus/question/bridge/recap。ID由当前 SpotService 的正式名称匹配，三站缺任意一站时该主题不可用，返回空数组。打包资源 theme-guide.json 保存方法内容，实际事实在运行时读取当前景点字段。

POST /api/chat 可选 themeId 字符串、themeLecture 布尔。缺省或空themeId沿用普通聊天，非空未知ID400。themeLecture=true要求有效主题和属于该主题的当前景点，否则400。themeId仅对本次请求有效。主题内自由问题可传themeId并省略themeLecture，离开主题景点时按普通问答处理。旧重载/调用及会话隔离契约保留。

响应新增 themeId（实际使用的主题或null）和 themeLecture（实际生成本站主题讲解时true）。只有真实成功响应可用于页面回顾。400/403/410/502和CSRF沿用，错误不提交候选会话。模型可用优先发原问题、历史、当前景点资料与经过校验的主题方法；模型失败或无Key时主题讲解使用同一套本地内容。主题自由问答沿用普通离线能力。

## 服务模块

ThemeGuideService读取可信打包JSON，动态绑定现有景点，创建主题目录和单站上下文。ChatService新增兼容重载，在一次检索快照内使用上下文。ConversationService仅在请求主题字段出现时调用新重载，旧测试和调用保持原路径。控制器提供只读目录，HTTP没有上传/编辑主题入口。

## 页面模块

主题面板提供一个“使用这条主题线”按钮，调用现有director视图的showTheme(theme)，以主题三站替换现有方案列表。普通编排、减半、雨天和恢复回到既有规则方案。沿用GuideTour当前站/下一站；snapshot增加themeId。主题准备通过GuideChatDraft携带真实spotId、tour=true、themeId、themeLecture=true。

main暂存准备时的文字与主题，发送原文才带themeLecture=true；编辑后仅带themeId作为自由问题。后续同站问题沿主题请求上下文。旧重试完整快照继续由现有生命周期管理。任何选择或重编保护草稿、取消旧请求/语音和拒绝过时回调。

ThemeGuidePage记录本页当前方案revision、themeId和唯一的成功主题讲解spotId。回顾只展示已成功收到的站点关键词，重复不增计数，准备/失败/取消不计数。换方案或新对话清空，刷新从普通方案开始。本轮记录是讲解接收状态，保持到访和理解状态独立。

## 界面与来源

使用现有白色#fff、墨绿#16352f、湖绿#11665b、浅绿#f0f7f4、边线#d1ddcf及中文衬线标题/系统正文。主题面板放在现有方案前，引导主题问题和一个选择按钮。方案每站展示焦点与承接说明，回顾为简短的三词条列表。手机单列，触控44px，纯文本DOM，polite状态。保持聊天可滚动和输入/发送可达。

新方法内容为本组AI辅助编辑的观察建议。景点事实继承老师项目且未核验，目录和本地讲解明确说明。沿用响应候选展示，不把主题方法包装成已核实史实。没有新增外部库、付费服务必需项或持久化用户记录。

## TEST-052 与验收

Java测试主题资源与动态ID、缺站/缺字段、三模式本地衔接、主题非法值400与状态回滚、模型原请求及故障降级、一次候选快照与旧调用兼容。Node测试真实main+director+journey全链路、三站及部分回顾、去重、编辑草稿、mode、重编/新对话、迟到/取消和纯文本。隔离JAR HTTP运行主题三站和非法请求回滚。

完整命令为 mvn -o verify、node --test tests/frontend/*.test.js、python scripts/check_doc_links.py、python scripts/check_data_integrity.py、python scripts/test_data_integrity.py 与隔离HTTP。截图检查1365×900、390×844、844×390。独立Standards和Spec审查后PR交付，合并状态单独报告。
