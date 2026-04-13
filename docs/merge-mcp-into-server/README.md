---
commissioned-by: spacedock@0.9.4
entity-type: refactoring_subtask
entity-label: subtask
entity-label-plural: subtasks
id-style: sequential
linear-issue: DRC-3228
linear-url: https://linear.app/recce/issue/DRC-3228/merge-mcp-server-into-recce-server-command
base-branch: feature/drc-3228-merge-mcp-server-into-recce-server-command
stages:
  defaults:
    worktree: false
    concurrency: 2
  states:
    - name: scoped
      initial: true
    - name: designed
    - name: implemented
      worktree: true
    - name: verified
      worktree: true
      fresh: true
      gate: true
      feedback-to: implemented
    - name: merged
      worktree: true
      terminal: true
---

# Merge `mcp-server` into `recce server` Command

This workflow tracks the refactor that merges Recce's separate `mcp-server` CLI command into the primary `server` command. After this work lands, a single `recce server` invocation hosts both the HTTP API (for the web UI) and the MCP endpoint (for agents), simplifying developer and agent onboarding.

Each work item is a **refactoring subtask** — a discrete, reviewable chunk of the overall migration (e.g., unifying startup, adding CLI flags, deprecating the old command, updating docs, or adding E2E tests). Subtasks move independently through the stages below.

