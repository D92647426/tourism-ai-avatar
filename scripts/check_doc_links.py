"""Check repo-relative documentation targets and line numbers."""
from __future__ import annotations

import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r"\]\((\.\./[^)#]+)(?:#L(\d+)(?:-L(\d+))?)?\)")


def main() -> int:
    """REQ-027: exit 0 when linked files and line ranges exist, else 1."""
    argparse.ArgumentParser(description=__doc__).parse_args()
    failures = []
    for document in sorted((ROOT / "docs").rglob("*.md")):
        for match in LINK.finditer(document.read_text(encoding="utf-8")):
            target = (document.parent / match.group(1)).resolve()
            if not target.is_relative_to(ROOT) or not target.is_file():
                failures.append(f"{document.name}: invalid target {match.group(0)}")
                continue
            if match.group(2):
                count = len(target.read_text(encoding="utf-8").splitlines())
                start, end = int(match.group(2)), int(match.group(3) or match.group(2))
                if not 1 <= start <= end <= count:
                    failures.append(f"{document.name}: invalid line range {match.group(0)}")
    if failures:
        print("\n".join(failures))
        return 1
    print("doc links ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
