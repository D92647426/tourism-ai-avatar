from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "5173"))

from run_local import ensure_postgres_service  # noqa: E402


def wait_url(url: str, expected: str, timeout_seconds: int = 30) -> str:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                body = response.read().decode("utf-8")
                if response.status == 200 and expected in body:
                    return body
        except Exception:
            time.sleep(0.5)
    raise TimeoutError(url)


def main() -> int:
    ensure_postgres_service()
    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND)
    backend = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(BACKEND_PORT),
        ],
        cwd=BACKEND,
        env=env,
    )
    frontend = subprocess.Popen(
        [sys.executable, "scripts/serve_static_frontend.py", "--port", str(FRONTEND_PORT)],
        cwd=ROOT,
    )
    try:
        wait_url(f"http://127.0.0.1:{BACKEND_PORT}/api/health", '"status":"ok"')
        wait_url(f"http://127.0.0.1:{FRONTEND_PORT}/", "LingTour AI 数字人导游平台")
        subprocess.run([sys.executable, "scripts/smoke_test.py"], cwd=ROOT, check=True)
        print(f"full stack ok: http://127.0.0.1:{FRONTEND_PORT}")
    finally:
        frontend.terminate()
        backend.terminate()
        frontend.wait(timeout=10)
        backend.wait(timeout=10)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
