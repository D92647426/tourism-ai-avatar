"""REQ-027: build-artifact HTTP verification; see docs/test_reference.md."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request


def fetch(url: str, payload: dict | None = None) -> bytes:
    """Read a local HTTP endpoint, optionally sending JSON."""
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={"Content-Type": "application/json"} if payload is not None else {},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.read()


def verify(jar: Path, java: str, port: int, timeout: float) -> dict:
    """Start only the supplied JAR with isolated local data and an empty model key."""
    jar = jar.resolve()
    if not jar.is_file():
        raise ValueError(f"JAR not found: {jar}. Build with mvn package first.")
    if not 1 <= port <= 65535:
        raise ValueError("Port must be between 1 and 65535.")
    with socket.socket() as probe:
        probe.settimeout(0.5)
        if probe.connect_ex(("127.0.0.1", port)) == 0:
            raise ValueError(f"Port {port} is already occupied; choose --port.")
    root = Path(__file__).resolve().parents[1]
    base = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(prefix="teacher-guide-smoke-") as folder:
        work = Path(folder).resolve()
        assert work.is_relative_to(Path(tempfile.gettempdir()).resolve())
        data = work / "data"
        data.mkdir()
        # REQ-035: leave knowledge absent to exercise the JAR's bundled bootstrap.
        for name in ("config.json",):
            if (root / "data" / name).is_file():
                shutil.copy2(root / "data" / name, data / name)
        log_path = work / "server.log"
        with log_path.open("w", encoding="utf-8") as log:
            process = subprocess.Popen(
                [java, "-jar", str(jar), f"--server.port={port}",
                 "--server.address=127.0.0.1", "--ai.api-key="],
                cwd=work,
                stdout=log,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            try:
                deadline = time.monotonic() + timeout
                while True:
                    if process.poll() is not None:
                        raise RuntimeError("Java server exited before becoming ready.")
                    try:
                        home = fetch(base + "/")
                        break
                    except (urllib.error.URLError, TimeoutError, OSError):
                        if time.monotonic() >= deadline:
                            raise RuntimeError("Java server did not become ready in time.")
                        time.sleep(0.25)
                assert b"live2d" in home.lower(), "Homepage does not reference Live2D."
                spots = json.loads(fetch(base + "/api/spots"))
                assert isinstance(spots, list) and spots, "No scenic spots returned."
                chat = json.loads(fetch(base + "/api/chat", {"message": "hello"}))
                assert isinstance(chat.get("reply"), str) and chat["reply"].strip()
                assert chat.get("fallback") is True, "Smoke test must use offline fallback."
                library = json.loads((data / "knowledge.json").read_text(encoding="utf-8"))
                assert [item["id"] for item in library] == list(range(1, 17))
                assert all("待补充" in item["content"] for item in library[:3])
                for name in ("灵山大佛", "灵山梵宫", "九龙灌浴"):
                    reply = json.loads(fetch(base + "/api/chat", {"message": name}))
                    assert reply["fallback"] is True and name in reply["reply"]
                    assert "未核验" in reply["reply"] and "景区公告" in reply["reply"]
                    assert "\ufffd" not in reply["reply"]
                pending = json.loads(fetch(base + "/api/chat", {"message": "待补充"}))
                assert pending["fallback"] is True and "原始正文缺失" in pending["reply"]
                ticket = json.loads(fetch(base + "/api/chat", {"message": "门票多少钱"}))
                assert "50元/位" not in ticket["reply"] and "35元/位" not in ticket["reply"]
                assert "景区公告" in ticket["reply"]
                # REQ-037: check knowledge evidence separately from scenic fallback.
                for question, expected_id in (("大佛有什么故事？", 4), ("梵宫怎么逛？", 5)):
                    result = json.loads(fetch(base + "/api/chat", {"message": question}))
                    refs = result["knowledgeReferences"]
                    assert result["fallback"] is True and refs[0]["id"] == expected_id
                    assert refs[0]["source"] == f"local-knowledge:{expected_id}"
                    assert f"资料 K{expected_id}】" in result["reply"]
                ambiguous = json.loads(fetch(base + "/api/chat", {"message": "它有什么故事？"}))
                assert ambiguous["knowledgeReferences"] == []
                assert "请补充景点名称" in ambiguous["reply"]
                model_url = base + "/models/haru/haru.model.json"
                model = json.loads(fetch(model_url))
                assert model.get("model"), "Live2D model definition is missing."
                assert fetch(urllib.parse.urljoin(model_url, model["model"]))
                assert fetch(base + "/js/live2d-helper.js")
                return {"status": "passed", "spot_count": len(spots),
                        "checks": ["homepage", "spots", "offline_chat", "bundled_knowledge",
                                   "three_spot_sample_boundaries", "pending_content", "ticket_boundary",
                                   "natural_knowledge_references", "ambiguous_question", "live2d_definition",
                                   "live2d_model_file", "live2d_helper"]}
            except Exception:
                log.flush()
                print(log_path.read_text(encoding="utf-8", errors="replace")[-4000:])
                raise
            finally:
                if process.poll() is None:
                    if os.name == "nt":
                        subprocess.run(
                            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                            capture_output=True, check=False,
                        )
                    else:
                        process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)


def main() -> int:
    """CLI: validate a packaged teacher baseline; exit 0 on pass, 1 on failure."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", required=True, type=Path, help="Maven-generated application JAR")
    parser.add_argument("--java", default="java", help="Java executable; default: java")
    parser.add_argument("--port", type=int, default=18080, help="Local test port; default: 18080")
    parser.add_argument("--timeout", type=float, default=60, help="Startup deadline in seconds")
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.jar, args.java, args.port, args.timeout)))
        return 0
    except Exception as exc:
        print(f"Smoke verification failed: {type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
