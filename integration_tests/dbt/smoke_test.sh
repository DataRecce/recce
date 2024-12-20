#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
pwd

# Prepare env
git restore models/customers.sql
dbt --version
dbt deps
dbt seed --target-path target-base
dbt run --target-path target-base
dbt docs generate --target-path target-base

echo "where customer_id > 0" >> models/customers.sql
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

model=$(cat recce_state.json | jq '.runs[0].result | keys | .[0]' | tr -d '"')
run_type=$(cat recce_state.json | jq '.runs[0]'.type | tr -d '"')
assert_string_value $model "customers"
assert_string_value $run_type "row_count_diff"

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
