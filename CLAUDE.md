# CLAUDE.md

@AGENTS.md

<!-- Above imports universal agent instructions. Claude-specific extensions below. -->

## Quick Reference

→ `docs/KNOWLEDGE_BASE.md` - Architecture, code patterns, frontend structure, testing, debugging
→ `js/CLAUDE.md` - Frontend conventions and tooling (Node.js 26 via `nave`, Biome, Vitest, pnpm v12
  quirks, Storybook imports, CSS color format, rem vs px, shell vs shared code)

## Working Preferences

- Keep responses concise and action-oriented.
- Ask clarifying questions before changes that alter product behavior.

## AI Agent Documentation

Use gitignored directories for temporary working documents:
- `docs/plans/` - Implementation plans and design docs
- `docs/tasks/` - Task lists and tracking
- `docs/summaries/` - Status reports and progress updates

## Git Workflow

- Always `git fetch` and merge/rebase from updated `main` BEFORE starting work on a feature branch or addressing PR review comments.
- When creating PR bodies with multi-line content, write to a temp file and pass `--body-file` instead of using heredocs (avoids quoting issues).
- Verify the correct base branch before opening a PR (especially for extensions/multi-branch repos).

## Commit and PR Workflow

**Commits:** Always use `--signoff` and include a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer (version pin optional — if included, use the current model)

**PRs:** Follow `.github/PULL_REQUEST_TEMPLATE.md`:
- PR checklist (tests, DCO)
- Type, description, linked issues
- Reviewer notes, user-facing changes

When a PR closes more than one issue or PR, give each its own `Closes #N` on its
own line — GitHub's parser ignores the rest of a comma-separated list.

## PR Review Response

The `recce-dev:pr-review-response` skill drives the loop (name it in full — a bare
`pr-review-response` also resolves to a personal user-level skill). Two things it is
easy to get wrong:

- Fetching review comments **requires** `--paginate` (gh) or manual pagination — PRs here frequently have >30 comments.
- Replying to a review comment uses `POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies`.

## Dependency Updates

The `recce-dev:address-dependabot` skill drives consolidation (name it in full —
the bare name collides with project- and user-level skills of the same name).
Non-obvious prerequisites and outputs:

- Requires `brew install dependabot` and a running Docker daemon.
- `make deps-check` runs Dependabot locally and writes `deps-python.yml` and
  `deps-frontend.yml`. `make deps-check-python` covers Python alone.
- Python updates go through `pyproject.toml`; frontend updates follow `js/CLAUDE.md`.

Verify a consolidated update with:
```bash
make test
cd js && pnpm install && pnpm lint && pnpm type:check && pnpm test && pnpm run build
```

## MCP Server Work

Response-format contracts, the shared local/cloud tool registry, and the
cloud-vs-local exception-type trap are in the **`recce-mcp-dev`** skill — it loads
when you touch `recce/mcp_server.py`, MCP tool handlers, error classification, MCP
tests, or when you add a `CheckDAO`/`RunDAO` write in `recce/apis/*_api.py`. Read it
before changing a tool description or response shape.

## Individual Preferences

- @~/.claude/recce.md
