#!/bin/bash
# Docs Sync Check Hook
# Triggered by Stop event - checks if recce/ or recce_cloud/ was modified
# and instructs Claude to spawn the docs-sync-scanner subagent.

# Auto-load .envrc if RECCE_DOCS_PATH not set
if [ -z "$RECCE_DOCS_PATH" ] && [ -f ".envrc" ]; then
    source .envrc 2>/dev/null
fi

# Exit silently if RECCE_DOCS_PATH still not configured
[ -z "$RECCE_DOCS_PATH" ] && exit 0

# Check if recce/ or recce_cloud/ was modified in uncommitted changes
# recce/ = recce CLI, recce_cloud/ = recce-cloud CLI
MODIFIED_FILES=$(git diff HEAD --name-only 2>/dev/null | grep -E '^(recce|recce_cloud)/')
[ -z "$MODIFIED_FILES" ] && exit 0

# Check if CLI files were modified (cli.py files require docs update)
CLI_MODIFIED=$(echo "$MODIFIED_FILES" | grep -E 'cli\.py$')

if [ -n "$CLI_MODIFIED" ]; then
    echo "CLI files were modified - docs update is REQUIRED:"
    echo "$CLI_MODIFIED"
    echo ""
    echo "Spawn the docs-sync-scanner subagent to update recce-docs with the new CLI changes."
    echo "Use: Task(subagent_type=\"docs-sync-scanner\", prompt=\"CLI was modified. Update recce-docs to reflect the CLI changes.\")"
else
    echo "recce code files were modified. Spawn the docs-sync-scanner subagent to check if recce-docs needs updating."
    echo ""
    echo "Use: Task(subagent_type=\"docs-sync-scanner\", prompt=\"Scan recce/ and recce_cloud/ changes and assess if docs need updating.\")"
fi
