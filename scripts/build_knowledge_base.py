from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from run_local import ensure_postgres_service  # noqa: E402
from app.services.vector_store import build_knowledge_base  # noqa: E402


def main() -> int:
    ensure_postgres_service()
    result = build_knowledge_base()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
