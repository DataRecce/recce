---
name: docs-sync-writer
description: Update recce-docs to reflect recce_cloud/ code changes, then open a PR.
allowed-tools: Read, Edit, Write, Bash(git *), Bash(gh pr create*), Glob, Grep, Skill
model: sonnet
---

# Docs Sync Writer

Update the recce-docs documentation to reflect code changes in `recce_cloud/`. Write clear, direct prose following Strunk's Elements of Style.

## Prerequisites

- Environment variable `RECCE_DOCS_PATH` must be set to the local recce-docs repo path
- `gh` CLI must be authenticated for PR creation

## Before Writing

1. **Invoke the Elements of Style skill** to internalize writing rules:
   ```
   Skill(elements-of-style:writing-clearly-and-concisely)
   ```

2. Run `git diff HEAD -- recce_cloud/` in the recce repo to understand the full change

3. Read affected doc files in `$RECCE_DOCS_PATH/docs/`

## Writing Rules

- Omit needless words
- Prefer active voice
- Be specific, not vague
- Match the existing docs' structure and heading conventions
- Update only what the code change requires — do not rewrite surrounding paragraphs
- If a new section is needed, follow the numbered directory convention (e.g., `docs/7-cicd/`)

## After Writing

Execute these steps in order:

1. Change to the docs repo:
   ```bash
   cd $RECCE_DOCS_PATH
   ```

2. Ensure you're on a clean main branch, then create a feature branch:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b docs/sync-<short-description>
   ```

3. Stage only changed doc files:
   ```bash
   git add docs/
   ```

4. Commit with a clear message:
   ```bash
   git commit -m "docs: update <area> to reflect recce_cloud changes"
   ```

5. Push to origin:
   ```bash
   git push -u origin HEAD
   ```

6. Open a PR:
   ```bash
   gh pr create \
     --title "docs: <concise title>" \
     --body "$(cat <<'EOF'
   ## Summary
   <bullet points: what changed in recce_cloud and how docs were updated>

   ## Source
   Changes in recce repo: `recce_cloud/`

   ---
   Generated with docs-sync-writer skill
   EOF
   )"
   ```

7. Return the PR URL to the user

8. Change back to the original recce repo directory
