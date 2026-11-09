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
import uuid


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


def verify_campus(base: str) -> dict:
    """REQ-054..059: verify a running empty-key campus server via real cookies/CSRF.

    Input is the local server base URL. Returns check labels/counts, raises on a
    contract regression. Process ownership stays with verify. See docs/test_reference.md.
    """
    opener = make_opener()

    def call(path, payload=None, headers=None, visitor=opener):
        return json.loads(fetch(base + path, payload, headers, visitor))

    csrf = call("/api/auth/csrf")
    headers = {csrf["headerName"]: csrf["token"]}
    state = call("/api/campus/context")
    catalog = call("/api/campus/catalog")
    assert len(catalog["campuses"]) == 5 and len(catalog["places"]) == 26
    assert state["contextRevision"] == 0 and state["timezone"] == "Asia/Shanghai"
    assert state["serverTime"] and state["placeId"] is None

    def payload(message, context=None, origin="user"):
        body = {"requestId": str(uuid.uuid4()), "conversationId": state["conversationId"],
                "contextRevision": state["contextRevision"], "message": message, "origin": origin}
        if context is not None:
            body["context"] = context
        return body

    def ask(message, context=None, origin="user"):
        nonlocal state
        turn = call("/api/campus/chat", payload(message, context, origin), headers)
        assert turn["mode"] == "local" and turn["reply"] and turn["speech"]
        state = turn["context"]
        return turn

    def new():
        nonlocal state
        old = state["conversationId"]
        state = call("/api/campus/new", {}, headers)
        assert state["conversationId"] != old and state["contextRevision"] == 0
        assert state["placeId"] is None and not state.get("position")

    def rejected(body, status, visitor=opener, request_headers=headers, path="/api/campus/chat"):
        actual, response = status_of(base + path, body, request_headers, visitor)
        assert actual == status, (path, actual, response)
        return response

    rejected(payload("补卡"), 403, request_headers={})
    first_request = payload("我的校园卡丢了，去哪补")
    first = call("/api/campus/chat", first_request, headers)
    assert "校区" in first["reply"] and len(first["choices"]) == 6
    replay = call("/api/campus/chat", first_request, headers)
    assert replay == first, "Identical request replay must return the same committed turn."
    state = first["context"]
    rejected({**first_request, "message": "另一个问题"}, 409)
    rejected({**payload("旧版本"), "contextRevision": 0}, 409)
    rejected({**payload("无效地点"), "placeId": "missing"}, 400)
    rejected({**payload("无效输入"), "message": " "}, 400)
    after_invalid = call("/api/campus/context")
    assert after_invalid["contextRevision"] == state["contextRevision"]
    assert after_invalid["placeId"] == state["placeId"]

    other = make_opener()
    other_csrf = call("/api/auth/csrf", visitor=other)
    other_headers = {other_csrf["headerName"]: other_csrf["token"]}
    other_state = call("/api/campus/context", visitor=other)
    assert other_state["conversationId"] != state["conversationId"] and other_state["campusId"] is None
    rejected(payload("跨Cookie请求"), 409, visitor=other, request_headers=other_headers)

    card = ask("我在平乐园")
    assert card["sceneAction"]["type"] == "SHOW_SERVICE_TASK"
    assert state["placeId"] == "pingleyuan-card-service"
    assert "学综楼" in card["reply"] and "1—3" in card["reply"] and card["references"]
    origin = ask("带我过去")
    assert "起点" in origin["reply"] and origin["sceneAction"]["type"] == "KEEP_SCENE"
    route = ask("我在四教")
    assert route["sceneAction"]["type"] == "SHOW_ROUTE"
    assert state["placeId"] == "pingleyuan-card-service"
    assert state["position"]["placeId"] == "pingleyuan-fourth-teaching"
    assert "坐标" in route["reply"]
    gym = ask("健身房在哪")
    assert gym["context"]["placeId"] is None and "routePending" not in state, "Unknown gym must clear the old card destination."
    assert ask("带我过去")["sceneAction"]["type"] != "SHOW_ROUTE"

    new()
    visitor = ask("平乐园，我是访客，图书馆能做什么")
    assert visitor["sceneAction"]["type"] == "SHOW_PLACE"
    study = ask("想在图书馆安静学习")
    assert study["sceneAction"]["taskId"] == "library-study"
    assert "申请" in study["reply"] and study["references"]
    assert any(ref["url"] == "https://lib.bjut.edu.cn/info/1147/1005.htm" for ref in study["references"])
    photo = ask("看看这个地点的实景")
    assert photo["sceneAction"]["placeIds"] == ["pingleyuan-library"]
    assert "外观" in photo["reply"] and not state.get("position")
    assert not ask("等我进入图书馆再静音")["context"].get("position")
    inside = ask("我已经在图书馆内")
    assert inside["context"]["position"]["placeId"] == "pingleyuan-library", "Explicit interior must confirm arrival."
    assert state["position"]["source"] == "confirmed" and "latitude" not in state["position"]
    topic = state["placeId"]
    physical = state["position"].copy()
    for text in ("如果我在图书馆", "等我进入图书馆再静音", "等我离开图书馆再开声音"):
        ask(text)
        assert state["position"] == physical, "Conditional statements must not refresh physical evidence."
    for text in ("我在图书馆的外面", "我在图书馆的门口"):
        ask("我已经在图书馆内")
        outside = ask(text)
        assert outside["context"]["position"] is None and state["placeId"] == topic
    for text in ("我在图书馆门口", "我在图书馆附近", "我想去图书馆", "如果我在图书馆"):
        assert not ask(text)["context"].get("position"), text

    new()
    dining = ask("通州午饭吃什么")
    assert dining["sceneAction"]["type"] == "SHOW_DINING" and 4 <= len(dining["choices"]) <= 6
    assert {"followup", "custom"}.issubset({choice["kind"] for choice in dining["choices"]})
    actual_choice = next(choice for choice in dining["choices"] if choice["kind"] == "ask")
    chosen = ask(actual_choice["message"], origin="choice")
    assert chosen["sceneAction"]["type"] == "SHOW_PLACE", "Actual dining choice.message must open its place."
    assert state["placeId"] == "tongzhou-student-dining"
    new()
    ask("平乐园补卡", {"simulated": True, "hour": 12, "time": "2026-11-09T12:00:00+08:00",
                         "weather": {"temperatureC": 20, "weatherCode": 0}, "position": {
                             "placeId": "pingleyuan-fourth-teaching", "source": "simulated",
                             "timestamp": int(time.time() * 1000)}})
    exited = ask("带我过去", {"simulated": False, "position": None})
    assert state["simulated"] is False and state["position"] is None
    assert not any(key in state for key in ("hour", "time", "weather"))
    assert exited["sceneAction"]["type"] == "KEEP_SCENE" and "起点" in exited["reply"]
    assert ask("带我过去")["sceneAction"]["type"] != "SHOW_ROUTE"
    canceled_request = payload("被取消的请求")
    canceled = call("/api/campus/cancel", {key: canceled_request[key] for key in ("conversationId", "requestId")}, headers)
    assert canceled["canceled"] is True
    rejected(canceled_request, 409)
    old = canceled_request.copy()
    new()
    rejected(old, 409)
    assert status_of(base + "/api/campus/weather?latitude=999&longitude=116", opener=opener)[0] == 400

    # Business assertions run before assets so older JARs fail for the known behavior.
    assert len(catalog["assets"]) == 8
    assert b"campus" in fetch(base + "/campus.html")
    for resource in ("/css/campus.css", "/js/campus.js", "/js/campus-scene.js", "/js/campus-companion.js",
                     "/js/campus-environment.js", "/js/campus-voice.js"):
        assert fetch(base + resource), resource
    for asset in catalog["assets"]:
        content = fetch(base + asset["path"])
        image = (content.startswith(b"\x89PNG\r\n\x1a\n") or content.startswith(b"\xff\xd8\xff")
                 or content.startswith((b"GIF87a", b"GIF89a"))
                 or content.startswith(b"RIFF") and content[8:12] == b"WEBP")
        assert image, (asset["id"], "Image magic does not match a common raster format.")
    return {"campus_count": 5, "place_count": 26, "asset_count": 8,
            "checks": ["campus_csrf", "campus_replay", "campus_400_409", "campus_cookie_isolation",
                       "campus_card_route", "campus_unknown_gym", "campus_library_visitor_sources",
                       "campus_interior_exterior", "campus_dining_choice", "campus_simulation_exit",
                       "campus_cancel_new", "campus_weather_invalid", "campus_http_assets"]}


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
                # REQ-047/048: packaged assets and real sequential station/candidate contracts.
                assert b"chatJourneyNext" in home
                for asset in ("journey-core.js", "journey.js", "chat-references.js", "chat-followups.js", "chat-audio.js", "theme-guide.js"):
                    assert fetch(base + "/js/" + asset), asset
                for name in ("灵山大佛", "灵山梵宫"):
                    stop = next(spot for spot in spots if spot["name"] == name)
                    relay = json.loads(fetch(base + "/api/chat",
                        {"message":"请介绍" + name, "spotId":stop["id"],
                         "conversationId":chat["conversationId"]}, {csrf_header:token}, opener))
                    assert relay["spotId"] == stop["id"] and relay["narrationMode"] == "brief"
                    candidates = relay["knowledgeReferences"]
                    assert candidates and len(candidates) <= 3
                    assert all(ref["source"] == "local-knowledge:" + str(ref["id"])
                               and isinstance(ref["title"], str) for ref in candidates)
                # REQ-050: actual card prompts produce distinct marked local replies.
                followup_stop = next(spot for spot in spots if spot["name"] == "灵山大佛")
                prompts = ["请把核心看点压缩为三句，方便我边走边听。",
                           "请用一个生活中的比喻解释最有代表性的看点，并区分比喻与史实。",
                           "请给出一个可在现场留意的细节，并说明怎样观察；资料不足时请说明。"]
                followup_replies = []
                for prompt in prompts:
                    answer = json.loads(fetch(base + "/api/chat",
                        {"message":"关于【" + followup_stop["name"] + "】，" + prompt,
                         "spotId":followup_stop["id"], "conversationId":chat["conversationId"]},
                        {csrf_header:token}, opener))
                    assert answer["fallback"] and answer["narrationMode"] == "brief"
                    assert answer["spotId"] == followup_stop["id"]
                    assert followup_stop["brief"] in answer["reply"] and "未核验" in answer["reply"]
                    assert "本地追问讲解" in answer["reply"]
                    followup_replies.append(answer["reply"])
                assert len(set(followup_replies)) == 3
                assert "不作为景点史实" in followup_replies[1]
                assert "现场观察建议" in followup_replies[2]
                # REQ-052: request-only theme context and complete offline three-stop path.
                themes = json.loads(fetch(base + "/api/themes"))
                assert len(themes) == 1 and themes[0]["id"] == "scene-details"
                theme = themes[0]
                assert len(theme["stops"]) == 3 and len({stop["spotId"] for stop in theme["stops"]}) == 3
                snapshot_before_theme = json.loads(fetch(base + "/api/chat/context", opener=opener))
                invalid_theme, _ = status_of(base + "/api/chat",
                    {"message":"主题讲解", "themeId":"missing", "themeLecture":True,
                     "spotId":theme["stops"][0]["spotId"], "narrationMode":"family",
                     "conversationId":chat["conversationId"]}, {csrf_header:token}, opener)
                assert invalid_theme == 400
                assert json.loads(fetch(base + "/api/chat/context", opener=opener)) == snapshot_before_theme
                for index, stop in enumerate(theme["stops"]):
                    spot = next(item for item in spots if item["id"] == stop["spotId"])
                    assert spot["name"] == stop["name"]
                    themed = json.loads(fetch(base + "/api/chat",
                        {"message":"请围绕主题介绍【" + stop["name"] + "】。", "themeId":theme["id"],
                         "themeLecture":True, "spotId":stop["spotId"], "narrationMode":"brief" if index else "family",
                         "conversationId":chat["conversationId"]}, {csrf_header:token}, opener))
                    assert themed["themeId"] == theme["id"] and themed["themeLecture"] is True
                    assert themed["spotId"] == stop["spotId"] and themed["fallback"] is True
                    assert spot["brief"] in themed["reply"] and stop["bridge"] in themed["reply"] and "未核验" in themed["reply"]
                    assert themed["narrationMode"] == ("brief" if index else "family")
                themed_question = json.loads(fetch(base + "/api/chat",
                    {"message":"它的门票", "themeId":theme["id"], "conversationId":chat["conversationId"]},
                    {csrf_header:token}, opener))
                assert themed_question["themeId"] == theme["id"] and themed_question["themeLecture"] is False
                assert themed_question["narrationMode"] == "brief"
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
                return {"status": "passed", "spot_count": len(spots), "campus": verify_campus(base),
                        "checks": ["homepage", "spots", "csrf_token", "public_config",
                                   "narration_modes", "narration_session_restore", "narration_invalid_rollback", "narration_reset",
                                   "journey_assets", "followup_asset", "audio_asset", "theme_three_stops", "theme_invalid_rollback", "local_followup_replies", "journey_station_handoff", "knowledge_candidate_contract",
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
