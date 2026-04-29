---
name: linear-status-sync
description: Synchronize Linear issue status with workflow stage transitions for the linear-delivery workflow
version: 0.1.0
---

# Linear Status Sync

Owns Linear MCP `save_issue` calls at workflow stage transitions for the `linear-delivery` workflow. Centralizes the iron rule from `.claude/skills/linear-deep-dive/references/linear-issue-lifecycle.md` ("NEVER mark a Linear issue as Done until the PR that closes it has been merged to `main`") at one chokepoint instead of scattering it across stage agents.

## Authority

This mod's status-transition rules come from `.claude/skills/linear-deep-dive/references/linear-issue-lifecycle.md`. Any change to the canonical transition table (`Triage → In Progress → In Review → Done`, plus the closed-without-merge bounce-back) belongs in that reference file first; this mod implements what that file declares.

## Required entity fields

Each entity processed by this mod MUST have a `linear-id` field in its YAML frontmatter (e.g., `linear-id: DRC-2893`). If `linear-id` is empty or missing, the mod skips the entity and reports a one-line warning to the captain identifying the entity by `id` and `title`. Do not error out — the workflow may legitimately host issues that are not yet linked to Linear (e.g., a draft entity awaiting captain assignment).

## Hook: stage-enter:implementation

Fires when an entity advances into the `implementation` stage. The captain has approved the proposed approach at the `approval` gate; work is about to begin in a worktree.

Action: call `mcp__claude_ai_Linear_2__save_issue` with:

- `id`: the entity's `linear-id`
- `state`: `"In Progress"`

If the call fails (network, auth, Linear API error), report a one-line warning to the captain naming the entity and the underlying error. Do NOT block the stage transition — local work proceeds regardless. The captain may retry the sync manually via the Linear UI or by re-dispatching the stage-enter hook.

If `mcp__claude_ai_Linear_2__save_issue` is not available (Linear MCP server not connected), warn the captain once per session and skip Linear sync for the rest of the session.

## Hook: stage-enter:review

Fires when an entity advances into the `review` stage. The `pr-merge` mod's `merge` hook has just created the PR; the entity's `pr` field is populated. The Linear issue should now reflect "PR opened, not yet merged" → **In Review** per the lifecycle table.

Action: call `mcp__claude_ai_Linear_2__save_issue` with:

- `id`: the entity's `linear-id`
- `state`: `"In Review"`

Failure handling matches `stage-enter:implementation`: warn but do not block.

Ordering note: this hook runs AFTER `pr-merge.merge` has populated the entity's `pr` field. The first officer is responsible for hook ordering; this mod assumes `pr-merge` runs first when both apply.

## Hook: stage-enter:done

Fires when an entity advances into the terminal `done` stage. The `pr-merge` mod's `startup` or `idle` hook has detected the PR is MERGED and is advancing the entity. Linear should now move to **Done**.

**Iron rule guardrail.** Before calling `save_issue`, this hook re-verifies the PR merge state to defend against bad transitions (e.g., a manual stage advance that bypassed `pr-merge`). Run:

```bash
gh pr view {pr-number} --json state --jq '.state'
```

where `{pr-number}` is the entity's `pr` field with any `#` or `owner/repo#` prefix stripped.

- If the result is `MERGED`, proceed with the Linear update.
- If the result is anything else (`OPEN`, `CLOSED`, error), do NOT call `save_issue`. Report a one-line error to the captain: `"{entity title}: refused to mark Linear Done — PR {pr-number} is in state {state}, not MERGED. The iron rule from references/linear-issue-lifecycle.md applies."` The first officer should bounce the entity back from `done` to `review` (manual captain intervention).

If `gh` is not available, warn the captain and SKIP the Linear sync (do not assume MERGED). This is the correct conservative behavior — the iron rule is "never mark Done until merged is verified", and an unverified state is not a verified merged state.

If the merge check passes, action: call `mcp__claude_ai_Linear_2__save_issue` with:

- `id`: the entity's `linear-id`
- `state`: `"Done"`

Failure handling matches the other hooks: warn but do not block. Local archival proceeds; the captain can sync Linear manually if the API call fails after the merge check has already passed.

## Why a separate mod

Centralizing Linear status mutations in this mod (rather than inlining `save_issue` into stage agents) does three things:

1. **Single chokepoint for the iron rule.** The "never Done until merged" guardrail lives in exactly one file, not scattered across stage agents that may forget to enforce it.
2. **Stage agents stay MCP-agnostic.** The `analysis` and `implementation` ensigns can run without the Linear MCP server connected — the workflow simply skips Linear sync with a warning if the server is unavailable.
3. **Extension point for future status hooks.** If the team adds a new transition (e.g., a `blocked` state for stalled issues), a single mod edit covers it.
