#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
pwd

# Prepare env
git restore models/customers.sql
dbt --version
dbt deps
dbt seed --target base --target-path target-base
dbt run --target base --target-path target-base
dbt docs generate --target base --target-path target-base

echo "where customer_id <= 50" >> models/customers.sql
dbt run
dbt docs generate
git restore models/customers.sql

# Recce Run
mkdir -p ~/.recce
echo "user_id: 00000000000000000000000000000000" > ~/.recce/profile.yml
echo "anonymous_tracking: false" >> ~/.recce/profile.yml

assert_string_value() {
    if [ "$1" != "$2" ]; then
        echo "Expected $2, but got $1"
        exit 1
    fi
}

recce run
if ! [ -e recce_state.json ]; then
    echo "recce_state.json not found"
    exit 1
fi

row_count_run=$(jq -c '[.runs[] | select(.type == "row_count_diff")] | first' recce_state.json)
model=$(jq -r '.result | keys | first' <<< "$row_count_run")
run_type=$(jq -r '.type' <<< "$row_count_run")
run_status=$(jq -r '.status' <<< "$row_count_run")
run_error=$(jq -r 'if .error == null then "null" else .error end' <<< "$row_count_run")
base_count=$(jq -r '.result.customers.base' <<< "$row_count_run")
current_count=$(jq -r '.result.customers.curr' <<< "$row_count_run")
assert_string_value "$model" "customers"
assert_string_value "$run_type" "row_count_diff"
assert_string_value "$run_status" "Finished"
assert_string_value "$run_error" "null"
assert_string_value "$base_count" "100"
assert_string_value "$current_count" "50"

# Recce Summary
recce summary ./recce_state.json | tee recce_summary.md
cat ./recce_summary.md | grep -q customers

# Recce Server
function check_server_status() {
    echo "Waiting for the server to respond..."
    if timeout 20 bash -c 'until curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/info | grep -q 200; do
    echo "Server not ready yet..."
    sleep 2
    done'; then
        echo "Server is up and running."
    else
        echo "Failed to start the server within the time limit."
        exit 1
    fi

    echo "Stopping the server..."
    kill $(jobs -p) || true
    echo "Server stopped."
}

echo "Starting the server..."
recce server &
check_server_status

echo "Starting the server (review mode)..."
recce server --review recce_state.json &
check_server_status
