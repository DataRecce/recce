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
#   5. Session Name Upload  (--session-name, dev session)
#   6. Session ID Upload    (--session-id, reuses session from test 5)
#
# Required env vars:
#   GITHUB_TOKEN           - PAT with repo scope for the test repo
#
# Optional env vars:
#   SMOKE_TEST_API_TOKEN   - RECCE_API_TOKEN for generic endpoint tests (tests 3-6)
#   SMOKE_TEST_ORG         - Recce Cloud org ID for session-name/ID tests (tests 5-6)
#   SMOKE_TEST_PROJECT     - Recce Cloud project ID for session-name/ID tests (tests 5-6)
#
# Provided by GitHub Actions (already set):
#   GITHUB_ACTIONS, GITHUB_SHA, GITHUB_REF_NAME
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="${SCRIPT_DIR}/fixtures/minimal-target"
SMOKE_TEST_GITHUB_REPO="DataRecce/recce-smoke-test"
TEST_BRANCH="smoke-test-upload-$(date +%s)"
DEV_SESSION_NAME="smoke-test-dev-$(date +%s)"
DEV_SESSION_ID=""
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

  # Delete dev session created by session-name test (if any).
  if [[ -n "$DEV_SESSION_ID" ]]; then
    env RECCE_API_TOKEN="$SMOKE_TEST_API_TOKEN" \
      recce-cloud delete --session-id "$DEV_SESSION_ID" --force 2>/dev/null || true
  fi

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
echo "Org/Project:  ${SMOKE_TEST_ORG:-not set}/${SMOKE_TEST_PROJECT:-not set}"

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

# ==== Test 5: Session Name Upload (dev session) ====
# ==== Test 6: Session ID Upload (reuses session from test 5) ====
if [[ -n "${SMOKE_TEST_API_TOKEN:-}" && -n "${SMOKE_TEST_ORG:-}" && -n "${SMOKE_TEST_PROJECT:-}" ]]; then
  # Test 5: Upload with --session-name (creates a dev session)
  run_test "Test 5: Session Name Upload" \
    env RECCE_API_TOKEN="$SMOKE_TEST_API_TOKEN" \
    RECCE_ORG="$SMOKE_TEST_ORG" \
    RECCE_PROJECT="$SMOKE_TEST_PROJECT" \
    recce-cloud upload --target-path "$FIXTURES_DIR" \
      --session-name "$DEV_SESSION_NAME" --yes

  # Look up the session ID for the dev session we just created.
  DEV_SESSION_ID=$(
    env RECCE_API_TOKEN="$SMOKE_TEST_API_TOKEN" \
    RECCE_ORG="$SMOKE_TEST_ORG" \
    RECCE_PROJECT="$SMOKE_TEST_PROJECT" \
    recce-cloud list --type dev --json 2>/dev/null \
    | python3 -c "
import sys, json
sessions = json.load(sys.stdin)
for s in sessions:
    if s.get('name') == '$DEV_SESSION_NAME':
        print(s['id'])
        break
" 2>/dev/null || true
  )

  if [[ -n "$DEV_SESSION_ID" ]]; then
    echo "Dev session ID: $DEV_SESSION_ID"

    # Test 6: Upload with --session-id (reuses the session from test 5)
    run_test "Test 6: Session ID Upload" \
      env RECCE_API_TOKEN="$SMOKE_TEST_API_TOKEN" \
      recce-cloud upload --target-path "$FIXTURES_DIR" \
        --session-id "$DEV_SESSION_ID"
  else
    echo "FAIL: Could not retrieve dev session ID for test 6"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
else
  echo ""
  echo "SKIP: Tests 5-6 (session-name/ID) — SMOKE_TEST_API_TOKEN, SMOKE_TEST_ORG, or SMOKE_TEST_PROJECT not set"
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
