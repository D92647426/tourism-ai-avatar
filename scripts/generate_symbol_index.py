from __future__ import annotations

import ast
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCAN_DIRS = [ROOT / "backend", ROOT / "scripts", ROOT / "ai_service"]
OUTPUT = ROOT / ".symbol_index.json"


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def add_symbol(index: dict, path: Path, name: str, node: ast.AST, kind: str) -> None:
    start = getattr(node, "lineno", 1)
    end = getattr(node, "end_lineno", start)
    rel = relative(path)
    key = f"{rel}::{name}"
    index[key] = {
        "path": rel,
        "kind": kind,
        "start_line": start,
        "end_line": end,
        "relative_link": f"../{rel}#L{start}-L{end}",
    }


def walk_file(path: Path, index: dict) -> None:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            add_symbol(index, path, node.name, node, "class")
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            add_symbol(index, path, node.name, node, "function")


def main() -> int:
    index: dict = {}
    for scan_dir in SCAN_DIRS:
        if not scan_dir.exists():
            continue
        for path in sorted(scan_dir.rglob("*.py")):
            if "__pycache__" in path.parts:
                continue
            walk_file(path, index)
    OUTPUT.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUTPUT} with {len(index)} symbols")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
