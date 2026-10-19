from __future__ import annotations

import json
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPOSE_FILE = ROOT / "deploy" / "docker-compose.allinone.yml"
BASE_URL = "http://127.0.0.1:8000"
POSTGRES_PORT = 5433


def resolve_command(command: str) -> str:
    candidates = [command]
    if sys.platform.startswith("win"):
        candidates.extend([f"{command}.cmd", f"{command}.exe"])
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise FileNotFoundError(command)


def run_compose(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    cmd = [resolve_command("docker"), "compose", "-f", str(COMPOSE_FILE), *args]
    print(f"$ {' '.join(cmd)}  (cwd={ROOT})")
    return subprocess.run(cmd, cwd=ROOT, check=check)


def http_json(url: str, method: str = "GET", payload: dict | None = None, headers: dict[str, str] | None = None) -> dict:
    body = None
    request_headers = headers or {}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_headers = {"Content-Type": "application/json", **request_headers}
    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_http_ok(url: str, timeout_seconds: int = 300) -> dict:
    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        try:
            return http_json(url)
        except Exception as exc:
            last_error = str(exc)
            time.sleep(2)
    raise TimeoutError(f"timed out waiting for {url}: {last_error}")


def wait_port_open(port: int, timeout_seconds: int = 120) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=2):
                return
        except OSError:
            time.sleep(1)
    raise TimeoutError(f"timed out waiting for TCP port {port}")


def main() -> int:
    try:
        run_compose("up", "-d", "--build")
        health = wait_http_ok(f"{BASE_URL}/api/health")
        assert health["data"]["status"] == "ok"
        wait_port_open(POSTGRES_PORT)

        home = urllib.request.urlopen(f"{BASE_URL}/guide", timeout=10).read().decode("utf-8")
        assert 'id="app"' in home.lower()

        login = http_json(
            f"{BASE_URL}/api/v1/auth/login",
            method="POST",
            payload={"username": "admin", "password": "123456"},
        )
        token = login["data"]["token"]
        status = http_json(
            f"{BASE_URL}/api/v1/admin/system/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = status["data"]
        assert data["database_backend"] == "postgresql", data
        assert data["vector_backend"] == "pgvector", data

        print(
            json.dumps(
                {
                    "health": health["data"]["status"],
                    "database_backend": data["database_backend"],
                    "vector_backend": data["vector_backend"],
                    "guide_url": f"{BASE_URL}/guide",
                    "admin_url": f"{BASE_URL}/admin/login",
                    "postgres_port": POSTGRES_PORT,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    finally:
        run_compose("down", check=False)


if __name__ == "__main__":
    raise SystemExit(main())
