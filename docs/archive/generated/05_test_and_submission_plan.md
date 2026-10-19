## 结论

基于现有 LingTour AI 骨架，以下方案聚焦 **150 题测试集扩展、准确率/延迟测试方法、演示视频脚本和最终提交物检查表**，直接服务于中国软件杯 A5 赛题的交付闭环。所有内容可立即在当前 Python/FastAPI/Vue3 项目中落地。

---

## P0 任务（必须交付，5 天内完成）

### 1. 150 题测试集扩展 — 新建 `data/test_cases_150.csv`

**目标**：覆盖 FAQ、景点知识、路线推荐、开放时间、异常输入、边缘场景。从现有 `faq.csv` 和 `scenic_spots.csv` 基础上扩展至 150 题。

**扩展策略**（每种类型至少 20 题，总 150）：
- **FAQ 同名变形**（如“开门时间”、“闭园时间”）→ 20 题
- **景点知识问答**（如“古建筑群值得看吗？”、“观景台怎么走？”）→ 30 题
- **路线推荐**（含条件如“2小时”、“带老人”、“亲子”）→ 25 题
- **开放时间/票价**（如“门票多少钱”）→ 15 题
- **图片识别模拟**（仅文本，标记 `image_only: true`）→ 10 题
- **复杂多轮对话**（上下文依赖，如“刚才说的洗手间在哪？”）→ 20 题
- **异常与边界**（空字符串、特殊字符、超长、重复提问）→ 15 题
- **跨语言/方言**（如“How to go to the observation deck?”）→ 10 题
- **情感倾向**（愤怒、抱怨、赞美）→ 10 题
- **未知问题**（如“今天天气怎么样？”）→ 5 题

**字段设计**：

```csv
id,category,question,expected_answer_keywords,expected_intent,expected_emotion,image_only,context,notes
1,FAQ_变形,景区几点开门,开放时间;现场公告,scenic_qa,neutral,false,,测试开放时间同义变形
2,路线推荐,带老人玩两小时怎么逛,路线;入口;观景台,route_recommendation,helpful,false,,条件约束路线推荐
...
```

**总计需 150 行**。可通过脚本自动生成基础变形，手动审核。

**建议**：直接在 `backend/tests/` 目录下创建一个 `test_cases_150.csv`，或放在 `data/` 中。

### 2. 准确率测试工具 — 新建 `backend/scripts/run_accuracy_tests.py`

**目标**：自动加载测试集，调用核心 API（文本问答与路线推荐），对比输出是否符合预期。

```python
# backend/scripts/run_accuracy_tests.py
import csv
import json
import requests
import sys
sys.path.insert(0, '..')

BASE_URL = "http://localhost:8000"

def load_test_cases(path="data/test_cases_150.csv"):
    cases = []
    with open(path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cases.append(row)
    return cases

def evaluate_single(case):
    # 创建会话
    session_resp = requests.post(f"{BASE_URL}/api/visitor/sessions", json={"user_profile": "普通游客"})
    session_uuid = session_resp.json()["data"]["session_uuid"]
    
    payload = {
        "session_uuid": session_uuid,
        "message": case["question"]
    }
    resp = requests.post(f"{BASE_URL}/api/visitor/chat/text", json=payload)
    result = resp.json()
    if result["code"] != 0:
        return {"pass": False, "error": "API error"}
    data = result["data"]
    answer = data["answer"]
    intent = data["intent"]
    emotion = data["emotion"]
    
    expected_keywords = [kw.strip() for kw in case["expected_answer_keywords"].split(";") if kw.strip()]
    keyword_pass = all(kw in answer for kw in expected_keywords) if expected_keywords else True
    intent_pass = (intent == case["expected_intent"]) if case["expected_intent"] else True
    emotion_pass = (emotion == case["expected_emotion"]) if case["expected_emotion"] else True
    overall_pass = keyword_pass and intent_pass and emotion_pass
    
    return {
        "id": case["id"],
        "question": case["question"],
        "answer": answer,
        "intent": intent,
        "emotion": emotion,
        "keyword_pass": keyword_pass,
        "intent_pass": intent_pass,
        "emotion_pass": emotion_pass,
        "pass": overall_pass
    }

def run_all():
    cases = load_test_cases()
    results = []
    passes = 0
    for case in cases:
        if case.get("image_only") == "true":
            # 图片测试需特殊处理，本例跳过
            continue
        r = evaluate_single(case)
        results.append(r)
        if r["pass"]:
            passes += 1
    print(f"Total: {len(results)}, Pass: {passes}, Accuracy: {passes/len(results)*100:.2f}%")
    
    # 输出详细报告
    with open("data/test_report_accuracy.json", "w", encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("Report saved to data/test_report_accuracy.json")

if __name__ == "__main__":
    run_all()
```

### 3. 延迟测试工具 — 新建 `backend/scripts/run_latency_tests.py`

**目标**：对核心 API 进行 100 次随机调用，统计 P50/P90/P99 延迟。

