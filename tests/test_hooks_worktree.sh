#!/bin/bash
# Test: Verify biome check --staged works correctly from js/ subdirectory
# This validates the pre-commit hook's lint:staged behavior in both
# normal repos and with GIT_WORK_TREE explicitly set.
#
# Usage: bash tests/test_hooks_worktree.sh
# Must be run from the repo root.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
TEST_FILE="js/packages/ui/src/__test_hook_verify.ts"
PASS=0
FAIL=0

cleanup() {
	git reset HEAD -- "$TEST_FILE" 2>/dev/null || true
	rm -f "$REPO_ROOT/$TEST_FILE"
}
trap cleanup EXIT

echo "=== Hook Worktree Compatibility Tests ==="
echo ""

# ---------- Test 1: biome --staged finds files from js/ (normal) ----------
echo "Test 1: biome check --staged finds staged files from js/ (no GIT_WORK_TREE)"
echo 'export const testHookVerify = true;' > "$REPO_ROOT/$TEST_FILE"
git add "$TEST_FILE"

OUTPUT=$(cd "$REPO_ROOT/js" && pnpm exec biome check --staged --diagnostic-level=warn 2>&1) || true
if echo "$OUTPUT" | grep -q "Checked 1 file"; then
	echo "  PASS: biome found the staged file"
	PASS=$((PASS + 1))
else
	echo "  FAIL: biome did not find the staged file"
	echo "  Output: $OUTPUT"
	FAIL=$((FAIL + 1))
fi

# ---------- Test 2: biome --staged works with GIT_WORK_TREE set ----------
echo "Test 2: biome check --staged finds staged files from js/ (with GIT_WORK_TREE)"
OUTPUT=$(cd "$REPO_ROOT/js" && GIT_WORK_TREE="$REPO_ROOT" pnpm exec biome check --staged --diagnostic-level=warn 2>&1) || true
if echo "$OUTPUT" | grep -q "Checked 1 file"; then
	echo "  PASS: biome found the staged file with GIT_WORK_TREE"
	PASS=$((PASS + 1))
else
	echo "  FAIL: biome did not find the staged file with GIT_WORK_TREE"
	echo "  Output: $OUTPUT"
	FAIL=$((FAIL + 1))
fi

# ---------- Test 3: git diff --cached returns correct paths ----------
echo "Test 3: git diff --cached returns repo-root-relative paths"
CACHED=$(git diff --cached --name-only --diff-filter=ACM)
if echo "$CACHED" | grep -q "^js/"; then
	echo "  PASS: paths are repo-root-relative (js/...)"
	PASS=$((PASS + 1))
else
	echo "  FAIL: unexpected path format"
	echo "  Output: $CACHED"
	FAIL=$((FAIL + 1))
fi

# ---------- Test 4: REPO_ROOT resolves correctly ----------
echo "Test 4: git rev-parse --show-toplevel matches expected repo root"
TOPLEVEL=$(git rev-parse --show-toplevel)
if [ -d "$TOPLEVEL/js/.husky" ]; then
	echo "  PASS: show-toplevel points to correct repo root"
	PASS=$((PASS + 1))
else
	echo "  FAIL: show-toplevel does not contain js/.husky"
	echo "  Toplevel: $TOPLEVEL"
	FAIL=$((FAIL + 1))
fi

# ---------- Summary ----------
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
	exit 1
fi
