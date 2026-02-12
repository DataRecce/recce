#!/bin/bash
set -euo pipefail

# PreToolUse hook: auto-format & lint before git commit
# Runs the same checks as .pre-commit-config.yaml so commits pass on first try,
# saving Claude from wasting tokens on retry loops.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only act on git commit commands
if ! echo "$COMMAND" | grep -qE '\bgit\s+commit\b'; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$PROJECT_DIR"

# Get staged files (only format what's being committed)
STAGED_PY=$(git diff --cached --name-only --diff-filter=ACM -- '*.py' || true)
STAGED_ALL=$(git diff --cached --name-only --diff-filter=ACM || true)

if [ -z "$STAGED_ALL" ]; then
  exit 0
fi

echo "Pre-commit hook: auto-formatting staged files..." >&2

ERRORS=""

# --- Trailing whitespace & end-of-file fixer (mirrors pre-commit-hooks) ---
for f in $STAGED_ALL; do
  if [ -f "$f" ]; then
    # Fix trailing whitespace
    sed -i 's/[[:space:]]*$//' "$f" 2>/dev/null || true
    # Fix end-of-file (ensure single newline at end)
    if [ -s "$f" ] && [ "$(tail -c1 "$f" | xxd -p)" != "0a" ]; then
      echo "" >> "$f"
    fi
  fi
done

# --- Python: black + isort + flake8 (only on staged .py files) ---
if [ -n "$STAGED_PY" ]; then
  if command -v black >/dev/null 2>&1; then
    echo "Running black on staged Python files..." >&2
    echo "$STAGED_PY" | xargs black --quiet 2>&1 >&2 || ERRORS="${ERRORS}\nblack failed"
  fi

  if command -v isort >/dev/null 2>&1; then
    echo "Running isort on staged Python files..." >&2
    echo "$STAGED_PY" | xargs isort --quiet 2>&1 >&2 || ERRORS="${ERRORS}\nisort failed"
  fi

  if command -v flake8 >/dev/null 2>&1; then
    echo "Running flake8 on staged Python files..." >&2
    FLAKE_OUTPUT=$(echo "$STAGED_PY" | xargs flake8 2>&1) || {
      ERRORS="${ERRORS}\nflake8 errors:\n${FLAKE_OUTPUT}"
    }
  fi
fi

# --- Frontend: lint only staged JS/TS files ---
STAGED_JS=$(echo "$STAGED_ALL" | grep -E '\.(js|jsx|ts|tsx)$' || true)
if [ -n "$STAGED_JS" ] && [ -d "$PROJECT_DIR/js" ]; then
  echo "Running biome lint:fix on staged JS/TS files..." >&2
  (cd "$PROJECT_DIR/js" && pnpm lint:fix) 2>&1 >&2 || ERRORS="${ERRORS}\nbiome lint failed"
fi

if [ -n "$ERRORS" ]; then
  echo "" >&2
  echo "Commit blocked — fix these errors first:" >&2
  echo -e "$ERRORS" >&2
  exit 2
fi

# Re-stage files that were auto-formatted
for f in $STAGED_ALL; do
  if [ -f "$f" ] && ! git diff --quiet -- "$f" 2>/dev/null; then
    git add "$f"
  fi
done

echo "All checks passed." >&2
exit 0
