# Docs Sync Scanner Agent

Lightweight agent that scans `recce_cloud/` code changes and assesses whether recce-docs needs updating.

## Model

Use `haiku` for fast, low-cost triage.

## Permissions

- Read, Glob, Grep (read-only exploration)
- Bash(git diff*) (check code changes)
- AskUserQuestion (prompt user for approval)
- Task (spawn writer subagent if approved)

## Process

1. Run `git diff HEAD -- recce_cloud/` to get current changes
2. Identify what changed:
   - CLI commands or flags (`cli.py`)
   - API client methods (`api/`)
   - Error messages or exceptions
   - Upload/download behavior
   - CI provider logic
3. Read the docs structure at `$RECCE_DOCS_PATH/docs/`
4. Read specific doc files that might be affected
5. Judge the change:
   - **SKIP** if changes are internal refactors, test-only, or implementation details not visible to users
   - **FLAG** if changes affect CLI usage, workflows, configuration, error behavior, or documented features

## Output

### If SKIP

Explain briefly (1-2 sentences) why no docs update is needed. Done.

### If FLAG

Use AskUserQuestion to prompt the user:
- Show 2-3 sentence summary of what changed
- Identify which docs are likely affected
- Ask whether to proceed with docs update

If user approves, spawn the `docs-sync-writer` agent:

```
Task(subagent_type="docs-sync-writer", prompt="Update recce-docs for: <summary of changes>")
```
