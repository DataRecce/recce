---
name: linear-status-sync
description: Synchronize Linear issue status with workflow stage transitions for the linear-delivery workflow
version: 0.2.0
---

# Linear Status Sync

Owns Linear MCP `save_issue` calls for the `linear-delivery` workflow. Centralizes the iron rule from `.claude/skills/linear-deep-dive/references/linear-issue-lifecycle.md` ("NEVER mark a Linear issue as Done until the PR that closes it has been merged to `main`") at one chokepoint instead of scattering it across stage agents.

## Hook lifecycle

Spacedock fires three hook points: `startup`, `idle`, `merge`. This mod hooks `startup` (one reconciliation pass at FO boot) and `idle` (a reconciliation pass whenever the FO has no dispatchable work). Stage transitions are picked up at the next `idle` tick after the transition, since `stage-enter` is not a Spacedock hook point.

The `merge` hook is owned by the sibling `pr-merge` mod; this mod does NOT register a `merge` hook to avoid contention over which mod advances the entity.

## Authority

This mod's status-transition rules come from `.claude/skills/linear-deep-dive/references/linear-issue-lifecycle.md`. Any change to the canonical transition table (`Triage → In Progress → In Review → Done`, plus the closed-without-merge bounce-back) belongs in that reference file first; this mod implements what that file declares.

## Required entity fields

Each entity processed by this mod MUST have:

- `linear-id` (e.g., `linear-id: DRC-2893`) — the Linear identifier the mod calls `save_issue` against. If empty or missing, the mod skips the entity and warns the captain once per session per missing entity.
- `linear-state` — the last-synced Linear state for this entity, one of `Triage`, `In Progress`, `In Review`, `Done`, or empty (never synced). The mod compares the entity's `status` against this field to detect when a sync is needed and updates it after each successful sync.

Both fields are declared in this workflow's entity schema (see workflow README's Schema section).

## Status → Linear state mapping

| Workflow `status` | Implied Linear state |
|---|---|
| `triage`, `analysis`, `approval` | `Triage` |
| `implementation` | `In Progress` |
| `review` | `In Review` |
| `done` | `Done` (only after `gh pr view` confirms `MERGED`) |

The `review` mapping treats the entity as `In Review` once it reaches the `review` stage, regardless of whether the entity's `pr` field is yet populated. The brief window between entering `review` and `pr-merge.merge` setting the `pr` field is short and infrequent enough that an early "In Review" Linear state is acceptable; the next `idle` tick after `pr-merge.merge` runs reconciles by no-op (the implied state is unchanged).

## Reconciliation logic

For each entity in the workflow directory (active entities AND `_archive/` — the `done` sync only fires after `pr-merge` has already archived the entity, so the archived files must be in scope):

1. Skip the entity if `linear-id` is empty or missing. Warn once per session per missing entity (track by entity `id` so the warning does not repeat across ticks).
2. Determine the implied Linear state from the entity's `status` per the mapping above.
3. If the implied state matches the entity's `linear-state` field, skip — already synced.
4. Otherwise:
   - **Iron rule guardrail (when implied is `Done`).** Strip any `#` or `owner/repo#` prefix from the entity's `pr` field, then run `gh pr view {pr-number} --json state --jq '.state'`. If the result is anything other than `MERGED`, do NOT call `save_issue`. Report a one-line warning naming the entity and the PR state, and leave `linear-state` unchanged. The iron rule applies: never mark Done until merged is verified. If `gh` is unavailable, skip Done syncs only — other transitions still proceed.
   - Call `mcp__claude_ai_Linear_2__save_issue` with `id: {linear-id}` and `state: {implied state}`.
   - On success, update the entity's `linear-state` frontmatter via `status --workflow-dir docs/workflows/linear-delivery --set {slug} linear-state={new state}` and commit the change with message `linear-sync: {slug} {old state} -> {new state}`.
5. If `mcp__claude_ai_Linear_2__save_issue` is unavailable (Linear MCP server not connected), warn the captain once per session and skip Linear sync for the rest of the session.

## Hook: startup

Run the reconciliation logic above. This catches state drift across sessions — for example, a Linear status manually changed in the UI between sessions, or an entity that advanced to `done` while the FO was offline.

## Hook: idle

Run the reconciliation logic above. The FO fires `idle` whenever no entity is dispatchable; this is the documented Spacedock hook point closest to "the workflow just transitioned an entity," which is when Linear state typically needs an update.

## Ordering relative to `pr-merge`

Mods run in lexical filename order: `linear-status-sync` (l) runs before `pr-merge` (p). On any given idle tick:

- `linear-status-sync.idle` runs first, scanning entities at their pre-tick `status`.
- `pr-merge.idle` runs next, potentially advancing review-stage entities to `done` and archiving them when their PR reaches `MERGED` state.

The `done` sync therefore lags by one idle tick — when `pr-merge.idle` archives an entity, the archived file's `status` is `done`, but `linear-state` is still `In Review`. The next `idle` tick scans `_archive/`, finds the archived entity needs a sync, runs the iron-rule `gh pr view` check (which still returns `MERGED` for a merged PR), syncs Linear to `Done`, and updates `linear-state` in the archive copy.

This one-tick lag is intentional: the iron rule is "never mark Done until merge is verified by the same authority that triggered archival" (`gh pr view --json state`), so re-running the check on the archived entity is a feature, not a bug — it defends against a manual override or race that would archive without true merge.

## Why use `idle`/`startup` rather than `merge`

The `merge` hook fires once per entity (at terminal-stage entry). Linear status needs three syncs per entity (`In Progress`, `In Review`, `Done`). Using `idle` lets the mod reconcile incrementally as the entity moves through stages, without requiring a custom hook point that Spacedock does not fire. The `startup` companion ensures correct state across session restarts.

## Why a separate mod

Centralizing Linear status mutations in this mod (rather than inlining `save_issue` into stage agents) does three things:

1. **Single chokepoint for the iron rule.** The "never Done until merged" guardrail lives in exactly one file, not scattered across stage agents that may forget to enforce it.
2. **Stage agents stay MCP-agnostic.** The `analysis` and `implementation` ensigns can run without the Linear MCP server connected — the workflow simply skips Linear sync with a warning if the server is unavailable.
3. **Extension point for future status hooks.** If the team adds a new transition (e.g., a `blocked` state for stalled issues), a single mapping-table edit covers it.
