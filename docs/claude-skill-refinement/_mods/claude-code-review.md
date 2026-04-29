---
name: claude-code-review
description: Run the claude-code-review skill as a self-review on freshly-created entity PRs
version: 0.1.0
---

# Claude Code Review (mod)

After `pr-merge` creates a PR for an entity with `worktree: true`, run the `claude-code-review` skill against that PR and post a self-review comment marked with the existing `<!-- claude-code-review -->` sentinel. The mod resolves which skill variant to invoke at runtime: when the `recce-dev` Claude Code plugin is installed AND enabled, it uses the plugin's multi-pass variant; otherwise it falls back to the in-repo single-pass skill at `.claude/skills/claude-code-review/SKILL.md`.

This mod runs *inline* in the FO's own execution thread — it does not dispatch a subagent. The resolved skill's existing single-actor pipeline assumptions still hold.

## Hook: merge

Runs after `pr-merge` on the same `merge` hook. The first officer runs mods in lexical order from `_mods/`, so `claude-code-review` runs after `pr-merge` (`c` < `p`). When this mod fires, the entity's `pr` field has been set by `pr-merge` and the worktree is still present on the entity's branch.

If `pr-merge` did not create a PR (captain declined, `gh` unavailable, push failed), this mod has nothing to act on — skip silently when `pr` is empty or `gh` is unavailable.

### Step 1 — Resolve the skill variant (three-gate plugin detection)

Three layered checks. The manifest gives the resolved install path; the settings check confirms the captain has the plugin enabled; the filesystem check guards against a stale manifest.

**Step A — read the installed-plugins manifest.** `~/.claude/plugins/installed_plugins.json` is Claude Code's authoritative record of installed plugins. Plugins are keyed as `{plugin-name}@{marketplace-name}`:

```bash
PLUGIN_INSTALL_PATH=$(jq -r '."recce-dev@recce-marketplace"[0].installPath // empty' \
  ~/.claude/plugins/installed_plugins.json 2>/dev/null)
```

**Step B — verify the plugin is enabled.** Installed does not imply enabled. Project `.claude/settings.json` overrides user `~/.claude/settings.json`; if neither sets the flag, treat the plugin as disabled:

```bash
# Read project setting first; fall back to user setting; default to false if neither sets it.
PROJECT_FLAG=$(jq -r '.enabledPlugins["recce-dev@recce-marketplace"] // empty' \
  /Users/jaredmscott/repos/recce/recce/.claude/settings.json 2>/dev/null)
USER_FLAG=$(jq -r '.enabledPlugins["recce-dev@recce-marketplace"] // empty' \
  ~/.claude/settings.json 2>/dev/null)
ENABLED_FLAG="${PROJECT_FLAG:-${USER_FLAG:-false}}"
```

**Step C — resolve the skill path.** Manifest install path AND enabled flag AND the file exists, in that order. Any miss falls back to the in-repo skill:

```bash
if [[ -n "$PLUGIN_INSTALL_PATH" && "$ENABLED_FLAG" == "true" \
      && -f "$PLUGIN_INSTALL_PATH/skills/claude-code-review/SKILL.md" ]]; then
  SKILL_PATH="$PLUGIN_INSTALL_PATH/skills/claude-code-review/SKILL.md"
  SKILL_VARIANT="recce-dev plugin (multi-pass)"
else
  SKILL_PATH="/Users/jaredmscott/repos/recce/recce/.claude/skills/claude-code-review/SKILL.md"
  SKILL_VARIANT="in-repo (single-pass)"
fi
```

The `-f` filesystem check is the third gate. Manifests can be stale (plugin removed without manifest update). If the resolved file does not exist, the mod transparently falls back to the in-repo skill.

Report the resolved variant to the captain before invoking the skill, e.g., `Running claude-code-review self-review using {SKILL_VARIANT} against PR #{pr_number}`.

### Step 2 — Read and follow the resolved skill

`Read` the file at `$SKILL_PATH` and execute its pipeline against the entity's PR (the `pr_number` is parsed from the entity's `pr` field — strip any `#` or `owner/repo#` prefix). Two adaptations override the skill body when running inside this mod:

#### Adaptation 1 — replace the skill's checkout step with worktree-branch verification

The skill's checkout step (`git fetch origin "$HEAD_REF" && git checkout "$HEAD_REF"`) is redundant inside a worktree mod because the worktree is already on the entity's branch. Verify the assumption rather than mutating worktree state:

```bash
# Run from the entity's worktree directory.
WORKTREE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
HEAD_REF=$(gh api "repos/${REPO}/pulls/${pr_number}" --jq '.head.ref')
if [[ "$WORKTREE_BRANCH" != "$HEAD_REF" ]]; then
  # Unexpected — pr-merge should have left the worktree on head.ref.
  # Abort and report the divergence rather than mutating worktree state.
  echo "claude-code-review mod: worktree branch '$WORKTREE_BRANCH' does not match PR head.ref '$HEAD_REF'; aborting self-review." >&2
  exit 1
fi
# Otherwise: skip the skill's fetch+checkout step entirely. The worktree is already correct.
```

If the branches diverge, the mod aborts and reports to the captain rather than overwriting the worktree's working state. Both skill variants share this Step-5-equivalent logic, so the override applies regardless of which variant resolved.

#### Adaptation 2 — resolve the prior-comment poster identity dynamically

The skill's prior-comment lookup hard-codes `user.login == "claude[bot]"`. Inside this mod the FO may post under any gh-authenticated identity (`claude[bot]`, a user PAT, or another bot). Resolve the poster identity at runtime so the idempotent-update behavior holds across runs regardless of identity:

```bash
POSTER=$(gh api /user --jq '.login')
COMMENT_ID=$(gh api "repos/${REPO}/issues/${pr_number}/comments" \
  --jq "[.[] | select(.user.login == \"$POSTER\" and (.body // \"\" | contains(\"<!-- claude-code-review -->\")))] | first | .id // empty")
```

This replaces the skill's Step 4 (prior-comment lookup) for both the in-repo single-pass and plugin multi-pass variants. Both variants share the `<!-- claude-code-review -->` sentinel, so the same lookup works for both.

### Step 3 — Run the rest of the skill unchanged

Continue through the resolved skill's remaining steps as written: review the diff, run verification (tests / lint / type-check), write the review body to `/tmp/review_body.md`, post (or update via PATCH) the comment, and submit the formal `gh pr review --approve | --request-changes` verdict. The Iron Rules from the skill body still apply — no file modifications, critical issues only, every finding cites a file and line.

### Failure modes

| Condition | Action |
|---|---|
| `pr` field empty or unset | Skip silently — `pr-merge` did not create a PR. |
| `gh` not available | Skip silently and warn the captain (mirrors `pr-merge` behaviour). |
| `installed_plugins.json` missing or unreadable | Treat manifest read as empty; fall back to in-repo skill. |
| Resolved `SKILL.md` does not exist | Fall back to in-repo skill (third gate). |
| In-repo skill missing as well | Skip with a captain-visible warning — the workflow predates the skill. |
| Worktree branch does not match `head.ref` | Abort and report divergence; do not mutate worktree state. |
| `gh api /user` fails | Fall back to skipping the prior-comment lookup; the skill posts a fresh comment instead of updating in place. |

### Why this mod exists

The captain commissioned this entry to surface a self-review on every PR the workflow opens. Pick #2 in the entity's Suggestions section ties this to the canonical `merge` lifecycle hook documented in `_mods/pr-merge.md`. Self-review credibility was accepted by the captain at cycle-1 approval as already team practice; the audit signal of a posted formal review is the value, not an external second-opinion gate.
