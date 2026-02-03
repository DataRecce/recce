#!/bin/bash
# Docs Sync Check Hook
# Triggered by NotificationShown - checks if recce_cloud/ was modified
# and instructs Claude to spawn the docs-sync-scanner subagent.

# Exit silently if RECCE_DOCS_PATH not configured
[ -z "$RECCE_DOCS_PATH" ] && exit 0

# Check if recce_cloud/ was modified in uncommitted changes
git diff HEAD --name-only 2>/dev/null | grep -q '^recce_cloud/' || exit 0

# Both conditions met — instruct Claude to spawn the scanner subagent
echo "recce_cloud/ files were modified. Spawn the docs-sync-scanner subagent to check if recce-docs needs updating."
echo ""
echo "Use: Task(subagent_type=\"docs-sync-scanner\", prompt=\"Scan recce_cloud/ changes and assess if docs need updating.\")"
