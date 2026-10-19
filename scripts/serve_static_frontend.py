from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "frontend_static"


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the no-dependency LingTour static frontend")
    parser.add_argument("--port", type=int, default=5173)
    args = parser.parse_args()

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(STATIC_DIR))
    with socketserver.TCPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Serving {STATIC_DIR} at http://127.0.0.1:{args.port}")
        server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
