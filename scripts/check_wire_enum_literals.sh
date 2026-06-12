#!/usr/bin/env bash
#
# DRC-3553: guard against NEW legacy change-category wire-enum string literals
# in the frontend during the dual-vocabulary deprecation window.
#
# The legacy vocabulary ("breaking" / "non_breaking" / "partial_breaking") is
# being phased out in favor of the v2 vocabulary (model_wide / column /
# additive). This check FAILS a PR that ADDS any new occurrence of a legacy
# wire-enum string literal under js/packages/ui/src/. Existing occurrences are
# untouched (the check only inspects lines added in the PR diff).
#
# Allowlist: append the inline marker  // wire-enum-ok  to a line to opt it out
# (e.g. legacy compatibility shims that must keep emitting the old value during
# the window).
#
# Usage:
#   scripts/check_wire_enum_literals.sh [BASE_REF]
# BASE_REF defaults to origin/main. In CI, pass the PR base ref.

set -euo pipefail

BASE_REF="${1:-origin/main}"
SCAN_PATH="js/packages/ui/src"
ALLOWLIST_MARKER="wire-enum-ok"

# Legacy wire-enum literals (both single- and double-quoted forms).
PATTERN='("breaking"|'"'"'breaking'"'"'|"non_breaking"|'"'"'non_breaking'"'"'|"partial_breaking"|'"'"'partial_breaking'"'"')'

# Determine the merge base so we only look at lines this branch adds.
if ! MERGE_BASE="$(git merge-base "$BASE_REF" HEAD 2>/dev/null)"; then
    echo "WARN: could not compute merge-base against '$BASE_REF'; falling back to '$BASE_REF'." >&2
    MERGE_BASE="$BASE_REF"
fi

# Added lines (prefixed with '+', excluding the +++ file header) in the scan path.
ADDED="$(git diff "$MERGE_BASE"...HEAD -- "$SCAN_PATH" \
    | grep -E '^\+' \
    | grep -Ev '^\+\+\+' \
    || true)"

VIOLATIONS=0
while IFS= read -r line; do
    [ -z "$line" ] && continue
    # Strip the leading '+'.
    content="${line#+}"
    # Skip allowlisted lines.
    if printf '%s' "$content" | grep -q "$ALLOWLIST_MARKER"; then
        continue
    fi
    if printf '%s' "$content" | grep -Eq "$PATTERN"; then
        if [ "$VIOLATIONS" -eq 0 ]; then
            echo "ERROR: new legacy change-category wire-enum string literal(s) added under ${SCAN_PATH}/." >&2
            echo "       Use the v2 vocabulary (model_wide / column / additive) instead." >&2
            echo "       To intentionally keep a legacy literal, append the marker: // ${ALLOWLIST_MARKER}" >&2
            echo "" >&2
        fi
        echo "  + ${content}" >&2
        VIOLATIONS=$((VIOLATIONS + 1))
    fi
done <<< "$ADDED"

if [ "$VIOLATIONS" -gt 0 ]; then
    echo "" >&2
    echo "Found ${VIOLATIONS} offending added line(s)." >&2
    exit 1
fi

echo "OK: no new legacy change-category wire-enum literals added under ${SCAN_PATH}/."
