"""REQ-027 / REQ-030 / REQ-038: build-artifact HTTP verification; see docs/test_reference.md."""
from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
from pathlib import Path
import shutil
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request


def make_opener() -> urllib.request.OpenerDirector:
    """Build a cookie-aware opener so JSESSIONID / XSRF-TOKEN survive across calls."""
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def _request(url: str, payload: dict | None, headers: dict | None, method: str | None = None) -> urllib.request.Request:
    merged = {"Content-Type": "application/json"} if payload is not None else {}
    if headers:
        merged.update(headers)
    return urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers=merged, method=method,
    )


def _open(request: urllib.request.Request,
          opener: urllib.request.OpenerDirector | None):
    """Open a request with the cookie-aware opener when provided, else the module default."""
    if opener is not None:
        return opener.open(request, timeout=5)
    return urllib.request.urlopen(request, timeout=5)


def fetch(url: str, payload: dict | None = None, headers: dict | None = None,
          opener: urllib.request.OpenerDirector | None = None, method: str | None = None) -> bytes:
    """Read a local HTTP endpoint, optionally sending JSON and browser-like headers."""
    with _open(_request(url, payload, headers, method), opener) as response:
        return response.read()


def status_of(url: str, payload: dict | None = None, headers: dict | None = None,
              opener: urllib.request.OpenerDirector | None = None, method: str | None = None) -> tuple[int, bytes]:
    """Return (status code, body) and turn expected 4xx responses into data, not exceptions."""
    try:
        with _open(_request(url, payload, headers, method), opener) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def wait_ready(process: subprocess.Popen, base: str, timeout: float) -> bytes:
    """REQ-038: bounded readiness check shared by initial launch and persistence restart."""
    deadline = time.monotonic() + timeout
    while True:
        if process.poll() is not None:
            raise RuntimeError("Java server exited before becoming ready.")
        try:
            return fetch(base + "/")
        except (urllib.error.URLError, TimeoutError, OSError):
            if time.monotonic() >= deadline:
                raise RuntimeError("Java server did not become ready in time.")
            time.sleep(0.25)


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
    opener = make_opener()
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
            # REQ-038: disposable credentials exist only in this isolated test process.
            password = secrets.token_urlsafe(24)
            environment = {**os.environ, "APP_ADMIN_USERNAME": "display-smoke-admin",
                           "APP_ADMIN_PASSWORD": password}

            def start_server():
                return subprocess.Popen(
                    [java, "-jar", str(jar), f"--server.port={port}",
                     "--server.address=127.0.0.1", "--ai.api-key="],
                    cwd=work, env=environment, stdout=log, stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)

            process = start_server()
            try:
                home = wait_ready(process, base, timeout)
                assert b"live2d" in home.lower(), "Homepage does not reference Live2D."
                spots = json.loads(fetch(base + "/api/spots"))
                assert isinstance(spots, list) and spots, "No scenic spots returned."

                csrf = json.loads(fetch(base + "/api/auth/csrf", opener=opener))
                token = csrf.get("token") or ""
                assert token, "CSRF endpoint did not return a token."
                csrf_header = csrf.get("headerName") or "X-XSRF-TOKEN"

                public_config = json.loads(fetch(base + "/api/digital-human-config"))
                config_text = json.dumps(public_config, ensure_ascii=False).lower()
                assert public_config.get("name"), "Public digital-human config is empty."
                assert "password" not in config_text and "credential" not in config_text, (
                    "Public config must not expose credentials.")

                admin_status, admin_body = status_of(base + "/api/admin/dashboard", opener=opener)
                assert admin_status == 401, f"Anonymous admin request must be 401, got {admin_status}"
                assert json.loads(admin_body).get("success") is False

                unsigned_status, _ = status_of(
                    base + "/api/chat", {"message": "no-csrf"}, opener=opener)
                assert unsigned_status == 403, (
                    f"State-changing request without CSRF must be 403, got {unsigned_status}")

                chat = json.loads(fetch(base + "/api/chat", {"message": "hello"},
                                        {csrf_header: token}, opener))
                assert isinstance(chat.get("reply"), str) and chat["reply"].strip()
                assert chat.get("fallback") is True, "Smoke test must use offline fallback."

                # REQ-039: real cookie/CSRF requests, distinct visitors and spot switches.
                assert chat.get("conversationId"), "Server must establish a conversation id."
                snapshot = json.loads(fetch(base + "/api/chat/context", opener=opener))
                assert snapshot["conversationId"] == chat["conversationId"]
                assert snapshot["narrationMode"] == "standard"
                first, second = spots[0], spots[1]
                opening = json.loads(fetch(base + "/api/chat",
                    {"message":"它什么时候开放", "spotId":first["id"],
                     "conversationId":chat["conversationId"]}, {csrf_header:token}, opener))
                assert opening["spotId"] == first["id"] and first["name"] in opening["reply"]
                assert first["openingHours"] in opening["reply"], "Opening-hour follow-up must answer the fact."
                switched = json.loads(fetch(base + "/api/chat",
                    {"message":"它有什么故事", "spotId":second["id"],
                     "conversationId":chat["conversationId"]}, {csrf_header:token}, opener))
                assert switched["spotId"] == second["id"] and second["name"] in switched["reply"]
                assert second["history"][:20] in switched["reply"], "Story follow-up must use the new place's history."
                # REQ-046: actual cookie/session mode persistence, invalid rollback, reset.
                family = json.loads(fetch(base + "/api/chat",
                    {"message":"介绍一下这里", "spotId":first["id"], "narrationMode":"family",
                     "conversationId":chat["conversationId"]}, {csrf_header:token}, opener))
                assert family["narrationMode"] == "family" and first["brief"] in family["reply"]
                assert "可以和孩子一起看看" in family["reply"] and "未核验" in family["reply"]
                follow = json.loads(fetch(base + "/api/chat",
                    {"message":"它几点开放", "conversationId":chat["conversationId"]}, {csrf_header:token}, opener))
                assert follow["narrationMode"] == "family" and first["openingHours"] in follow["reply"]
                brief = json.loads(fetch(base + "/api/chat",
                    {"message":"介绍一下这里", "narrationMode":"brief",
                     "conversationId":chat["conversationId"]}, {csrf_header:token}, opener))
                assert brief["narrationMode"] == "brief" and first["brief"] in brief["reply"]
                assert "可以和孩子一起看看" not in brief["reply"]
                bad_mode, _ = status_of(base + "/api/chat",
                    {"message":"介绍", "narrationMode":"unknown"}, {csrf_header:token}, opener)
                assert bad_mode == 400
                assert json.loads(fetch(base + "/api/chat/context", opener=opener))["narrationMode"] == "brief"
                other = make_opener()
                other_csrf = json.loads(fetch(base + "/api/auth/csrf", opener=other))
                assert json.loads(fetch(base + "/api/chat/context", opener=other))["conversationId"] is None
                assert json.loads(fetch(base + "/api/chat/context", opener=other))["narrationMode"] == "standard"
                stolen_status, _ = status_of(base + "/api/chat",
                    {"message":"偷看", "conversationId":chat["conversationId"]},
                    {other_csrf["headerName"]:other_csrf["token"]}, other)
                assert stolen_status == 403, "Conversation id from another cookie must be rejected."
                fresh = json.loads(fetch(base + "/api/chat/new", {}, {csrf_header:token}, opener))
                assert fresh["conversationId"] != chat["conversationId"] and fresh["spotId"] is None
                assert fresh["narrationMode"] == "standard"
                old_status, _ = status_of(base + "/api/chat",
                    {"message":"旧的", "conversationId":chat["conversationId"]},
                    {csrf_header:token}, opener)
                assert old_status == 403, "Old conversation id must be unusable after reset."
                bad_spot, _ = status_of(base + "/api/chat",
                    {"message":"错误景点", "spotId":999999}, {csrf_header:token}, opener)
                assert bad_spot == 400, "Invalid spotId must be rejected."
                model_url = base + "/models/haru/haru.model.json"
                model = json.loads(fetch(model_url))
                assert model.get("model"), "Live2D model definition is missing."
                assert fetch(urllib.parse.urljoin(model_url, model["model"]))
                assert fetch(base + "/js/live2d-helper.js")
                # Real ADMIN + CSRF partial update, anonymous read, reject rollback, restart.
                login = json.loads(fetch(base + "/api/auth/login",
                                         {"username":"display-smoke-admin", "password":password},
                                         {csrf_header:token}, opener))
                assert login.get("success") is True
                csrf = json.loads(fetch(base + "/api/auth/csrf", opener=opener))
                headers = {csrf["headerName"]:csrf["token"]}
                patch = {"name":"\u3000山川向导\u00a0", "welcomeMessage":"欢迎来到山川之间。\n一起发现风景。",
                         "primaryColor":"#245D73", "volume":0}
                expected = {**public_config, **patch, "name":"山川向导", "primaryColor":"#245d73"}
                saved = json.loads(fetch(base + "/api/admin/digital-human-config", patch,
                                         headers, opener, method="PUT"))
                assert saved == expected, "Partial update reset omitted settings or volume zero."
                assert json.loads(fetch(base + "/api/digital-human-config")) == expected
                before = (data / "config.json").read_bytes()
                status, body = status_of(base + "/api/admin/digital-human-config",
                                         {"name":"不应保存", "primaryColor":"red"},
                                         headers, opener, method="PUT")
                assert status == 400 and json.loads(body)["code"] == "INVALID_CONFIG"
                assert json.loads(fetch(base + "/api/digital-human-config")) == expected
                assert (data / "config.json").read_bytes() == before
                process.terminate(); process.wait(timeout=10)
                process = start_server()
                wait_ready(process, base, timeout)
                assert json.loads(fetch(base + "/api/digital-human-config")) == expected
                assert status_of(base + "/api/admin/digital-human-config")[0] == 401
                return {"status": "passed", "spot_count": len(spots),
                        "checks": ["homepage", "spots", "csrf_token", "public_config",
                                   "narration_modes", "narration_session_restore", "narration_invalid_rollback", "narration_reset",
                                   "admin_anonymous_401", "csrf_missing_rejected",
                                   "offline_chat", "live2d_definition",
                                   "live2d_model_file", "live2d_helper", "admin_display_partial_save",
                                   "anonymous_saved_display", "invalid_display_rollback",
                                   "display_survives_restart", "admin_config_still_protected"]}
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
