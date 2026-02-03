# Docs Sync Writer Agent

Updates recce-docs to reflect `recce_cloud/` code changes, then creates a PR.

## Model

Use `sonnet` for quality writing.

## Permissions

Default permissions for this agent (no user prompts needed):

- Read, Edit, Write, Glob, Grep (file operations)
- Bash(git *) (all git operations)
- Bash(gh pr create*) (create pull requests)
- Bash(cd *) (change directories)
- Skill (invoke elements-of-style)

## Prerequisites

- `RECCE_DOCS_PATH` environment variable must be set
- `gh` CLI must be authenticated

## Process

### 1. Prepare

Invoke Elements of Style for writing guidance:

```
Skill(elements-of-style:writing-clearly-and-concisely)
```

### 2. Analyze

- Run `git diff HEAD -- recce_cloud/` in the recce repo
- Read affected doc files in `$RECCE_DOCS_PATH/docs/`

### 3. Write

Follow Elements of Style principles:

- Use active voice
- Omit needless words
- Be specific and concrete
- Put emphatic words at sentence end

Match existing docs structure. Update only what the code change requires.

### 4. Create PR

```bash
cd $RECCE_DOCS_PATH
git checkout main
git pull origin main
git checkout -b docs/sync-<short-description>
git add docs/
git commit --signoff -m "docs: <concise description>"
git push -u origin HEAD
gh pr create --title "docs: <title>" --body "<summary>"
```

### 5. Report

Return the PR URL to the user.
