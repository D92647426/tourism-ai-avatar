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
        for name in ("knowledge.json", "config.json"):
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
                # REQ-033: task-scoped coaching must work without a real model/key.
                pack = json.loads(fetch(base + "/exploration/lingshan-demo.json"))
                context = {"packId": pack["id"], "packVersion": pack["version"],
                           "task": pack["tasks"][0], "observation": "课堂演示：我注意到两只手的姿态不同，想再看看。", "mode": "demo"}
                coach = json.loads(fetch(base + "/api/exploration/coach", context))
                assert coach.get("mode") == "local-coach" and coach.get("fallback") is True
                assert isinstance(coach.get("reply"), str) and coach["reply"].strip()
                assert isinstance(coach.get("followUp"), str) and 0 < len(coach["followUp"]) <= 160
                assert coach.get("source") == context["task"]["source"]
                assert coach.get("reference") == context["task"]["reference"]
                try:
                    fetch(base + "/api/exploration/coach", {**context, "observation": "a"})
                    raise AssertionError("Short observations must fail validation.")
                except urllib.error.HTTPError as error:
                    assert error.code == 400
                    assert json.loads(error.read()).get("code") == "INVALID_CONTEXT"
                model_url = base + "/models/haru/haru.model.json"
                model = json.loads(fetch(model_url))
                assert model.get("model"), "Live2D model definition is missing."
                assert fetch(urllib.parse.urljoin(model_url, model["model"]))
                assert fetch(base + "/js/live2d-helper.js")
                return {"status": "passed", "spot_count": len(spots),
                        "checks": ["homepage", "spots", "offline_chat", "offline_coach", "coach_validation", "live2d_definition",
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
