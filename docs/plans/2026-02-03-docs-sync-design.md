# Docs Sync: Automatic Documentation Update System

Design for a hook + skill + subagent pipeline that detects `recce_cloud/` code changes and creates PRs to update `recce-docs`.

## Overview

When a developer finishes work that modifies `recce_cloud/`, the system:
1. Detects the change via a Claude Code hook
2. Dispatches a scanner subagent to assess whether docs need updating
3. Prompts the user for approval
4. If approved, dispatches a writer subagent that edits docs and opens a PR

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Claude Code session in recce repo                  │
│                                                     │
│  Task completes → NotificationShown fires           │
│         │                                           │
│         ▼                                           │
│  Hook script (bash)                                 │
│  ├─ git diff: any recce_cloud/ changes?             │
│  ├─ $RECCE_DOCS_PATH set?                           │
│  └─ If both yes → print trigger message             │
│         │                                           │
│         ▼                                           │
│  Scanner subagent (haiku)                           │
│  ├─ Reads git diff for recce_cloud/                 │
│  ├─ Reads relevant docs in $RECCE_DOCS_PATH         │
│  ├─ Judges: does this change affect docs?           │
│  └─ If yes → prompts user with explanation          │
│         │                                           │
│         ▼  (user approves)                          │
│  Writer subagent (sonnet)                           │
│  ├─ Reads full diff + affected doc files            │
│  ├─ Uses elements-of-style skill for tone           │
│  ├─ Creates branch in recce-docs repo               │
│  ├─ Edits markdown files                            │
│  ├─ Commits + pushes                                │
│  └─ Opens PR via gh pr create                       │
│         │                                           │
│         ▼                                           │
│  Returns PR URL to user                             │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. Hook: docs-sync-check.sh

**Location:** `.claude/hooks/docs-sync-check.sh`

**Trigger:** `NotificationShown` event (fires when Claude finishes a task)

**Logic:**
- Exit silently if `RECCE_DOCS_PATH` environment variable is not set
- Exit silently if `git diff HEAD --name-only` shows no changes under `recce_cloud/`
- If both conditions pass, print a message prompting Claude to run the scanner skill

**Configuration in `.claude/settings.json`:**
```json
{
  "hooks": {
    "NotificationShown": [
      {
        "matcher": "",
        "command": ".claude/hooks/docs-sync-check.sh"
      }
    ]
  }
}
```

### 2. Scanner Skill: docs-sync-scanner

**Location:** `.claude/skills/docs-sync-scanner/SKILL.md`

**Model:** haiku (fast, cheap, read-only triage)

**Allowed tools:** Read, Bash(git diff*), Glob, Grep, AskUserQuestion, Skill

**Process:**
1. Run `git diff HEAD -- recce_cloud/` to get current changes
2. Identify what changed: CLI commands, flags, API methods, errors, behavior
3. Read docs structure at `$RECCE_DOCS_PATH/docs/`
4. Read specific doc files that might be affected
5. Judge: SKIP (internal/test-only changes) or FLAG (user-facing changes)

**Output:**
- If SKIP: brief explanation, done
- If FLAG: use AskUserQuestion to prompt user, invoke writer skill if approved

### 3. Writer Skill: docs-sync-writer

**Location:** `.claude/skills/docs-sync-writer/SKILL.md`

**Model:** sonnet (quality writing)

**Allowed tools:** Read, Edit, Write, Bash(git *), Bash(gh pr create*), Glob, Grep, Skill

**Process:**
1. Invoke `elements-of-style:writing-clearly-and-concisely` skill
2. Read the full git diff from recce repo
3. Read affected doc files
4. Edit docs following Elements of Style rules
5. In `$RECCE_DOCS_PATH`:
   - Create branch: `docs/sync-<description>`
   - Commit changes
   - Push to origin
   - Open PR via `gh pr create`
6. Return PR URL to user

## File Layout

```
recce/
├── .claude/
│   ├── settings.json              # hook config
│   ├── hooks/
│   │   └── docs-sync-check.sh     # bash gate script
│   └── skills/
│       ├── docs-sync-scanner/
│       │   └── SKILL.md           # haiku triage agent
│       └── docs-sync-writer/
│           └── SKILL.md           # sonnet writing agent
```

## User Setup

**One-time setup per developer:**
1. Set environment variable: `export RECCE_DOCS_PATH=/path/to/recce-docs`
2. Ensure `gh` CLI is authenticated for PR creation

**What gets committed:**
- Hook configuration in `settings.json`
- Hook script `docs-sync-check.sh`
- Both skill files

**What stays local:**
- `RECCE_DOCS_PATH` value (each developer's local path)

## Design Decisions

1. **NotificationShown hook** — checks at task completion, not on every file edit. Less noise, catches final state.

2. **Environment variable for docs path** — simple, portable, no extra config files. Unset = feature disabled.

3. **LLM judgment for scanner** — heuristics miss edge cases. Haiku is fast/cheap enough for triage.

4. **PR output instead of local edits** — cleaner workflow, reviewable artifact, no surprise local changes.

5. **Elements of Style enforcement** — writer skill explicitly invokes the style skill before any editing.
