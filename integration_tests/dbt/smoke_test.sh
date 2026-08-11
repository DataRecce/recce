#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
pwd

# Which server surface to smoke test: "server" (default) or "mcp-server".
SMOKE_SERVER="${SMOKE_SERVER:-server}"
# Only used when SMOKE_SERVER=mcp-server. The mcp SDK majors register tool
# handlers differently, so the version under test has to be explicit.
SMOKE_MCP_VERSION="${SMOKE_MCP_VERSION:-2.0.0}"

case "$SMOKE_SERVER" in
    server) ;;
    mcp-server)
        # `mcp` is an optional extra, so CI's install does not carry it.
        echo "Installing mcp==$SMOKE_MCP_VERSION"
        if command -v uv > /dev/null; then
            uv pip install "mcp==$SMOKE_MCP_VERSION"
        else
            python -m pip install "mcp==$SMOKE_MCP_VERSION"
        fi
        ;;
    *)
        echo "Unknown SMOKE_SERVER '$SMOKE_SERVER' (expected 'server' or 'mcp-server')."
        exit 1
        ;;
esac

# Prepare env
git restore models/customers.sql
dbt --version
dbt deps
dbt seed --target base --target-path target-base
dbt run --target base --target-path target-base
dbt docs generate --target base --target-path target-base

echo "where customer_id <= 50" >> models/customers.sql
dbt seed
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
# The whole key set, not the first key: `customers` is the only table-materialized
# model this PR's edit changes, so the preset check's
# `state:modified,config.materialized:table` selector over-selecting (or losing
# its materialization filter) has to fail here. `keys | first` could not see it.
model=$(jq -r '.result | keys | join(",")' <<< "$row_count_run")
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

# `grep -q customers` over the whole file is satisfied by the mermaid Lineage
# Graph block, which names `customers` from the manifests alone — the entire
# check-summary rendering could disappear and still pass. Assert each section on
# its own instead. This is the only exercise of generate_check_summary /
# generate_check_content anywhere.
grep -q '^## Manifest Information$' ./recce_summary.md
# Captured first, not piped into `grep -q`: -q exits on the first match and the
# resulting SIGPIPE would fail the whole pipeline under `pipefail`.
lineage_section=$(awk '/^## Lineage Graph$/,/^## Checks Summary$/' ./recce_summary.md)
grep -q 'model.jaffle_shop.customers' <<< "$lineage_section"

checks_summary_row=$(grep -A 2 '^|Checks Run|Data Mismatch Detected|$' ./recce_summary.md | tail -1)
checks_run=$(awk -F'|' '{gsub(/ /,"",$2); print $2}' <<< "$checks_summary_row")
mismatch_count=$(awk -F'|' '{gsub(/ /,"",$3); print $3}' <<< "$checks_summary_row")
# recce.yml defines two preset checks; only the row count one mismatches.
assert_string_value "$checks_run" "2"
assert_string_value "$mismatch_count" "1"

mismatch_row=$(awk '/^### Checks of Data Mismatch Detected$/,0' ./recce_summary.md | grep '^|Row count diff')
mismatch_nodes=$(awk -F'|' '{gsub(/^ +| +$/,"",$4); print $4}' <<< "$mismatch_row")
assert_string_value "$mismatch_nodes" "customers"

# Recce Server
# Takes the review_mode the started server is expected to report. Liveness alone
# is not enough: the previous instance's socket keeps answering 200 for seconds
# after `kill`, so a review-mode server that fails to boot would still "pass".
function check_server_status() {
    local expected_review_mode="$1"
    echo "Waiting for the server to respond..."
    if timeout 20 bash -c "until curl -sf http://localhost:8000/api/info | jq -e --argjson want '$expected_review_mode' '.review_mode == \$want' > /dev/null; do
    echo \"Server not ready yet...\"
    sleep 2
    done"; then
        echo "Server is up and running (review_mode=$expected_review_mode)."
    else
        echo "Failed to start the server (review_mode=$expected_review_mode) within the time limit."
        exit 1
    fi

    echo "Stopping the server..."
    kill $(jobs -p) 2>/dev/null || true
    # Wait for the port to be released before the next instance claims it.
    wait || true
    echo "Server stopped."
}

# Recce MCP Server
# Stdio, not HTTP: there is no port to poll, so speak the protocol instead. The
# startup path is what breaks (tool registration differs between mcp 1.x and
# 2.0), so the handshake plus a non-empty tool list is the whole check.
function check_mcp_server_status() {
    echo "Starting the MCP server..."
    local stderr_log output server_name tool_count
    stderr_log=$(mktemp)

    if ! output=$( {
        echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'
        echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
        echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
    } | timeout 60 recce mcp-server 2>"$stderr_log" ); then
        echo "The MCP server failed to start:"
        cat "$stderr_log"
        exit 1
    fi

    server_name=$(jq -r 'select(.id == 1) | .result.serverInfo.name' <<< "$output")
    tool_count=$(jq -r 'select(.id == 2) | .result.tools | length' <<< "$output")
    assert_string_value "$server_name" "recce"
    if [ "${tool_count:-0}" -lt 1 ]; then
        echo "The MCP server started but advertised no tools."
        cat "$stderr_log"
        exit 1
    fi
    echo "MCP server is up and advertised $tool_count tools."
}

if [ "$SMOKE_SERVER" = "mcp-server" ]; then
    check_mcp_server_status
else
    echo "Starting the server..."
    recce server &
    check_server_status false

    echo "Starting the server (review mode)..."
    recce server --review recce_state.json &
    check_server_status true
fi
