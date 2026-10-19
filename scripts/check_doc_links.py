from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
LINK_RE = re.compile(r"\]\((\.\./[^)#]+)(?:#L(\d+)(?:-L(\d+))?)?\)")


def main() -> int:
    failures: list[str] = []
    for path in sorted(DOCS.rglob("*.md")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in LINK_RE.finditer(text):
            target = (path.parent / match.group(1)).resolve()
            try:
                target.relative_to(ROOT)
            except ValueError:
                failures.append(f"{path}: link escapes repo: {match.group(0)}")
                continue
            if not target.exists():
                failures.append(f"{path}: missing target: {match.group(0)}")
                continue
            if match.group(2):
                line_count = len(target.read_text(encoding="utf-8", errors="ignore").splitlines())
                start = int(match.group(2))
                end = int(match.group(3) or start)
                if start < 1 or end > line_count:
                    failures.append(f"{path}: invalid line range: {match.group(0)}")
    if failures:
        print("\n".join(failures))
        return 1
    print("doc links ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
