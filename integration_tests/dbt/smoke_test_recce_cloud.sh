#!/usr/bin/env bash
set -euo pipefail

# Smoke test for the standalone `recce-cloud` CLI against a live Recce Cloud
# environment. This exercises the RECCE_API_TOKEN-based workflow end to end,
# including the session-base (isolated base) upload path.
#
# Required env vars:
#   RECCE_API_TOKEN  - API token for the test project
#   RECCE_ORG        - Organization slug or ID for the test project
#   RECCE_PROJECT    - Project slug or ID for the test project
#
# Optional env vars:
#   RECCE_CLOUD_API_HOST - Override the cloud host (e.g. staging)
#   PY, DBT              - Matrix identifiers (used in the unique session name)
#   GITHUB_RUN_ID        - GHA run id (used in the unique session name)
#   GITHUB_RUN_ATTEMPT   - GHA run attempt (used in the unique session name)

: "${RECCE_API_TOKEN:?RECCE_API_TOKEN is required}"
: "${RECCE_ORG:?RECCE_ORG is required}"
: "${RECCE_PROJECT:?RECCE_PROJECT is required}"

# Distinguish prod vs staging in the session name so runs don't collide
ENV_NAME="prod"
if [[ -n "${RECCE_CLOUD_API_HOST:-}" ]]; then
    ENV_NAME="staging"
fi

SESSION_NAME="smoke-rc-${ENV_NAME}-py${PY:-unknown}-dbt${DBT:-unknown}-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
SESSION_ID=""

NEW_WORKSPACE=$(dirname "${GITHUB_WORKSPACE:-$PWD}")
cd "$NEW_WORKSPACE"
pwd

# Disable anonymous telemetry for the smoke run
mkdir -p ~/.recce
echo "user_id: 00000000000000000000000000000000" > ~/.recce/profile.yml
echo "anonymous_tracking: false" >> ~/.recce/profile.yml

cleanup() {
    local exit_code=$?
    if [[ -n "$SESSION_ID" ]]; then
        echo "Teardown: deleting session $SESSION_ID"
        recce-cloud delete --session-id "$SESSION_ID" --force || true
    fi
    exit $exit_code
}
trap cleanup EXIT

# --------------------------------------------------------------------
# 0. Sanity: CLI is installed and runnable
# --------------------------------------------------------------------
recce-cloud version

# --------------------------------------------------------------------
# 1. Prepare jaffle_shop fixture
# --------------------------------------------------------------------
GIT_REPO="https://github.com/DataRecce/jaffle_shop_duckdb.git"
GIT_BRANCH="chore/smoke-test-cloud"
rm -rf jaffle_shop_duckdb
git clone --depth 1 --branch $GIT_BRANCH $GIT_REPO
cd jaffle_shop_duckdb

dbt --version
dbt deps

# --------------------------------------------------------------------
# 2. Build BASE artifacts -> target-base/
# --------------------------------------------------------------------
git restore models/customers.sql || true
dbt seed --target-path target-base
dbt run  --target-path target-base
dbt docs generate --target-path target-base
test -s target-base/manifest.json
test -s target-base/catalog.json

# --------------------------------------------------------------------
# 3. Build PR artifacts -> target/
# --------------------------------------------------------------------
echo "where customer_id > 0" >> models/customers.sql
dbt run
dbt docs generate
git restore models/customers.sql
test -s target/manifest.json
test -s target/catalog.json

# --------------------------------------------------------------------
# 4. Bind project to the test org/project
# --------------------------------------------------------------------
recce-cloud init --org "$RECCE_ORG" --project "$RECCE_PROJECT"
recce-cloud init --status

# --------------------------------------------------------------------
# 5. Doctor baseline (informational)
#
# `recce-cloud doctor` exits non-zero if ANY of its four checks fails,
# and Production Metadata / Dev Session can legitimately be unpopulated
# in a fresh test project. We only enforce login + project_binding here.
# --------------------------------------------------------------------
recce-cloud doctor --json > doctor.pre.json || true
echo "--- recce-cloud doctor output ---"
cat doctor.pre.json
echo "---------------------------------"
jq -e '.login.status == "pass"' doctor.pre.json > /dev/null
jq -e '.project_binding.status == "pass"' doctor.pre.json > /dev/null

# --------------------------------------------------------------------
# 6. Upload PR artifacts by session name
# --------------------------------------------------------------------
recce-cloud upload --session-name "$SESSION_NAME" --yes --target-path target
SESSION_ID=$(recce-cloud list --json | jq -r --arg n "$SESSION_NAME" '.[] | select(.name == $n) | .id' | head -n 1)
if [[ -z "$SESSION_ID" ]]; then
    echo "ERROR: could not resolve session id for $SESSION_NAME"
    exit 1
fi
echo "Created session: $SESSION_ID ($SESSION_NAME)"

# --------------------------------------------------------------------
# 7. Auto-snapshot post-condition: the new session was cloned from the
# shared base at upload time (DRC-3309 default-on auto-snapshot).
# --------------------------------------------------------------------
recce-cloud list --json | jq -e --arg i "$SESSION_ID" \
    '.[] | select(.id == $i) | .has_isolated_base == true' > /dev/null
