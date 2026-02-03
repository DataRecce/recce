#!/bin/bash
# Docs Sync Check Hook
# Triggered by Stop event - checks if CLI files were modified
# and outputs a message to trigger docs-sync-scanner agent.

# Auto-load .envrc if RECCE_DOCS_PATH not set
if [ -z "$RECCE_DOCS_PATH" ] && [ -f ".envrc" ]; then
    source .envrc 2>/dev/null
fi

# Exit silently if RECCE_DOCS_PATH still not configured
[ -z "$RECCE_DOCS_PATH" ] && exit 0

# Check if recce/ or recce_cloud/ was modified in uncommitted changes
MODIFIED_FILES=$(git diff HEAD --name-only 2>/dev/null | grep -E '^(recce|recce_cloud)/')
[ -z "$MODIFIED_FILES" ] && exit 0

# Check if CLI files were modified (cli.py files require docs update)
CLI_MODIFIED=$(echo "$MODIFIED_FILES" | grep -E 'cli\.py$')

if [ -n "$CLI_MODIFIED" ]; then
    echo "CLI files were modified - check if recce-docs needs updating:"
    echo "$CLI_MODIFIED"
else
    echo "recce code files were modified - check if recce-docs needs updating."
fi
