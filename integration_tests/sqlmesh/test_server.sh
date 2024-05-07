#!/usr/bin/env bash
set -euxo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
pwd

echo "Starting the server..."
recce server --sqlmesh  --sqlmesh-envs prod:dev --sqlmesh-config local_config &

echo "Waiting for the server to respond..."
timeout 20 bash -c 'until curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/info | grep -q 200; do
  echo "Server not ready yet..."
  sleep 2
done'

if [ $? -eq 0 ]; then
  echo "Server is up and running."
  EXITCODE=0
else
  echo "Failed to start the server within the time limit."
  EXITCODE=1
fi

echo "Stopping the server..."
kill $(jobs -p) || true
echo "Server stopped."

exit $EXITCODE