```python
# backend/scripts/run_latency_tests.py
import csv
import time
import random
import requests
import numpy as np

BASE_URL = "http://localhost:8000"

def load_test_cases(path="data/test_cases_150.csv"):
    cases = []
    with open(path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("image_only") == "true":
                continue
            cases.append(row["question"])
    return cases

def measure_latency(questions):
    latencies = []
    for q in questions:
        # 创建会话
        start = time.time()
        sess_resp = requests.post(f"{BASE_URL}/api/visitor/sessions", json={}, timeout=10)
        session_uuid = sess_resp.json()["data"]["session_uuid"]
        payload = {"session_uuid": session_uuid, "message": q}
        resp = requests.post(f"{BASE_URL}/api/visitor/chat/text", json=payload, timeout=30)
        elapsed = (time.time() - start) * 1000  # ms
        latencies.append(elapsed)
    return latencies

def report(latencies):
    lat_arr = np.array(latencies)
    print(f"Count: {len(lat_arr)}")
    print(f"Mean: {np.mean(lat_arr):.2f} ms")
    print(f"P50: {np.percentile(lat_arr, 50):.2f} ms")
    print(f"P90: {np.percentile(lat_arr, 90):.2f} ms")
    print(f"P99: {np.percentile(lat_arr, 99):.2f} ms")
    
    with open("data/test_report_latency.json", "w") as f:
        import json
        json.dump({"latencies_ms": lat_arr.tolist(), "p50": np.percentile(lat_arr,50), "p90": np.percentile(lat_arr,90), "p99": np.percentile(lat_arr,99)}, f)

if __name__ == "__main__":
    questions = random.sample(load_test_cases(), min(100, 150))
    lats = measure_latency(questions)
    report(lats)
```

---

## P1 任务（增强测试与文档，提交前 2 天完成）

### 1. 演示视频脚本 — 新建 `docs/demo_video_script.md`

**目标**：5 分钟循环展示 MVP 闭环，包括核心功能与后台大屏。

```markdown
# 演示视频脚本（5分钟）

## 场景 1：游客第一次使用（1分30秒）
- 打开游客端页面，数字人“灵灵”微笑待机
- 文字输入“第一次来怎么逛”
- 数字人进入“思考”状态，2s后回答，显示路线卡片
- 数字人“讲解中”口型同步，播放语音音频
- 台词：建议从入口→古建筑群→文化展馆→观景台

## 场景 2：语音交互（1分钟）
- 点击麦克风按钮，状态变“倾听”
- 口述“洗手间在哪？”
- 语音发送，状态变“思考”
- 回答，并展示引用来源（FAQ）

## 场景 3：图片识别（30秒）
- 上传景区古建筑群图片，提问“这是哪？”
- 返回景点识别结果和讲解

## 场景 4：管理后台（1分30秒）
- 登录后台，展示数据大屏：会话数、热门问题、情绪比例
- 切换知识库管理，显示FAQ和文档列表
- 展示游客感受度报告（图表）

## 结尾（30秒）
- 返回首页，点击“个性化路线”
- 输入时间/偏好，显示推荐路线
- 总结：完整闭环，AI 数字人导游

**注意事项**：语音文件提前录制，确保音频清晰；数字人动画流畅。
```

### 2. 最终提交物检查表 — 新建 `docs/submission_checklist.md`

```markdown
# A5 赛题最终提交物检查表

## 1. 项目代码
- [ ] 完整可运行项目（前后端后端均已安装依赖）
- [ ] Docker Compose 一键启动
- [ ] 核心 API 全部实现（文档 API.md 对应）
- [ ] RAG 知识库已初始化（ChromaDB 或 PostgreSQL）
- [ ] 多智能体脚本可用（`deepseek_multi_agent.py`）

## 2. 测试数据
- [ ] 150 题测试集 `data/test_cases_150.csv`
- [ ] 准确率测试报告 `data/test_report_accuracy.json`
- [ ] 延迟测试报告 `data/test_report_latency.json`
- [ ] 测试脚本可重复执行

## 3. 演示材料
- [ ] 演示视频（MP4，不超过 10 分钟，清晰展示 MVP）
- [ ] 演示视频脚本 `docs/demo_video_script.md`

## 4. 文档
- [ ] 系统设计说明书 `docs/DESIGN.md`（已存在，需确认覆盖所有模块）
- [ ] API 接口文档 `docs/API.md`（已存在，需确认与实际一致）
- [ ] 部署与运行说明 `README.md`（已存在，需更新 Docker 启动和开发模式）
- [ ] 测试报告（准确率/延迟）整合说明 `docs/test_report_summary.md`

## 5. 其他
- [ ] 开源许可文件（可选）
- [ ] 环境变量模板 `.env.example`（不包含密钥）
- [ ] 提交格式：按大赛要求压缩为 zip 或 rar
```

---

## P2 任务（完善测试体系，提交前 1 天完成）

- 自动生成 150 题测试集脚本（基于模板+随机变形）
- 异常场景专项测试（网络故障、后端不可用、超长输入、并发测试）
- 集成 CI 脚本（可选，非强制）

---

## 下一步可直接执行清单

1. **立即创建** `data/test_cases_150.csv` 文件，复制现有 `faq.csv` 问题，按上述扩展策略手动添加至 150 题（1 小时）。
2. **复制** `backend/scripts/run_accuracy_tests.py` 和 `run_latency_tests.py` 到项目，并安装依赖 `requests, numpy`（10 分钟）。
3. **运行测试**：确保后端已启动（`uvicorn app.main:app`），执行 `python run_accuracy_tests.py`，记录准确率（预期 >80%）；执行 `python run_latency_tests.py`，记录延迟（P99 < 3s 可接受）。
4. **编写演示视频脚本**：根据 `docs/demo_video_script.md` 录制 5 分钟屏幕录像，包含语音输入和数字人动画。
5. **填写提交物检查表**：对照 checklist 逐条确认，确保无遗漏。
6. **整理最终提交包**：将项目代码、测试报告、演示视频、文档打包。

以上所有步骤均基于现有骨架，无需重构，可直接在当前项目上执行。