**Linear issue:** [DRC-3228](https://linear.app/recce/issue/DRC-3228/merge-mcp-server-into-recce-server-command) — all work happens on the `feature/drc-3228-merge-mcp-server-into-recce-server-command` branch. Worktree stages branch from this feature branch, **not** from `main`.

## File Naming

Each subtask is a markdown file named `{slug}.md` — lowercase, hyphens, no spaces. Example: `merge-mcp-server-lifecycle.md`.

## Schema

Every subtask file has YAML frontmatter with these fields:

```yaml
---
id:
title: Human-readable name
status: scoped
source:
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier, zero-padded 3-digit sequential (e.g., `001`) |
| `title` | string | Human-readable subtask name |
| `status` | enum | One of: scoped, designed, implemented, verified, merged |
| `source` | string | Where this subtask came from (e.g., "commission seed", "discovered during implementation") |
| `started` | ISO 8601 | When active work began (first transition out of `scoped`) |
| `completed` | ISO 8601 | When the subtask reached `merged` |
| `verdict` | enum | PASSED or REJECTED — set at the `verified` gate |
| `score` | number | Priority score, 0.0–1.0 |
| `worktree` | string | Worktree path while a dispatched agent is active, empty otherwise |
| `issue` | string | GitHub issue reference (optional cross-reference). Linear parent is `DRC-3228`. |
| `pr` | string | GitHub PR reference (e.g., `#57`). Set by the pr-merge mod when a PR is created. |

## Stages

### `scoped`

Subtask is defined with clear intent, scope, and acceptance criteria. The Captain can triage and prioritize at this stage before any design or implementation work begins.

- **Inputs:** Parent issue DRC-3228, existing `recce server` and `recce mcp-server` implementations, Recce codebase conventions (AGENTS.md).
- **Outputs:** A subtask body that states: (1) the specific change, (2) the user-visible or developer-visible outcome, (3) acceptance criteria, (4) any known constraints (compatibility, deprecation timeline).
- **Good:** Scope fits one reviewable PR. Acceptance criteria are testable. Dependencies on other subtasks are explicit.
- **Bad:** Vague goals ("improve MCP"). Multi-PR scope. Missing acceptance criteria. Ignoring dbt version compatibility.

### `designed`

Concrete technical approach is documented: which files change, which APIs or CLI surfaces are affected, what the transport/lifecycle shape looks like, how the change interacts with existing server boot sequence.

- **Inputs:** The scoped subtask, `recce/cli.py` (or equivalent CLI entry), `recce/server.py`, MCP server module, any shared config/state loaders.
- **Outputs:** A design note appended to the subtask body covering: file list, function/class touchpoints, CLI argument changes, lifecycle diagram (startup/shutdown ordering), rollback plan if the change misbehaves.
- **Good:** Names concrete symbols (function/class/file paths). Considers both HTTP and MCP lifecycles. Calls out test coverage strategy.
- **Bad:** Hand-waving ("refactor the server module"). Missing lifecycle ordering. Ignoring `--no-mcp` opt-out path. No test plan.

### `implemented`

Code changes complete in an isolated worktree. The worktree branches from `feature/drc-3228-merge-mcp-server-into-recce-server-command` (not `main`). Local build succeeds; basic sanity checks (import, `recce --help`, `recce server --help`) pass.

- **Inputs:** The designed subtask, the Recce codebase at the feature branch tip.
- **Outputs:** Commits on a worktree branch implementing the change. `make format && make flake8` clean. `cd js && pnpm run build` succeeds if frontend touched. Sanity: `recce server --help` renders new flags if applicable.
- **Good:** Atomic commits with `-s` signoff. Preserves adapter interface. Keeps OSS shell thin. Frontend changes go to `@datarecce/ui` where shared.
- **Bad:** Skipping `--signoff`. Breaking `BaseAdapter` interface. Editing `recce/data/` directly. Unrelated drive-by changes. Committing `recce_state.json`.

### `verified` *(approval gate)*

Full test suite passes, integration is confirmed end-to-end, and the Captain reviews the diff. A fresh agent session performs verification independently of the implementation session to catch blind spots. **Captain decides go/no-go at this gate** — rejection sends the subtask back to `implemented` for rework.

- **Inputs:** The implemented worktree branch, the subtask's acceptance criteria.
- **Outputs:** Verification report appended to subtask body: `make test` result, `cd js && pnpm test` result, `pnpm type:check` result, integration check (e.g., `recce server` boots with both HTTP + MCP, agent can connect), any regressions found. Captain's explicit approve/reject.
- **Good:** Runs the full suite, not just the touched module. Exercises the integration end-to-end. Reports evidence (command output), not assertions. Catches cases the implementer missed.
- **Bad:** "Tests pass" without showing output. Skipping frontend checks when frontend touched. Approving without running the merged server. Ignoring new warnings.

### `merged` *(terminal)*

PR is created from the worktree branch, reviewed on GitHub, and merged into `main` (via the feature branch). The pr-merge mod handles branch push and PR creation automatically.

- **Inputs:** The verified worktree branch.
- **Outputs:** GitHub PR created, linked to Linear issue DRC-3228, following `.github/PULL_REQUEST_TEMPLATE.md`. PR number recorded in the subtask's `pr` field. Once merged, `completed` timestamp and `verdict: PASSED` set.
- **Good:** PR title uses conventional commit format (`feat(cli): …`, `fix(mcp): …`). PR body explains user-facing change. Links to DRC-3228. Signoff (DCO) preserved.
- **Bad:** Merging without review. Skipping DCO signoff. Breaking the feature branch by force-pushing over other subtasks' work. Missing Linear reference.

## Workflow State

View the workflow overview:

```bash
/Users/kent/.claude/plugins/cache/spacedock/spacedock/0.9.4/skills/commission/bin/status --workflow-dir docs/merge-mcp-into-server
```

Output columns: ID, SLUG, STATUS, TITLE, SCORE, SOURCE.

Include archived subtasks with `--archived`:

```bash
/Users/kent/.claude/plugins/cache/spacedock/spacedock/0.9.4/skills/commission/bin/status --workflow-dir docs/merge-mcp-into-server --archived
```

Find dispatchable subtasks ready for their next stage:

```bash
/Users/kent/.claude/plugins/cache/spacedock/spacedock/0.9.4/skills/commission/bin/status --workflow-dir docs/merge-mcp-into-server --next
```

Find subtasks in a specific stage:

```bash
grep -l "status: implemented" docs/merge-mcp-into-server/*.md
```

## Subtask Template

```yaml
---
id:
title: Subtask name here
status: scoped
source:
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Description of this subtask and what it aims to achieve.
```

## Commit Discipline

- Commit status changes at dispatch and merge boundaries
- Commit subtask body updates when substantive (design notes, verification reports)
- All commits use `git commit -s` (DCO required per AGENTS.md)
- Worktree branches must branch from `feature/drc-3228-merge-mcp-server-into-recce-server-command`, not `main`
