#!/usr/bin/env bash
set -euo pipefail

NEW_WORKSPACE=$(dirname "$GITHUB_WORKSPACE")
cd "$NEW_WORKSPACE" || exit
pwd

# Clone jaffle_shop_duckdb
GIT_REPO="https://github.com/DataRecce/jaffle_shop_duckdb.git"
GIT_BRANCH="chore/smoke-test-cloud"

git clone --depth 1 --branch $GIT_BRANCH $GIT_REPO
cd jaffle_shop_duckdb || exit

# Prepare dbt artifacts
dbt --version
dbt deps
dbt seed
dbt run
dbt docs generate

mkdir -p ~/.recce
echo "user_id: 00000000000000000000000000000000" > ~/.recce/profile.yml
echo "anonymous_tracking: false" >> ~/.recce/profile.yml

# Hide PR information from GitHub Action
HOLD_GITHUB_EVENT_PATH="$GITHUB_EVENT_PATH"
unset GITHUB_EVENT_PATH

# Recce artifacts
recce cloud upload-artifacts --branch $GIT_BRANCH
rm -rf target

recce cloud download-base-artifacts --branch $GIT_BRANCH
recce cloud download-artifacts --branch $GIT_BRANCH

# Recce Run
recce run --cloud

# Recce state
recce cloud download
recce cloud purge --force
recce cloud upload recce_state.json

# Recce Summary
recce summary --cloud

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

# Recce Server
echo "Starting the server (cloud and review mode)..."
recce server --cloud --review &
check_server_status
recce cloud purge --force

export GITHUB_EVENT_PATH="$HOLD_GITHUB_EVENT_PATH"
