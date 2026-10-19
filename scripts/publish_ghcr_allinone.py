"""Build and publish the all-in-one image to GitHub Container Registry.

对应需求：
- REQ-019 Docker All-in-One 单容器交付
- REQ-020 GHCR 单容器镜像发布

文档：
- docs/DEPLOY.md#docker-all-in-one
- docs/program_index.md#运行与验证脚本
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
DEFAULT_IMAGE = "ghcr.io/2667741708/ling-shan-digital-guide-allinone"
DEFAULT_DOCKERFILE = ROOT / "deploy" / "Dockerfile.allinone.release"


def resolve_command(command: str) -> str:
    candidates = [command]
    if os.name == "nt":
        candidates.extend([f"{command}.cmd", f"{command}.exe", f"{command}.ps1"])
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise FileNotFoundError(command)


def run(
    cmd: list[str],
    *,
    cwd: Path = ROOT,
    check: bool = True,
    capture_output: bool = False,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    resolved = [resolve_command(cmd[0]), *cmd[1:]]
    print(f"$ {' '.join(cmd)}  (cwd={cwd})")
    result = subprocess.run(
        resolved,
        cwd=cwd,
        check=False,
        text=True,
        capture_output=capture_output,
        input=input_text,
    )
    if check and result.returncode != 0:
        if capture_output:
            if result.stdout:
                print(result.stdout, file=sys.stderr)
            if result.stderr:
                print(result.stderr, file=sys.stderr)
        raise SystemExit(result.returncode)
    return result


def git_sha() -> str:
    result = run(["git", "rev-parse", "--short", "HEAD"], capture_output=True)
    return result.stdout.strip()


def build_frontend() -> None:
    run(["npm", "run", "build"], cwd=FRONTEND)


def ghcr_token(token_env: str) -> str:
    token = os.getenv(token_env)
    if token:
        return token.strip()

    gh = shutil.which("gh")
    if not gh:
        raise SystemExit(
            f"未找到 {token_env}，且本机没有 gh CLI；无法登录 GHCR。"
        )

    result = run(["gh", "auth", "token"], capture_output=True)
    token = result.stdout.strip()
    if not token:
        raise SystemExit(
            f"gh auth token 未返回内容；请设置 {token_env}，并确保 token 具备 write:packages 权限。"
        )
    return token


def docker_login(username: str, token: str) -> None:
    result = run(
        ["docker", "login", "ghcr.io", "-u", username, "--password-stdin"],
        capture_output=True,
        input_text=token,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise SystemExit(
            "GHCR 登录失败。请提供具备 write:packages 权限的 token，"
            f"例如设置 GHCR_TOKEN。原始错误：{detail}"
        )


def build_image(image: str, tags: list[str], dockerfile: Path) -> None:
    tag_args: list[str] = []
    for tag in tags:
        tag_args.extend(["-t", f"{image}:{tag}"])
    run(
        [
            "docker",
            "build",
            "-f",
            str(dockerfile),
            *tag_args,
            ".",
        ]
    )


def push_image(image: str, tags: list[str]) -> None:
    for tag in tags:
        run(["docker", "push", f"{image}:{tag}"])


def main() -> int:
    parser = argparse.ArgumentParser(description="构建并推送 LingTour all-in-one 镜像到 GHCR。")
    parser.add_argument("--image", default=DEFAULT_IMAGE, help="GHCR 镜像名，例如 ghcr.io/<owner>/<image>")
    parser.add_argument("--tag", default="latest", help="主标签，默认 latest")
    parser.add_argument("--extra-tag", default=None, help="附加标签；默认使用当前 git short sha")
    parser.add_argument("--username", default="2667741708", help="GHCR 用户名")
    parser.add_argument("--token-env", default="GHCR_TOKEN", help="优先读取的 GHCR token 环境变量名")
    parser.add_argument(
        "--dockerfile",
        default=str(DEFAULT_DOCKERFILE),
        help="用于发布镜像的 Dockerfile，默认 deploy/Dockerfile.allinone.release",
    )
    parser.add_argument("--skip-frontend-build", action="store_true", help="跳过本地前端构建")
    parser.add_argument("--no-push", action="store_true", help="只构建不推送")
    args = parser.parse_args()

    tags = [args.tag]
    extra_tag = args.extra_tag or git_sha()
    if extra_tag not in tags:
        tags.append(extra_tag)

    if not args.skip_frontend_build:
        build_frontend()

    build_image(args.image, tags, Path(args.dockerfile))

    if not args.no_push:
        token = ghcr_token(args.token_env)
        docker_login(args.username, token)
        push_image(args.image, tags)

    print(f"已完成镜像处理：{', '.join(f'{args.image}:{tag}' for tag in tags)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
