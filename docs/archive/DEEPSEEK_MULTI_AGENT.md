# DeepSeek 多智能体脚本使用说明

## 1. 环境变量

脚本和后端都从本地环境读取 DeepSeek Key，不要把真实 key 写入仓库。

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek API Key"
$env:DEEPSEEK_MODEL="deepseek-v4-flash"
```

默认接口：

```text
https://api.deepseek.com/chat/completions
```

## 2. 运行多智能体生成器

```powershell
python scripts/deepseek_multi_agent.py --goal "补齐 A5 景区导览服务 AI 数字人项目骨架"
```

输出目录：

```text
docs/generated/
```

包含：

```text
01_architecture_gap_plan.md
02_backend_todo_and_api.md
03_frontend_avatar_plan.md
04_ai_rag_deepseek_plan.md
05_test_and_submission_plan.md
README.md
```

## 3. 验证后端 DeepSeek 问答

```powershell
$env:PYTHONPATH="backend"
python - <<'PY'
from app.schemas.visitor import ChatTextRequest
from app.services.chat_service import chat_with_text

result = chat_with_text(ChatTextRequest(
    session_uuid="demo",
    message="我只有两个小时，喜欢历史和拍照，应该怎么逛？"
))
print(result["model_used"])
print(result["answer"])
PY
```

若本地没有 `DEEPSEEK_API_KEY` 或 API 调用失败，后端会自动回退到 mock 回答，保证演示链路可用。
