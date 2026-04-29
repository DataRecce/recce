# Draft — `claude-code-review` integration proposal (cycle 2)

This draft is the captain-facing companion to entity 002 (`claude-code-review.md`) at the `approval` stage. It is readable on its own without the entity's Suggestions section. Cycle 2 reflects captain feedback from the cycle-1 approval gate: Pick #1 carries forward unchanged; Pick #2 is reshaped into a single mod with plugin-detection-then-skill-resolution.

## Skill being integrated

- **In-repo skill path:** `.claude/skills/claude-code-review/SKILL.md` (single-file, 7.2K, single-pass review).
- **Plugin variant path (when recce-dev is enabled):** resolved at runtime via `~/.claude/plugins/installed_plugins.json`. On the captain's current environment the resolved path is `~/.claude/plugins/cache/recce-marketplace/recce-dev/1.0.1/skills/claude-code-review/SKILL.md` (multi-pass adversarial variant).
- **Trigger (verbatim from in-repo SKILL.md frontmatter):** "Use when asked to review a PR, or when /review is invoked with a PR number or URL. Performs a focused code review checking for bugs, security, performance, and test gaps, then posts findings as a PR comment and formal GitHub review."
- **Categorization (from intake):** `review`. Single-actor pipeline, no subagent dispatch. Output is a posted PR comment plus a formal `gh pr review --approve | --request-changes` verdict.

## Proposed integration: two picks

### Pick #1 — `reference-doc` (primary, low-cost) — unchanged from cycle 1

Append a `claude-code-review` entry to the existing "Related skills" subsection in `docs/claude-skill-refinement/README.md`. This is the same shape the captain approved for `address-dependabot` (entity 001) and was approved as-is at the cycle-1 approval gate.

**Proposed README diff (verbatim text to add):**

```markdown
- [`claude-code-review`](../../.claude/skills/claude-code-review/SKILL.md) — Review a PR for critical issues; post findings as a PR comment and formal GitHub review.
```

That is the entire change for pick #1 — one new line under the existing `## Related skills` heading at the bottom of the README.

**Why this is the safe pick:** zero runtime change to how the skill executes. The change is documentation only, discoverable from the workflow that catalogued it, with no Spacedock agent or mod surface introduced.

**Spacedock primitive tie-in:** none — this is documentation, not orchestration.

### Pick #2 — `mod` (secondary, reshaped per cycle-1 captain feedback)

Install a single new mod at `docs/claude-skill-refinement/_mods/claude-code-review.md` that runs *after* `pr-merge` on the `merge` lifecycle hook. The mod (1) detects whether the `recce-dev` plugin is enabled in the captain's environment and resolves the right `SKILL.md` path, (2) runs that variant's pipeline against the freshly-created PR, with two intake-flagged adaptations baked in.

**Spacedock primitive tie-in:** the `merge` hook is documented in `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/mods/pr-merge.md` (lines 27-86). Mods chain by lexical filename order in the workflow's `_mods/` directory; `claude-code-review.md` sorts after `pr-merge.md`, so the FO runs pr-merge first (creating the PR) and this mod second (reviewing it).

**Spawn-vs-inline tie-in:** mods run inline in the FO's own execution thread. The skill is already inline-only (intake finding), so no agent fan-out is introduced — the mod simply has the FO follow the resolved skill's steps as itself.

#### Plugin-detection mechanism (cycle-2 design)

The cycle-1 design did not specify a detection mechanism. The captain's prior probe at `~/.claude/plugins/cache/recce-dev/recce-dev/*/skills/claude-code-review` returned empty because it hard-coded `recce-dev` as the marketplace directory; the actual marketplace name on disk for this plugin is `recce-marketplace`. The cycle-2 design uses three layered checks:

**Gate A — installed-plugins manifest (authoritative for installPath).** Claude Code's `~/.claude/plugins/installed_plugins.json` is the canonical record of what is installed. Plugins are keyed as `{plugin-name}@{marketplace-name}`. For recce-dev that key is `recce-dev@recce-marketplace`, with a resolved `installPath` field that points directly at the versioned plugin directory. The mod reads this rather than guessing the on-disk directory layout:

```bash
PLUGIN_INSTALL_PATH=$(jq -r '."recce-dev@recce-marketplace"[0].installPath // empty' \
  ~/.claude/plugins/installed_plugins.json 2>/dev/null)
```

**Gate B — enabledPlugins settings flag (authoritative for active state).** Installed does not mean enabled. Claude Code's settings files have an `enabledPlugins` map keyed by the same `{plugin-name}@{marketplace-name}` form. The mod consults the project-level settings first (project `.claude/settings.json` overrides user `~/.claude/settings.json` per Claude Code's standard precedence), falls back to the user-level, and defaults to `false` if neither sets the flag:

