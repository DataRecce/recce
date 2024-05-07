#!/usr/bin/env bash
set -euxo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
pwd

# Step 1: prepare env
sqlmesh --version
sqlmesh --config local_config plan --no-prompts --auto-apply
sqlmesh --config local_config plan dev --no-prompts --auto-apply --include-unmodified

# Step 2: turn off anonymous tracking
mkdir ~/.recce
echo "user_id: 00000000000000000000000000000000" > ~/.recce/profile.yml
echo "anonymous_tracking: false" >> ~/.recce/profile.yml
