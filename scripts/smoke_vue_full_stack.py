from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "5173"))

from run_local import ensure_postgres_service  # noqa: E402


def resolve_command(command: str) -> str:
    candidates = [command]
    if os.name == "nt":
        candidates.extend([f"{command}.cmd", f"{command}.exe", f"{command}.ps1"])
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise FileNotFoundError(command)


def wait_url(url: str, expected: str, timeout_seconds: int = 45) -> str:
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


def is_url_ready(url: str, expected: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            body = response.read().decode("utf-8")
            return response.status == 200 and expected in body
    except Exception:
        return False


def terminate_tree(process: subprocess.Popen | None) -> None:
    if process is None:
        return
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], check=False, capture_output=True)
    else:
        process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


def main() -> int:
    ensure_postgres_service()
    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND)
    backend_url = f"http://127.0.0.1:{BACKEND_PORT}/api/health"
    frontend_url = f"http://127.0.0.1:{FRONTEND_PORT}/"
    backend: subprocess.Popen | None = None
    frontend: subprocess.Popen | None = None

    if is_url_ready(backend_url, '"status":"ok"'):
        print(f"reuse backend: {backend_url}", flush=True)
    else:
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

    if is_url_ready(frontend_url, '<div id="app"></div>'):
        print(f"reuse frontend: {frontend_url}", flush=True)
    else:
        frontend = subprocess.Popen(
            [
                resolve_command("npm"),
                "run",
                "dev",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                str(FRONTEND_PORT),
                "--strictPort",
            ],
            cwd=FRONTEND,
        )
    try:
        wait_url(backend_url, '"status":"ok"')
        wait_url(frontend_url, '<div id="app"></div>')
        subprocess.run([sys.executable, "scripts/smoke_test.py"], cwd=ROOT, check=True)
        print(f"vue full stack ok: http://127.0.0.1:{FRONTEND_PORT}", flush=True)
    finally:
        terminate_tree(frontend)
        terminate_tree(backend)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
