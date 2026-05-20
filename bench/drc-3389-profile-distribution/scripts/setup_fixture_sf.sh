#!/usr/bin/env bash
# Build base + current materializations of wide_synth on Snowflake.
#
# Pre-req: ~/code/Recce/jaffle_shop_duckdb/env.sh holds SNOWFLAKE_* creds.
# Schemas used: JAFFLE_SHOP_GOLDEN.DRC3389_BENCH_{BASE,CURR}. Warehouse: LOAD_WH.
#
# Usage:
#   ./scripts/setup_fixture_sf.sh                  # default 100K rows
#   WIDE_ROWS=200000 ./scripts/setup_fixture_sf.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DBT_DIR="$(cd "$SCRIPT_DIR/../dbt_sf" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

WIDE_ROWS="${WIDE_ROWS:-100000}"
WIDE_SEED="${WIDE_SEED:-1}"
WIDE_DRIFT="${WIDE_DRIFT:-0.05}"
N_CONTINUOUS="${N_CONTINUOUS:-15}"
N_LOWCARD="${N_LOWCARD:-6}"
N_HIGHCARD="${N_HIGHCARD:-3}"
N_BOOL="${N_BOOL:-2}"
N_TS="${N_TS:-2}"
N_UUID="${N_UUID:-2}"

VARS_BASE="{wide_rows: $WIDE_ROWS, wide_seed: $WIDE_SEED, wide_drift: 0.0, n_continuous: $N_CONTINUOUS, n_lowcard: $N_LOWCARD, n_highcard: $N_HIGHCARD, n_bool: $N_BOOL, n_ts: $N_TS, n_uuid: $N_UUID}"
VARS_CURR="{wide_rows: $WIDE_ROWS, wide_seed: $WIDE_SEED, wide_drift: $WIDE_DRIFT, n_continuous: $N_CONTINUOUS, n_lowcard: $N_LOWCARD, n_highcard: $N_HIGHCARD, n_bool: $N_BOOL, n_ts: $N_TS, n_uuid: $N_UUID}"

source "$REPO_ROOT/.venv/bin/activate"
source ~/code/Recce/jaffle_shop_duckdb/env.sh

cd "$DBT_DIR"
export DBT_PROFILES_DIR="$DBT_DIR"

# Clean artifacts so partial-parse stays predictable.
rm -rf target target-base logs

echo ">>> dbt run (base target, drift=0) -- rows=$WIDE_ROWS cols=~$((N_CONTINUOUS + N_LOWCARD + N_HIGHCARD + N_BOOL + N_TS + N_UUID + 1))"
time dbt run \
    --target base \
    --target-path target-base \
    --vars "$VARS_BASE"

echo ">>> dbt run (current target, drift=$WIDE_DRIFT) -- rows=$WIDE_ROWS"
time dbt run \
    --target current \
    --vars "$VARS_CURR"

echo ""
echo "=== Snowflake fixture ready ==="
echo "  base:    JAFFLE_SHOP_GOLDEN.DRC3389_BENCH_BASE.WIDE_SYNTH"
echo "  current: JAFFLE_SHOP_GOLDEN.DRC3389_BENCH_CURR.WIDE_SYNTH"
echo "  rows: $WIDE_ROWS  drift: $WIDE_DRIFT"
