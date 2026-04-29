# Draft — `claude-code-review` integration proposal

This draft is the captain-facing companion to entity 002 (`claude-code-review.md`) at the `approval` stage. It is readable on its own without the entity's Suggestions section.

## Skill being integrated

- **Skill path:** `.claude/skills/claude-code-review/SKILL.md` (single-file, 7.2K, no `references/` or `bin/`).
- **Trigger (verbatim from frontmatter):** "Use when asked to review a PR, or when /review is invoked with a PR number or URL. Performs a focused code review checking for bugs, security, performance, and test gaps, then posts findings as a PR comment and formal GitHub review."
- **Categorization (from intake):** `review`. Single-actor pipeline, no subagent dispatch. Output is a posted PR comment plus a formal `gh pr review --approve | --request-changes` verdict.

## Proposed integration: two picks

### Pick #1 — `reference-doc` (primary, low-cost)

Append a `claude-code-review` entry to the existing "Related skills" subsection in `docs/claude-skill-refinement/README.md`. This is the same shape the captain approved for `address-dependabot` (entity 001).

**Proposed README diff (verbatim text to add):**

```markdown
- [`claude-code-review`](../../.claude/skills/claude-code-review/SKILL.md) — Review a PR for critical issues; post findings as a PR comment and formal GitHub review.
```

That is the entire change for pick #1 — one new line under the existing `## Related skills` heading at the bottom of the README.

**Why this is the safe pick:** zero runtime change to how the skill executes; it remains a slash-invoked single-actor pipeline. The change is documentation only, discoverable from the workflow that catalogued it, with no Spacedock agent or mod surface introduced.

**Spacedock primitive tie-in:** none — this is documentation, not orchestration.

### Pick #2 — `mod` (secondary, deliberative)

Install a new mod at `docs/claude-skill-refinement/_mods/claude-code-review.md` that runs *after* `pr-merge` on the `merge` lifecycle hook. The new mod invokes the in-repo skill's 9-step pipeline against the PR that pr-merge just created, posting a self-review and a formal `gh pr review` verdict.

**Spacedock primitive tie-in:** the `merge` hook is documented in `~/.claude/plugins/cache/spacedock/spacedock/0.10.2/mods/pr-merge.md` (lines 27-86). Mods chain by lexical filename order in the workflow's `_mods/` directory; `claude-code-review.md` sorts after `pr-merge.md`, so the FO runs pr-merge first (creating the PR) and this mod second (reviewing it).

**Spawn-vs-inline tie-in:** mods run inline in the FO's own execution thread. The skill is already inline-only (intake finding), so no agent fan-out is introduced — the mod simply has the FO follow the skill's 9 steps as itself.

**Proposed `_mods/claude-code-review.md` body (full text):**

````markdown
---
name: claude-code-review
description: Self-review the PR that pr-merge just opened, using the in-repo claude-code-review skill
version: 0.1.0
---

# Claude Code Review (mod)

