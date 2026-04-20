# Linear Issue Lifecycle Rules

## Issue Status Transitions

| Event | Issue Status |
|-------|-------------|
| Issue created | Triage |
| Work begins | In Progress |
| PR opened (not yet merged) | In Review |
| PR merged to main | Done |
| PR closed without merge | Back to In Progress or Triage |

## Critical Rule

**NEVER mark a Linear issue as "Done" until the PR that closes it has been merged to `main`.**

When a PR is created that references `Closes DRC-XXXX`:
- Move the issue to **In Review** (not Done)
- The issue stays in "In Review" while the PR is open
- Only transition to "Done" after confirming the PR has been merged

This applies regardless of whether the PR passes CI, has approvals, or looks ready — the merge is the gate.

## Why

Linear issues represent shipped work. Marking an issue Done before merge:
- Gives false progress signals to the team
- Creates confusion if the PR is rejected or needs changes
- Breaks the trust between issue status and actual codebase state