```bash
PROJECT_FLAG=$(jq -r '.enabledPlugins["recce-dev@recce-marketplace"] // empty' \
  /Users/jaredmscott/repos/recce/recce/.claude/settings.json 2>/dev/null)
USER_FLAG=$(jq -r '.enabledPlugins["recce-dev@recce-marketplace"] // empty' \
  ~/.claude/settings.json 2>/dev/null)
ENABLED_FLAG="${PROJECT_FLAG:-${USER_FLAG:-false}}"
```

**Gate C — filesystem existence check (defensive against stale manifest).** The manifest can be stale (plugin removed without manifest cleanup); Gate C catches it. Combined with Gates A and B:

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

This three-gate approach (manifest → enabled → file exists) gives robust detection without depending on any single mechanism. A plain glob like `~/.claude/plugins/cache/*/recce-dev/*/skills/claude-code-review/SKILL.md` would also match the file but would not respect the captain's enable choice, so the layered approach is preferred.

#### Proposed `_mods/claude-code-review.md` body (full text)

````markdown
---
name: claude-code-review
description: Self-review the PR that pr-merge just opened, using the recce-dev plugin variant when enabled, otherwise the in-repo skill
version: 0.1.0
---

# Claude Code Review (mod)

Chains after the `pr-merge` mod on the `merge` hook. After pr-merge has pushed
the worktree branch and created a PR (and stamped the entity's `pr` field),
this mod resolves which `claude-code-review` skill variant to follow and runs
that variant's pipeline against the new PR.

This is an audit signal, not an independent reviewer — author and reviewer
are both the same FO instance. The captain has accepted that trade-off as
team practice.

## Hook: merge

Runs after `pr-merge` completes successfully. Expects the entity to have its
`pr` field populated (pr-merge sets this on success).

If `pr-merge` declined to push, fell back to local merge, or otherwise did
not set the entity's `pr` field, skip this mod entirely — there is no PR to
review.

### Step 1 — Resolve which skill variant to follow

Use a three-gate detection mechanism. The recce-dev plugin variant is preferred
when available because the captain has indicated the multi-pass adversarial
review is the desired output shape; the in-repo single-pass skill is the fallback.

```bash
# Gate A — read the installed-plugins manifest
PLUGIN_INSTALL_PATH=$(jq -r '."recce-dev@recce-marketplace"[0].installPath // empty' \
  ~/.claude/plugins/installed_plugins.json 2>/dev/null)

# Gate B — check enabledPlugins (project precedence over user)
PROJECT_FLAG=$(jq -r '.enabledPlugins["recce-dev@recce-marketplace"] // empty' \
  "$PROJECT_ROOT/.claude/settings.json" 2>/dev/null)
USER_FLAG=$(jq -r '.enabledPlugins["recce-dev@recce-marketplace"] // empty' \
  ~/.claude/settings.json 2>/dev/null)
ENABLED_FLAG="${PROJECT_FLAG:-${USER_FLAG:-false}}"

# Gate C — confirm the resolved file exists, otherwise fall back to the in-repo skill
if [[ -n "$PLUGIN_INSTALL_PATH" && "$ENABLED_FLAG" == "true" \
      && -f "$PLUGIN_INSTALL_PATH/skills/claude-code-review/SKILL.md" ]]; then
  SKILL_PATH="$PLUGIN_INSTALL_PATH/skills/claude-code-review/SKILL.md"
  SKILL_VARIANT="recce-dev plugin (multi-pass)"
else
  SKILL_PATH="$PROJECT_ROOT/.claude/skills/claude-code-review/SKILL.md"
  SKILL_VARIANT="in-repo (single-pass)"
fi

echo "Self-review will use: $SKILL_VARIANT at $SKILL_PATH"
```

Read `$SKILL_PATH` and follow the steps in that file, with the two adaptations
documented below. Both variants share the `<!-- claude-code-review -->`
sentinel and the `gh api` / `gh pr review` command surface, so the adaptations
apply identically to either.

### Step 2 — Adaptation: skip the skill's checkout step

Both skill variants include a fetch + checkout block to switch to the PR
branch. Inside a worktree-stage mod, the worktree is *already* on the
entity's branch (pr-merge runs from the worktree directory). Verify and skip:

```bash
CURRENT_BRANCH=$(cd "$WORKTREE_DIR" && git rev-parse --abbrev-ref HEAD)
EXPECTED_BRANCH=$(gh api "repos/{owner}/{repo}/pulls/$PR_NUMBER" --jq '.head.ref')
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  echo "Aborting self-review: worktree on '$CURRENT_BRANCH', PR head is '$EXPECTED_BRANCH'." \
    "pr-merge should have left the worktree on the PR branch."
  exit 1
fi
# Worktree is on the PR branch — no fetch/checkout needed.
```

If the verification fails, abort the mod and report to the captain rather
than mutating worktree state.

### Step 3 — Adaptation: dynamic poster identity for prior-comment lookup

Both skill variants hard-code `user.login == "claude[bot]"` in the prior-comment
lookup. The mod runs under whatever `gh auth` identity the FO has — that may
or may not be `claude[bot]`. Resolve dynamically:

```bash
POSTER=$(gh api /user --jq '.login')
COMMENT_ID=$(gh api "repos/{owner}/{repo}/issues/$PR_NUMBER/comments" \
  --jq "[.[] | select(.user.login == \"$POSTER\" and (.body // \"\" | contains(\"<!-- claude-code-review -->\")))] | first | .id // empty")
```

This keeps the idempotent-update behavior (one self-review comment, edited
on subsequent runs) regardless of poster identity. Both skill variants
recognize the `<!-- claude-code-review -->` sentinel.

### Step 4 — Run the resolved skill's review pipeline

Follow `$SKILL_PATH`'s remaining steps verbatim:

- Parse PR number from the entity's `pr` field (strip `#`, `owner/repo#` prefixes).
- Run the diff review and verification commands the resolved skill prescribes
  (the in-repo single-pass skill runs `make test`, `make flake8`, `pnpm test`,
  `pnpm lint`, `pnpm type:check`; the plugin multi-pass variant has its own
  selection — both are read from `$SKILL_PATH` at runtime, not hard-coded
  here, so the mod automatically tracks upstream skill changes).
- Write the review body to `/tmp/review_body.md` and post (PATCH if
  `COMMENT_ID` is set, otherwise create).
- Submit `gh pr review --approve` or `--request-changes`.

### Iron rules (inherited from whichever skill variant resolved)

- No file modifications. The mod runs the skill's read-only verification, never edits source.
- Critical issues only. No style nits.
- Every finding cites file:line.
- Respect AGENTS.md and CLAUDE.md.

### Failure modes

- `gh` not authenticated → warn captain, skip the mod, do not block pr-merge.
- Verification commands fail → record the failure in the review body as a
  finding (per the resolved skill's existing rule) and proceed to post.
- Prior-comment lookup throws → abort and post a fresh comment instead of
  silently duplicating; report the lookup failure to the captain.
- Manifest read fails → log the failure, fall back to the in-repo skill
  rather than skipping the review entirely.
````

## Mismatches still in scope (cycle 2)

Each mismatch below has a concrete resolution baked into the mod design above. They are surfaced explicitly so the captain can sign off on them along with the picks.

1. **Working-tree side effect (intake-flagged).** The skill's checkout step mutates the local working tree. Resolution: the mod verifies the worktree is already on the PR's `head.ref` (it should be, since pr-merge ran from the worktree) and skips the checkout when the verification passes. If the verification fails, the mod aborts rather than mutating worktree state.

2. **Hard-coded `claude[bot]` identity assumption (intake-flagged).** The skill's prior-comment lookup is hard-coded to `user.login == "claude[bot]"`. Resolution: the mod resolves the poster identity dynamically via `gh api /user --jq '.login'` before running the lookup. Idempotent-update behavior is preserved across runs regardless of poster identity. Both skill variants share the `<!-- claude-code-review -->` sentinel, so this fix is variant-agnostic.

## Mismatch downgraded per cycle-1 captain acceptance

3. **Self-review credibility (downgraded to one-line acknowledgement).** Captain accepted self-review on freshly-created PRs as already team practice; cycle-2 design treats the audit signal as sufficient and does not re-litigate.

## What this draft deliberately does NOT recommend

- **`workflow-stage-agent`:** no existing workflow has a review stage. Recommending a stage agent without a target stage would violate the workflow README's "recommending integration mechanisms that don't exist in Spacedock" anti-pattern.
- **`commission-seed`:** the captain rejected the equivalent commission-seed proposal for `address-dependabot` (entity 001 cycle-1) on the grounds that wrapping a single self-contained skill in a Spacedock workflow adds ceremony without value. The same logic applies here. Furthermore, with the mod now consuming both variants via the detection mechanism, there is no second surface to consolidate via a workflow.
- **`keep-as-is`:** strictly dominated by the `reference-doc` pick. Both produce no runtime change; `reference-doc` adds one line of discoverability documentation at zero ongoing cost.

## Recommended approval path

- **If the captain wants the safe path** (matches the `address-dependabot` precedent, no new mod surface): approve pick #1 only. The execute stage produces a single README edit. Action items #2 and #3 from the entity body are dropped with a "skipped per approval gate" note in the Completed actions section.
- **If the captain wants the audit signal**: approve picks #1 and #2 together. The execute stage produces the README edit (action item #1), the new mod file at `_mods/claude-code-review.md` (action item #2 — note the cycle-2 design uses the three-gate plugin detection), and a "Mods" subsection in the workflow README naming the chain order (action item #3).

Either outcome is a clean approval. The picks are deliberately separated so the captain does not have to choose between "all or nothing."
