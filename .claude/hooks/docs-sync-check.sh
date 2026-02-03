#!/bin/bash
# Docs Sync Check Hook
# Triggered by NotificationShown - checks if recce_cloud/ was modified
# and prompts Claude to run the docs-sync-scanner skill.

# Exit silently if RECCE_DOCS_PATH not configured
[ -z "$RECCE_DOCS_PATH" ] && exit 0

# Check if recce_cloud/ was modified in uncommitted changes
git diff HEAD --name-only 2>/dev/null | grep -q '^recce_cloud/' || exit 0

# Both conditions met — output a message for Claude to pick up
echo "recce_cloud/ files were modified. Run the docs-sync-scanner skill to check if recce-docs needs updating."
