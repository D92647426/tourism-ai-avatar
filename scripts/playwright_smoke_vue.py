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
OUTPUT = ROOT / "output" / "playwright"
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "5173"))
GIT_BASH = Path(r"C:\Program Files\Git\bin\bash.exe")
PWCLI = Path.home() / ".codex" / "skills" / "playwright" / "scripts" / "playwright_cli.sh"

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


def wait_url(url: str, expected: str, timeout_seconds: int = 45) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                body = response.read().decode("utf-8")
                if response.status == 200 and expected in body:
                    return
        except Exception:
            time.sleep(0.5)
    raise TimeoutError(url)


def terminate_tree(process: subprocess.Popen) -> None:
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


def run_git_bash(command: str) -> subprocess.CompletedProcess:
    if not GIT_BASH.exists():
        raise FileNotFoundError(str(GIT_BASH))
    return subprocess.run(
        [str(GIT_BASH), "-lc", command],
        cwd=ROOT,
        check=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def main() -> int:
    if not PWCLI.exists():
        raise FileNotFoundError(str(PWCLI))
    OUTPUT.mkdir(parents=True, exist_ok=True)
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
        [
            resolve_command("npm"),
            "run",
            "dev",
            "--",
            "--host",
            "127.0.0.1",
            "--port",
            str(FRONTEND_PORT),
        ],
        cwd=FRONTEND,
    )
    try:
        wait_url(f"http://127.0.0.1:{BACKEND_PORT}/api/health", '"status":"ok"')
        wait_url(f"http://127.0.0.1:{FRONTEND_PORT}/", '<div id="app"></div>')
        bash_pwcli = str(PWCLI).replace("\\", "/").replace("C:", "/c")
        home_screenshot = str((OUTPUT / "vue-home.png").resolve()).replace("\\", "/").replace("C:", "/c")
        guide_screenshot = str((OUTPUT / "vue-guide.png").resolve()).replace("\\", "/").replace("C:", "/c")
        admin_screenshot = str((OUTPUT / "vue-admin-login.png").resolve()).replace("\\", "/").replace("C:", "/c")
        run_git_bash(f'"{bash_pwcli}" open http://127.0.0.1:{FRONTEND_PORT}')
        run_git_bash(f'"{bash_pwcli}" snapshot')
        run_git_bash(f'"{bash_pwcli}" screenshot --output "{home_screenshot}"')
        run_git_bash(f'"{bash_pwcli}" open http://127.0.0.1:{FRONTEND_PORT}/guide')
        run_git_bash(f'"{bash_pwcli}" snapshot')
        run_git_bash(f'"{bash_pwcli}" screenshot --output "{guide_screenshot}"')
        run_git_bash(f'"{bash_pwcli}" open http://127.0.0.1:{FRONTEND_PORT}/admin/login')
        run_git_bash(f'"{bash_pwcli}" snapshot')
        run_git_bash(f'"{bash_pwcli}" screenshot --output "{admin_screenshot}"')
        print(f"playwright screenshots: {OUTPUT / 'vue-home.png'}, {OUTPUT / 'vue-guide.png'}, {OUTPUT / 'vue-admin-login.png'}", flush=True)
    finally:
        terminate_tree(frontend)
        terminate_tree(backend)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