echo "Auto-snapshot post-condition passed (has_isolated_base == true)"

# --------------------------------------------------------------------
# 7a. Auto-snapshot session-lifecycle staleness + refresh (DRC-3311 / DRC-3548)
#
# Cover the drift→refresh contract the frontend StalenessBanner depends on:
#   GET /sessions/{id} must surface the four staleness fields, and
#   POST /sessions/{id}/refresh-base must accept the refresh and either
#   return a task_id (202, fresh refresh) or in_progress=true (202, in-flight).
#
# Both endpoints are auth'd by the same RECCE_API_TOKEN used by the CLI.
# Called via curl until a dedicated `recce-cloud refresh-base` subcommand
# exists (tracked separately under DRC-3548).
# --------------------------------------------------------------------
API_HOST="${RECCE_CLOUD_API_HOST:-https://cloud.reccehq.com}"
AUTH_HEADER="Authorization: Bearer $RECCE_API_TOKEN"

# 7a-i. GET /sessions/{id} returns the four staleness fields (all four
# present in the response, but each may be null for a brand-new session
# that has not seen a shared-base change yet).
SESSION_DETAIL=$(curl -sf -H "$AUTH_HEADER" "$API_HOST/api/v2/sessions/$SESSION_ID")
echo "$SESSION_DETAIL" | jq -e '.session | has("source_session_id")' > /dev/null
echo "$SESSION_DETAIL" | jq -e '.session | has("source_session_updated_at")' > /dev/null
echo "$SESSION_DETAIL" | jq -e '.session | has("current_base_session_id")' > /dev/null
echo "$SESSION_DETAIL" | jq -e '.session | has("current_base_updated_at")' > /dev/null
echo "GET /sessions/{id} returns all four staleness fields"

# 7a-ii. POST /sessions/{id}/refresh-base must return 202 with either a
# task_id or in_progress=true. We just verify the contract; the actual
# drift→banner→clear UI loop is covered by the DRC-3293 acid-test E2E.
REFRESH_BODY=$(mktemp)
REFRESH_STATUS=$(curl -s -o "$REFRESH_BODY" -w "%{http_code}" \
    -X POST -H "$AUTH_HEADER" \
    "$API_HOST/api/v2/sessions/$SESSION_ID/refresh-base")
if [[ "$REFRESH_STATUS" != "202" ]]; then
    echo "ERROR: refresh-base expected 202, got $REFRESH_STATUS"
    cat "$REFRESH_BODY"
    rm -f "$REFRESH_BODY"
    exit 1
fi
jq -e '(.task_id != null) or (.in_progress == true)' "$REFRESH_BODY" > /dev/null
rm -f "$REFRESH_BODY"
echo "POST /sessions/{id}/refresh-base returned 202 with valid body"

# --------------------------------------------------------------------
# 8. Upload SESSION BASE artifacts explicitly (idempotent overwrite of
# the auto-snapshot from step 7).
# --------------------------------------------------------------------
recce-cloud upload --session-base --session-id "$SESSION_ID" --target-path target-base
recce-cloud list --json | jq -e --arg i "$SESSION_ID" \
    '.[] | select(.id == $i) | .has_isolated_base == true' > /dev/null
echo "Isolated base uploaded successfully"

# --------------------------------------------------------------------
# 9. Negative check: --session-base + --type prod must be rejected
# --------------------------------------------------------------------
set +e
recce-cloud upload --session-base --type prod --target-path target > /dev/null 2>&1
NEG_EXIT=$?
set -e
if [[ "$NEG_EXIT" -eq 0 ]]; then
    echo "ERROR: --session-base + --type prod should have failed, but exited 0"
    exit 1
fi
echo "Negative check passed (exit $NEG_EXIT)"

# --------------------------------------------------------------------
# 10. Download the PR session artifacts
# --------------------------------------------------------------------
rm -rf target-downloaded
recce-cloud download --session-id "$SESSION_ID" --target-path target-downloaded --force
test -s target-downloaded/manifest.json
test -s target-downloaded/catalog.json

# --------------------------------------------------------------------
# 11. Download a known production session (read-only sanity)
# --------------------------------------------------------------------
PROD_SESSION_ID=$(recce-cloud list --type prod --json | jq -r '.[0].id // empty')
if [[ -z "$PROD_SESSION_ID" ]]; then
    echo "ERROR: no production session found in test project; seed one first"
    exit 1
fi
rm -rf target-prod
recce-cloud download --session-id "$PROD_SESSION_ID" --target-path target-prod --force
test -s target-prod/manifest.json

# --------------------------------------------------------------------
# 12. Dry-run paths (no side effects)
# --------------------------------------------------------------------
recce-cloud upload --dry-run --target-path target
recce-cloud download --session-id "$SESSION_ID" --dry-run
recce-cloud delete   --session-id "$SESSION_ID" --dry-run

# --------------------------------------------------------------------
# 13. Delete session + verify
# --------------------------------------------------------------------
recce-cloud delete --session-id "$SESSION_ID" --force
recce-cloud list --json | jq -e --arg i "$SESSION_ID" 'all(.[]; .id != $i)' > /dev/null

# Session is gone; skip the EXIT-trap double-delete
SESSION_ID=""

echo "recce-cloud smoke test completed successfully"
