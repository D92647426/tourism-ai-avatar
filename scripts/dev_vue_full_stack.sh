#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python scripts/dev_vue_full_stack.py
