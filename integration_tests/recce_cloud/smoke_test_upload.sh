#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Smoke test for `recce-cloud upload`
#
# Tests all upload flows against the staging server:
#   1. GitHub PR Upload     (GITHUB_TOKEN, platform-specific)
#   2. GitHub Prod Upload   (GITHUB_TOKEN, --type prod)
#   3. RECCE_API_TOKEN PR Upload   (generic endpoint)
#   4. RECCE_API_TOKEN Prod Upload (generic endpoint, --type prod)
#
# Required env vars:
#   GITHUB_TOKEN           - PAT with repo scope for the test repo
#
# Optional env vars:
#   SMOKE_TEST_API_TOKEN   - RECCE_API_TOKEN for generic endpoint tests (tests 3-4)
#
# Provided by GitHub Actions (already set):
#   GITHUB_ACTIONS, GITHUB_SHA, GITHUB_REF_NAME
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="${SCRIPT_DIR}/fixtures/minimal-target"
SMOKE_TEST_GITHUB_REPO="DataRecce/recce-smoke-test"
TEST_BRANCH="smoke-test-upload-$(date +%s)"
PASS_COUNT=0
FAIL_COUNT=0

# ---- Prerequisite checks ----
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "ERROR: This test must run inside GitHub Actions"
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN is required"
  exit 1
fi

# ---- Recce Cloud config ----
export RECCE_CLOUD_API_HOST="${RECCE_CLOUD_API_HOST:-https://cloud.datarecce.io}"

# Disable anonymous tracking
mkdir -p ~/.recce
cat > ~/.recce/profile.yml <<EOF
user_id: 00000000000000000000000000000000
anonymous_tracking: false
EOF

# ---- Create synthetic GitHub event file ----
SYNTHETIC_EVENT=$(mktemp)
cat > "$SYNTHETIC_EVENT" <<EOF
{
  "pull_request": {
    "number": 99999
  }
}
EOF

# ---- Cleanup trap ----
cleanup() {
  echo ""
  echo "=== Cleanup ==="
  # Delete PR sessions created during tests.
  # Uses GITHUB_TOKEN (platform auto-detect delete) — works for both
  # GitHub-flow and RECCE_API_TOKEN-flow created sessions.
  env -u RECCE_API_TOKEN \
  GITHUB_REPOSITORY="$SMOKE_TEST_GITHUB_REPO" \
  GITHUB_EVENT_PATH="$SYNTHETIC_EVENT" \
  GITHUB_HEAD_REF="$TEST_BRANCH" \
  GITHUB_BASE_REF="main" \
    recce-cloud delete --force 2>/dev/null || true
  rm -f "$SYNTHETIC_EVENT"
  echo "Cleanup complete"
}
trap cleanup EXIT

# ---- Test helper ----
run_test() {
  local test_name="$1"
  shift
  echo ""
  echo "=== $test_name ==="
  if "$@"; then
    echo "PASS: $test_name"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL: $test_name (exit code: $?)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "============================================"
echo "Upload Smoke Test"
echo "============================================"
echo "Test repo:    $SMOKE_TEST_GITHUB_REPO"
echo "Test branch:  $TEST_BRANCH"
echo "Fixtures:     $FIXTURES_DIR"
echo "API host:     $RECCE_CLOUD_API_HOST"
echo "API token:    ${SMOKE_TEST_API_TOKEN:+set}${SMOKE_TEST_API_TOKEN:-not set}"

# ==== Test 1: GitHub PR Upload ====
# Uses GITHUB_TOKEN (Priority 2 path). RECCE_API_TOKEN must NOT be set.
run_test "Test 1: GitHub PR Upload" \
  env -u RECCE_API_TOKEN \
  GITHUB_REPOSITORY="$SMOKE_TEST_GITHUB_REPO" \
  GITHUB_EVENT_PATH="$SYNTHETIC_EVENT" \
  GITHUB_HEAD_REF="$TEST_BRANCH" \
  GITHUB_BASE_REF="main" \
  recce-cloud upload --target-path "$FIXTURES_DIR"

# ==== Test 2: GitHub Prod Upload ====
# Uses GITHUB_TOKEN + --type prod. RECCE_API_TOKEN must NOT be set.
run_test "Test 2: GitHub Prod Upload" \
  env -u RECCE_API_TOKEN \
  GITHUB_REPOSITORY="$SMOKE_TEST_GITHUB_REPO" \
  GITHUB_EVENT_PATH="$SYNTHETIC_EVENT" \
  GITHUB_HEAD_REF="$TEST_BRANCH" \
  GITHUB_BASE_REF="main" \
  recce-cloud upload --target-path "$FIXTURES_DIR" --type prod

# ==== Test 3: RECCE_API_TOKEN PR Upload ====
if [[ -n "${SMOKE_TEST_API_TOKEN:-}" ]]; then
  # Uses RECCE_API_TOKEN (Priority 1 path). CI env vars still needed for platform detection.
  run_test "Test 3: RECCE_API_TOKEN PR Upload" \
    env RECCE_API_TOKEN="$SMOKE_TEST_API_TOKEN" \
    GITHUB_REPOSITORY="$SMOKE_TEST_GITHUB_REPO" \
    GITHUB_EVENT_PATH="$SYNTHETIC_EVENT" \
    GITHUB_HEAD_REF="$TEST_BRANCH" \
    GITHUB_BASE_REF="main" \
    recce-cloud upload --target-path "$FIXTURES_DIR"

  # ==== Test 4: RECCE_API_TOKEN Prod Upload ====
  run_test "Test 4: RECCE_API_TOKEN Prod Upload" \
    env RECCE_API_TOKEN="$SMOKE_TEST_API_TOKEN" \
    GITHUB_REPOSITORY="$SMOKE_TEST_GITHUB_REPO" \
    GITHUB_EVENT_PATH="$SYNTHETIC_EVENT" \
    GITHUB_HEAD_REF="$TEST_BRANCH" \
    GITHUB_BASE_REF="main" \
    recce-cloud upload --target-path "$FIXTURES_DIR" --type prod
else
  echo ""
  echo "SKIP: Tests 3-4 (RECCE_API_TOKEN) — SMOKE_TEST_API_TOKEN not set"
fi

# ==== TODO: GitLab CI Upload ====
# Cannot test from GitHub Actions — server verifies CI_JOB_TOKEN
# by calling GitLab /job API. Needs a real GitLab CI pipeline.

# ==== Summary ====
echo ""
echo "============================================"
echo "Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "============================================"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
