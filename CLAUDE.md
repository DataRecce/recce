# CLAUDE.md

@AGENTS.md

<!-- Above imports universal agent instructions. Claude-specific extensions below. -->

## Quick Reference

For detailed documentation beyond AGENTS.md essentials:

→ `docs/KNOWLEDGE_BASE.md` - Architecture, code patterns, frontend structure, testing, debugging
→ `js/CLAUDE.md` - Frontend-specific instructions (pnpm, Biome, @datarecce/ui, style conventions)

## Package Manager & Tooling

- **Frontend (from `js/`):** this monorepo uses **pnpm** — never npm or npx. Run `cd js && pnpm install`, `cd js && pnpm test`, `cd js && pnpm lint`. There is no root `package.json`; pnpm commands from the repo root will fail.
- **Python (from repo root):** linting and formatting are **Black + isort + flake8**, driven by the Makefile — `make format`, `make check`, `make flake8`. Pre-commit hooks (`.pre-commit-config.yaml`) enforce the same. There is no Ruff configuration in this repo.
- **Integration tests** require dbt artifacts at `integration_tests/dbt/target/manifest.json` and `integration_tests/dbt/target-base/manifest.json`. `make test` (unit tests) runs without external services.

For frontend-specific tooling details (Node version via `nave`, Biome, Vitest, pnpm v11 quirks), see `js/CLAUDE.md`.

## Claude-Specific Notes

- Keep responses concise and action-oriented
- Ask clarifying questions before changes that alter product behavior
- Prefer updating shared UI code in `js/packages/ui`; keep `js/app` thin
- Run `cd js && pnpm run build` before `recce server` when validating frontend changes

## AI Agent Documentation

Use gitignored directories for temporary working documents:
- `docs/plans/` - Implementation plans and design docs
- `docs/tasks/` - Task lists and tracking
- `docs/summaries/` - Status reports and progress updates

## Git Workflow

- Always `git fetch` and merge/rebase from updated `main` BEFORE starting work on a feature branch or addressing PR review comments.
- When creating PR bodies with multi-line content, write to a temp file and pass `--body-file` instead of using heredocs (avoids quoting issues).
- Verify the correct base branch before opening a PR (especially for extensions/multi-branch repos).

## Dependency Update Workflow

When asked to "update deps" or "check for updates":

**Prerequisites:** `brew install dependabot` + Docker running

0. **Scan:** `make deps-check` (runs Dependabot locally, outputs `deps-python.yml` and `deps-frontend.yml`)
1. **Audit:** Frontend — see `js/CLAUDE.md` for `pnpm audit && pnpm outdated` workflow and overrides list. Python — `make deps-check-python`.
2. **Present:** Group by SECURITY/MAJOR/MINOR with numbered list
3. **Apply:** Frontend updates per `js/CLAUDE.md`; Python updates via `pyproject.toml`.
4. **Verify:** Run all quality checks (`make test` for Python; `pnpm install && pnpm lint && pnpm type:check && pnpm test && pnpm build` for frontend).

## Commit and PR Workflow

**Commits:** Always use `--signoff` and include a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer (version pin optional — if included, use the current model)

**PRs:** Follow `.github/PULL_REQUEST_TEMPLATE.md`:
- PR checklist (tests, DCO)
- Type, description, linked issues
- Reviewer notes, user-facing changes

## PR Review Response Workflow

- When fetching PR review comments via GitHub API, always use `--paginate` (gh) or paginate manually — PRs frequently have >30 comments.
- Use the correct GitHub API endpoint for replying to review comments: `POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies`.
- For each review comment: validate the concern first, fix only real issues, run tests, commit, push, then reply individually.

## MCP Tool Response Contracts

- MCP tool description = LLM agent contract. Description MUST match actual response format.
- Prefer additive changes (`_meta` fields) over modifying existing field types in tool responses.
- Row count consumers: frontend (int), `run.py` (int comparison), `summary.py` (int arithmetic), `RowCountDiffResultDiffer` (3-format compat), MCP agents (description-guided).
- `summary.py` row count gotcha: `base`/`curr` can be `None` (TABLE_NOT_FOUND, PERMISSION_DENIED). Guard with `is None` check before arithmetic — `dict.get(key, 0)` does NOT protect when key exists with `None` value. N/A display includes reason: `"N/A (table_not_found)"`.
- Format changes to MCP tool responses require both deterministic tests AND BQ/LLM eval to prove agent behavior unchanged.

## Cloud vs Local Mode Exception Types

`CheckDAO` / `RunDAO` operations have cloud-mode and local-mode branches that
raise DIFFERENT exception classes. `RecceCloudException` (defined in
`recce/util/recce_cloud.py`) inherits from `Exception`, NOT from
`RecceException`. When wrapping a DAO operation in `try / except RecceException`,
cloud-mode failures escape the wrapper and break the consistent error contract.

**Rule**: For DAO operations that may run in cloud mode, either:
- Use `except (RecceException, RecceCloudException)` to catch both, OR
- Move the DAO call OUTSIDE the typed-exception wrapper (mirrors
  `_tool_create_check`'s structure, which keeps `update_check_by_id`
  unguarded so cloud failures propagate as expected).

**Where this matters**: any new code in `mcp_server.py` or `*_api.py` that
adds a DAO write inside an existing `try / except RecceException` block.
Origin: PR #1342 review (DRC-3307).

## Frontend Style Conventions

See `js/CLAUDE.md` for frontend conventions (Storybook imports, CSS color format, rem vs px, shell vs shared code).

## Individual Preferences

- @~/.claude/recce.md
