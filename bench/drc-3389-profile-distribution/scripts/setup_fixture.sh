#!/usr/bin/env bash
# Build base + current materializations of wide_synth for DRC-3389 perf bench.
#
# Usage:
#   ./scripts/setup_fixture.sh                    # default rows
#   WIDE_ROWS=1000000 ./scripts/setup_fixture.sh  # 1M rows
#   WIDE_DRIFT=0.05 ./scripts/setup_fixture.sh    # custom drift in current
#
# Idempotent — clean-rebuilds the duckdb file each run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DBT_DIR="$(cd "$SCRIPT_DIR/../dbt" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

WIDE_ROWS="${WIDE_ROWS:-100000}"
WIDE_SEED="${WIDE_SEED:-1}"
WIDE_DRIFT="${WIDE_DRIFT:-0.05}"

# Activate recce venv so dbt + adapters + recce share the same Python.
source "$REPO_ROOT/.venv/bin/activate"

cd "$DBT_DIR"

# Fresh duckdb file so schemas don't pile up across runs.
rm -f perf_bench.duckdb
rm -rf target target-base logs

export DBT_PROFILES_DIR="$DBT_DIR"

# --- Base run: no drift, writes to dev_base schema, manifests in target-base/ ---
echo ">>> dbt run (base, drift=0) -- rows=$WIDE_ROWS"
dbt run \
    --target base \
    --target-path target-base \
    --vars "{wide_rows: $WIDE_ROWS, wide_seed: $WIDE_SEED, wide_drift: 0.0}"

# --- Current run: drift > 0, writes to dev_current schema, manifests in target/ ---
echo ">>> dbt run (current, drift=$WIDE_DRIFT) -- rows=$WIDE_ROWS"
dbt run \
    --target dev \
    --vars "{wide_rows: $WIDE_ROWS, wide_seed: $WIDE_SEED, wide_drift: $WIDE_DRIFT}"

# Note: skipping `dbt docs generate` — dbt-duckdb 1.8.4 hits
# "DuckDBConnectionManager environment requested before creation!" during
# catalog build. Recce's get_columns path queries live via macros, not catalog,
# so the bench doesn't need catalog.json.

echo ""
echo "=== Fixture ready ==="
echo "  duckdb file:    $DBT_DIR/perf_bench.duckdb"
echo "  base schema:    dev_base.wide_synth"
echo "  current schema: dev_current.wide_synth"
echo "  target/:        $DBT_DIR/target"
echo "  target-base/:   $DBT_DIR/target-base"
echo "  rows: $WIDE_ROWS  seed: $WIDE_SEED  drift: $WIDE_DRIFT"
