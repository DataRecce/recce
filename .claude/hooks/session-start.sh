#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$PROJECT_DIR"

echo "Installing Python dev dependencies..."
uv pip install --system -e ".[dev,mcp]"

echo "Installing pre-commit hooks..."
pre-commit install

echo "Installing frontend dependencies..."
cd "$PROJECT_DIR/js"
pnpm install

echo "Session start hook completed successfully."
