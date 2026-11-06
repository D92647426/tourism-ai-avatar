# 本地角色声线运行（REQ-053 / #50）

本机外置环境在项目同级 `voice-lab`：`.venv`、`GPT-SoVITS`、`models/tomori-gpt.ckpt`、`models/tomori-sovits.pth`、`references/tomori.mp3`。不提交权重、音频、用户文案或虚拟环境。

## 启动与切换

在仓库根目录打开PowerShell，使用已经安装的CUDA环境启动语音服务：

```powershell
$env:PYTHONIOENCODING='utf-8'
..\voice-lab\.venv\Scripts\python.exe scripts/local_voice_server.py --engine-dir '..\voice-lab\GPT-SoVITS' --assets-dir '..\voice-lab' --port 9880
```

打印 `Local voice ready` 后完成预热。服务固定监听127.0.0.1；GET `http://127.0.0.1:9880/health` 返回 `{"ready":true}`。首次加载和预热可能需要几十秒；进程须保持运行。另一个终端启动网页：

```powershell
java -jar target/ai-guide-1.0.0.jar --speech.local.enabled=true --speech.local.base-url=http://127.0.0.1:9880
```

也可设置 `LOCAL_SPEECH_ENABLED=true`、`LOCAL_SPEECH_BASE_URL=http://127.0.0.1:9880`，不自动读取 `.env`。本地服务默认禁用；未开启或不可用时回退系统声音。登录游客账号即可提问和回听。管理员“数字人配置→声音”可切换“本地角色声线”与设备声音，保存后游客刷新生效。新配置模板默认 `local:character`，已有其他选择保持有效。

网页只访问Java同源接口。手机通过服务器生成语音，不要求手机安装GPU/Python；Android WebView、局域网及多人吞吐尚需另验。

## 组员环境与素材

基础网页仍只需要Java。新声线额外需要Python/CUDA、FFmpeg、中文BERT/CNHubert/G2PW基础模型。本机8GB显存已实测，其他硬件另验。

- 引擎：[GPT-SoVITS 20250228v3](https://github.com/RVC-Boss/GPT-SoVITS/tree/20250228v3)。
- 声线：[原作者演示](https://www.bilibili.com/video/BV1DddiYiEna/)、[此次权重镜像](https://huggingface.co/WLWolf56/gpt-sovits-model/tree/8ca20dd1f84feda57396531ef5413130a5d9cc60/动漫/mygo)。尚未核实镜像与原网盘文件相同。
- 参考短句：[公开语音数据集](https://huggingface.co/datasets/GuangChen233/Takamatsu_Tomori_Voices_0.46_Hours)。

引擎MIT不代表声线/音频也按MIT授权。正式再分发前分别核对素材条件。组员按引擎官方文档准备同版本环境，再使用 [CLI依赖](../scripts/requirements-local-voice.txt#L1)。[加载入口](../scripts/local_voice_server.py#L94) 定义本地文件布局和兼容方式。本机外置引擎的 `tools/my_utils.py` 已允许缺少Gradio时转为标准warnings；新机器须做同样调整或安装兼容Gradio。此流程不宣称已在全新GPU机器自动安装成功。

## 故障与边界

- 503：禁用、未预热、未启动或并发已满；自动回退系统声音。401/403：登录/CSRF，沿用网页登录流程。
- 声线未切换：检查管理员保存的voiceType及Java启动参数。无中文系统声线时回退无法发声，文字仍可读。
- 浏览器拒绝自动播放：提示点击回听，不反复尝试其他声音。
- 逐句预取减少首句等待，不保证每段没有间隙；开始新问题/后台/停止立即清理前端。已经在GPU推理的短句不能硬中断，将在该句完成后释放。
- 正文不写入推理日志。单句最多80 Unicode字符，网页按标点及32字符切句；最多2个HTTP请求、1个实际推理。Java连接800ms、单次读取12秒、响应最多4MiB；网页初始等待8秒后回退。

接口和生命周期见 [设计](local_voice_design.md#L1)；测试函数和命令见 [测试索引](test_reference.md#L1)。单元测试不代替真实音质或Android真机验收。
