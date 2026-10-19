"""Lightweight DeepSeek-powered multi-agent scaffold generator.

The script intentionally avoids heavy agent frameworks so the contest project
can run with only the Python standard library. It borrows the common
multi-agent pattern used by projects such as AutoGen and CrewAI:

1. assign specialized roles;
2. give each role the same project brief plus prior outputs;
3. write each role's deliverable to disk;
4. produce an integration summary.

Usage:
    python scripts/deepseek_multi_agent.py --goal "补齐项目骨架"

Environment:
    DEEPSEEK_API_KEY must be set locally. The key is never printed or written.
"""

from __future__ import annotations

import argparse
import json
import os
import textwrap
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs" / "generated"


@dataclass(frozen=True)
class AgentSpec:
    name: str
    role: str
    output_file: str
    task: str


AGENTS = [
    AgentSpec(
        name="system_architect",
        role="系统架构师",
        output_file="01_architecture_gap_plan.md",
        task="审查当前骨架，输出模块缺口、目录补齐建议、接口冻结清单和三人优先级计划。",
    ),
    AgentSpec(
        name="backend_engineer",
        role="FastAPI 后端工程师",
        output_file="02_backend_todo_and_api.md",
        task="基于当前 FastAPI 骨架，输出需要新增的服务、API、数据模型、异常处理、DeepSeek 接入点和可执行 TODO。",
    ),
    AgentSpec(
        name="frontend_engineer",
        role="Vue3 前端与数字人工程师",
        output_file="03_frontend_avatar_plan.md",
        task="基于当前 Vue3 骨架，输出数字人状态机、语音按钮、口型同步、地图、大屏页面的补齐方案和组件清单。",
    ),
    AgentSpec(
        name="ai_rag_engineer",
        role="AI/RAG 工程师",
        output_file="04_ai_rag_deepseek_plan.md",
        task="以 DeepSeek 为文本核心模型，输出 RAG、Prompt、知识库切片、FAQ 命中、路线推荐、情绪分析的实现方案。",
    ),
    AgentSpec(
        name="qa_doc_engineer",
        role="测试与参赛文档工程师",
        output_file="05_test_and_submission_plan.md",
        task="输出 150 题测试集扩展方案、准确率/延迟测试方法、演示视频脚本和最终提交物检查表。",
    ),
]


def read_text(path: Path, limit: int = 6000) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="ignore")
    return text[:limit]


def collect_project_context() -> str:
    important_files = [
        "README.md",
        "docs/DESIGN.md",
        "docs/API.md",
        "backend/app/main.py",
        "backend/app/api/visitor.py",
        "backend/app/api/admin.py",
        "backend/app/services/chat_service.py",
        "backend/app/services/knowledge_service.py",
        "backend/app/services/vector_store.py",
        "frontend/src/pages/visitor/ChatGuide.vue",
        "frontend/src/components/Avatar/DigitalAvatar.vue",
        "ai_service/rag/prompt_template.md",
        "data/scenic_spots.csv",
        "data/faq.csv",
    ]
    blocks: list[str] = []
    for file_name in important_files:
        path = ROOT / file_name
        blocks.append(f"\n\n## FILE: {file_name}\n{read_text(path)}")
    return "\n".join(blocks)


def call_deepseek(
    messages: list[dict[str, str]],
    model: str,
    base_url: str,
    timeout: int,
    temperature: float,
) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("Missing DEEPSEEK_API_KEY in local environment.")

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": False,
    }
    request = urllib.request.Request(
        url=f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"DeepSeek HTTP {exc.code}: {details}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"DeepSeek request failed: {exc}") from exc

    return body["choices"][0]["message"]["content"].strip()


def run_agent(
    agent: AgentSpec,
    goal: str,
    context: str,
    prior_outputs: list[str],
    model: str,
    base_url: str,
    timeout: int,
    temperature: float,
) -> str:
    system_prompt = textwrap.dedent(
        f"""
        你是{agent.role}，正在帮助一个 3 人团队完成中国软件杯 A5 景区导览服务 AI 数字人项目。
        你的输出必须务实、可执行、适合直接落到当前 Python/FastAPI/Vue3 项目。
        不要输出空泛口号，不要要求用户重新开始项目。
        不要包含 API key、密钥或隐私信息。
        使用中文，Markdown 格式。
        """
    ).strip()

    prior_text = "\n\n".join(prior_outputs[-2:]) if prior_outputs else "暂无。"
    user_prompt = textwrap.dedent(
        f"""
        # 总目标
        {goal}

        # 当前项目上下文
        {context}

        # 上游智能体输出摘要
        {prior_text}

        # 你的任务
        {agent.task}

        # 输出要求
        1. 先给结论。
        2. 给出按 P0/P1/P2 排序的任务。
        3. 涉及代码时写明文件路径。
        4. 涉及接口时写清请求/响应字段。
        5. 最后给出“下一步可直接执行清单”。
        """
    ).strip()

    return call_deepseek(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=model,
        base_url=base_url,
        timeout=timeout,
        temperature=temperature,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--goal", default="基于现有骨架补齐 A5 景区导览服务 AI 数字人项目的工程方案。")
    parser.add_argument("--model", default=os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"))
    parser.add_argument("--base-url", default=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"))
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--sleep", type=float, default=1.0)
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    context = collect_project_context()
    prior_outputs: list[str] = []

    print(f"Using DeepSeek model: {args.model}")
    print(f"Writing generated files to: {OUTPUT_DIR}")

    for agent in AGENTS:
        print(f"Running agent: {agent.role} -> {agent.output_file}")
        output = run_agent(
            agent=agent,
            goal=args.goal,
            context=context,
            prior_outputs=prior_outputs,
            model=args.model,
            base_url=args.base_url,
            timeout=args.timeout,
            temperature=args.temperature,
        )
        target = OUTPUT_DIR / agent.output_file
        target.write_text(output + "\n", encoding="utf-8")
        prior_outputs.append(f"## {agent.role}\n{output[:3000]}")
        time.sleep(args.sleep)

    summary = "# DeepSeek 多智能体生成结果\n\n" + "\n".join(
        f"- [{agent.role}](./{agent.output_file})" for agent in AGENTS
    )
    (OUTPUT_DIR / "README.md").write_text(summary + "\n", encoding="utf-8")
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