Chains after the `pr-merge` mod on the `merge` hook. After pr-merge has pushed
the worktree branch and created a PR (and stamped the entity's `pr` field),
this mod runs the in-repo `.claude/skills/claude-code-review/SKILL.md` 9-step
pipeline against the new PR and posts a self-review.

This is an audit signal, not an independent reviewer. The author and the
reviewer are both this same FO instance; the reader should treat the review
as "the AI's own pre-merge check," not as a substitute for human review.

## Hook: merge

Runs after `pr-merge` completes successfully. Expects the entity to have its
`pr` field populated (pr-merge sets this on success).

If `pr-merge` declined to push, fell back to local merge, or otherwise did
not set the entity's `pr` field, skip this mod entirely — there is no PR to
review.

### Adaptations from the standalone skill

The skill assumes a fresh slash invocation. Two of its assumptions need
adapting when running as a chained mod inside an FO that just opened the PR:

1. **Step 5 (checkout) is a no-op in this context.** The pr-merge mod runs
   inside the worktree directory, which is already checked out to the PR's
   `head.ref`. Skip the `git fetch origin "$HEAD_REF" && git checkout "$HEAD_REF"`
   block. Verify by running `git rev-parse --abbrev-ref HEAD` and confirming
   it matches the PR's `head.ref`; if it does not (unexpected), abort the
   mod and report to the captain rather than mutating the worktree state.

2. **Step 4 (prior-comment lookup) must not hard-code `claude[bot]`.** The
   FO posts under whatever identity `gh auth` provides — that may or may not
   be `claude[bot]`. Resolve dynamically:

   ```bash
   POSTER=$(gh api /user --jq '.login')
   COMMENT_ID=$(gh api repos/{owner}/{repo}/issues/{pr_number}/comments \
     --jq "[.[] | select(.user.login == \"$POSTER\" and (.body // \"\" | contains(\"<!-- claude-code-review -->\")))] | first | .id // empty")
   ```

   This keeps the idempotent-update behavior (one self-review comment, edited
   on subsequent runs) regardless of poster identity.

### Pipeline

Follow the skill's 9 steps as written, with the two adaptations above:

1. Parse PR number from the entity's `pr` field (strip `#`, `owner/repo#` prefixes).
2. Fetch PR details via `gh api`.
3. If draft, skip and report.
4. Look up prior `<!-- claude-code-review -->` comment by the dynamically-resolved poster identity.
5. **Skipped** — worktree is already on `head.ref`.
6. Run `gh pr diff` and read changed files in the worktree.
7. Run repo verification commands (`make test`, `make flake8`, `pnpm test`, etc.) per the skill's Step 7 selection rule.
8. Write the review body to `/tmp/review_body.md` and post (PATCH if `COMMENT_ID` is set, otherwise create).
9. Submit `gh pr review --approve` or `--request-changes`.

### Iron rules (inherited from the skill)

- No file modifications. The mod runs the skill's read-only verification, never edits source.
- Critical issues only. No style nits.
- Every finding cites file:line.
- Respect AGENTS.md and CLAUDE.md.

### Failure modes

- `gh` not authenticated → warn captain, skip the mod, do not block pr-merge.
- Verification commands fail → record the failure in the review body as a
  finding (per the skill's existing Step 7 rule) and proceed to post.
- Prior-comment lookup throws → abort and post a fresh comment instead of
  silently duplicating; report the lookup failure to the captain.
````

## Honest mismatches the captain should weigh before approving Pick #2

These are surfaced explicitly so the captain can reject pick #2 cleanly without invalidating pick #1:

1. **Working-tree side effect (intake-flagged).** The skill's Step 5 mutates the local working tree by checking out the PR branch. The mod adapts by skipping Step 5 when the worktree is already on `head.ref`. This adaptation is straightforward but introduces a divergence between the standalone skill behavior and the mod-chained behavior — a future skill update that adds new pre-Step-5 logic will need to be re-applied to the mod by hand.

2. **`claude[bot]` identity assumption (intake-flagged).** The skill's prior-comment lookup is hard-coded to `user.login == "claude[bot]"`. The mod adapts by resolving the poster identity dynamically. If the upstream skill is later updated to also resolve identity dynamically, the mod's adaptation becomes redundant; if the upstream skill changes its sentinel marker or comment shape, the mod can drift silently.

3. **Self-review credibility ceiling.** The mod produces an audit signal that the FO ran the skill against its own PR. It is not an independent review. A reasonable captain might decide the per-PR API cost (gh API calls + `make test` + `pnpm test` + posting) and the noise (a guaranteed self-review on every workflow PR, even trivial ones) outweigh the audit value. If so, the right call is `reference-doc`-only — the skill remains directly invokable on demand for any PR a human wants to review, without the mod auto-running it on every workflow PR.

4. **Two skills with the same slash command.** The `recce-dev` plugin ships a parallel `claude-code-review` skill description that claims a "structured multi-pass code review with adversarial reading" — the in-repo skill at `.claude/skills/claude-code-review/SKILL.md` is single-pass. The mod calls the in-repo single-pass version. If a future captain wants the multi-pass plugin variant instead, the mod body would need editing to invoke that plugin slash command. This is a forkability concern for the mod, not an issue for the reference-doc pick.

## What this draft deliberately does NOT recommend

- **`workflow-stage-agent`:** no existing workflow has a review stage. Recommending a stage agent without a target stage would violate the workflow README's "recommending integration mechanisms that don't exist in Spacedock" anti-pattern.
- **`commission-seed`:** the captain rejected the equivalent commission-seed proposal for `address-dependabot` (entity 001 cycle-1) on the grounds that wrapping a single self-contained skill in a Spacedock workflow adds ceremony without value. The same logic applies here. Furthermore, the skill is already exposed via two parallel surfaces (in-repo `.claude/skills/` and the `recce-dev` plugin) — adding a workflow on top would be a third surface.
- **`keep-as-is`:** strictly dominated by the `reference-doc` pick. Both produce no runtime change; `reference-doc` adds one line of discoverability documentation at zero ongoing cost.

## Recommended approval path

- **If the captain wants the safe path** (matches the `address-dependabot` precedent, no new mod surface): approve pick #1 only. The execute stage produces a single README edit. Action items #2 and #3 from the entity body are dropped with a "skipped per approval gate" note in the Completed actions section.
- **If the captain wants the audit signal** despite the mismatches: approve picks #1 and #2 together. The execute stage produces the README edit (action item #1), the new mod file at `_mods/claude-code-review.md` (action item #2), and a "Mods" subsection in the workflow README naming the chain order (action item #3).

Either outcome is a clean approval. The picks are deliberately separated so the captain does not have to choose between "all or nothing."
