#!/usr/bin/env bash
set -euxo pipefail

DEFAULT_PR_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/pull/${GITHUB_REF_NAME}"
PR_URL="${PR_URL:-$DEFAULT_PR_URL}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
pwd

# Step 1: prepare env
dbt --version
dbt deps
dbt build --target-path target-base
dbt docs generate --target-path target-base

# modify model
echo "where customer_id > 0" >> models/customers.sql
dbt build
dbt docs generate

# Step 2: turn off anonymous tracking
mkdir ~/.recce
echo "user_id: 00000000000000000000000000000000" > ~/.recce/profile.yml
echo "anonymous_tracking: false" >> ~/.recce/profile.yml

# Step 3: add helper function
assert_string_value() {
    if [ "$1" != "$2" ]; then
        echo "Expected $2, but got $1"
        exit 1
    fi
}

# Test
recce run

# state file generated
if ! [ -e recce_state.json ]; then
    echo "recce_state.json not found"
    exit 1
fi

# row count diff to modified table models
model=$(cat recce_state.json | jq '.runs[0].params.node_ids[0]' | tr -d '"')
run_type=$(cat recce_state.json | jq '.runs[0]'.type | tr -d '"')
assert_string_value $model "model.jaffle_shop.customers"
assert_string_value $run_type "row_count_diff"

# pull request information
pr_url=$(cat recce_state.json | jq .pull_request.url | tr -d '"')
assert_string_value "${pr_url}" "${PR_URL}"
