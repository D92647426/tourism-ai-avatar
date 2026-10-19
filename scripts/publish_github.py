"""Publish the current repository to a GitHub remote.

对应需求：
- REQ-009 GitHub 发布与版本交付

文档：
- docs/DEPLOY.md#github-发布
- docs/program_index.md#scriptspublish_githubpy
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_git(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run a git command from the project root and return its completed process."""
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if check and result.returncode != 0:
        print(result.stdout, file=sys.stderr)
        raise SystemExit(result.returncode)
    return result


def ensure_clean_worktree() -> None:
    """Stop publishing when uncommitted files exist."""
    status = run_git(["status", "--porcelain=v1"]).stdout.strip()
    if status:
        print("工作区存在未提交改动，请先提交或暂存：", file=sys.stderr)
        print(status, file=sys.stderr)
        raise SystemExit(2)


def configure_remote(remote_url: str, remote_name: str) -> None:
    """Create or update the target Git remote."""
    existing = run_git(["remote"], check=False).stdout.splitlines()
    if remote_name in existing:
        run_git(["remote", "set-url", remote_name, remote_url])
    else:
        run_git(["remote", "add", remote_name, remote_url])


def main() -> int:
    """CLI entrypoint for publishing the repository to GitHub."""
    parser = argparse.ArgumentParser(
        description="把当前灵山数字导游项目推送到指定 GitHub 仓库。"
    )
    parser.add_argument("--remote-url", required=True, help="GitHub 仓库 URL，例如 https://github.com/user/repo.git")
    parser.add_argument("--remote-name", default="origin", help="Git remote 名称，默认 origin")
    parser.add_argument("--branch", default="main", help="推送到 GitHub 的分支名，默认 main")
    parser.add_argument("--source-branch", default=None, help="本地源分支，默认当前分支")
    parser.add_argument("--push-tags", action="store_true", help="同时推送本地 tag，例如 v0.0")
    parser.add_argument("--allow-dirty", action="store_true", help="允许存在未提交改动时继续推送")
    args = parser.parse_args()

    if not args.allow_dirty:
        ensure_clean_worktree()

    current_branch = run_git(["branch", "--show-current"]).stdout.strip()
    source_branch = args.source_branch or current_branch
    if not source_branch:
        print("无法识别当前分支，请使用 --source-branch 指定。", file=sys.stderr)
        return 2

    configure_remote(args.remote_url, args.remote_name)
    run_git(["push", "-u", args.remote_name, f"{source_branch}:{args.branch}"])
    if args.push_tags:
        run_git(["push", args.remote_name, "--tags"])

    print(f"已推送 {source_branch} -> {args.remote_name}/{args.branch}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
