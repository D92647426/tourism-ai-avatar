from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
BASE_URL = f"http://127.0.0.1:{BACKEND_PORT}"


def request_json(path: str, method: str = "GET", payload: dict | None = None, token: str | None = None) -> dict:
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def request_multipart_upload(path: str, file_name: str, content: bytes, title: str, token: str) -> dict:
    boundary = f"----LingTourSmoke{int(time.time() * 1000)}"
    parts = [
        (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="title"\r\n\r\n'
            f"{title}\r\n"
        ).encode("utf-8"),
        (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="change_note"\r\n\r\n'
            "smoke upload\r\n"
        ).encode("utf-8"),
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{file_name}"\r\n'
            "Content-Type: text/markdown\r\n\r\n"
        ).encode("utf-8"),
        content,
        f"\r\n--{boundary}--\r\n".encode("utf-8"),
    ]
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=b"".join(parts),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_health(timeout_seconds: int = 30) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            data = request_json("/api/health")
            if data["data"]["status"] == "ok":
                print("health ok")
                return
        except (urllib.error.URLError, KeyError):
            time.sleep(0.5)
    raise TimeoutError("health check failed")


def main() -> int:
    wait_health()
    login = request_json(
        "/api/admin/login",
        "POST",
        {
            "username": os.getenv("ADMIN_USERNAME", "admin"),
            "password": os.getenv("ADMIN_PASSWORD", "123456"),
        },
    )
    token = login["data"]["token"]
    unique_title = f"smoke_versioned_{int(time.time())}"
    unique_fact = f"{unique_title} 展示知识：紫藤花廊在东侧亲水步道，适合下午三点拍照。"
    upload = request_multipart_upload(
        "/api/admin/knowledge/upload",
        f"{unique_title}.md",
        unique_fact.encode("utf-8"),
        unique_title,
        token,
    )
    document_id = upload["data"]["id"]
    assert upload["data"]["status"] == "draft", upload
    draft_search = request_json("/api/admin/knowledge/search-test", "POST", {"query": unique_title}, token=token)
    assert all(unique_title not in chunk["text"] for chunk in draft_search["data"]["chunks"]), draft_search
    request_json(f"/api/admin/knowledge/documents/{document_id}/publish", "POST", token=token)
    search = request_json("/api/admin/knowledge/search-test", "POST", {"query": unique_title}, token=token)
    chat = request_json(
        "/api/visitor/chat/text",
        "POST",
        {"session_uuid": "smoke", "message": unique_fact},
    )
    request_json(f"/api/admin/knowledge/documents/{document_id}", "DELETE", token=token)
    request_json("/api/admin/knowledge/reindex", "POST", token=token)
    deleted_search = request_json("/api/admin/knowledge/search-test", "POST", {"query": unique_title}, token=token)
    assert search["data"]["chunks"], search
    assert any(unique_title in chunk["text"] for chunk in search["data"]["chunks"]), search
    assert chat["data"]["answer"], chat
    assert any(unique_title in ref["document"] or str(ref["chunk_id"]).startswith("admin") for ref in chat["data"]["references"]), chat
    assert all(unique_title not in chunk["text"] for chunk in deleted_search["data"]["chunks"]), deleted_search
    print(json.dumps({
        "search_top": search["data"]["chunks"][0],
        "chat_model": chat["data"]["model_used"],
        "chat_latency_ms": chat["data"]["latency_ms"],
        "chat_answer_preview": chat["data"]["answer"][:80],
        "document_status_flow": ["draft", "active", "deleted"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
