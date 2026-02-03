# Docs Sync: Automatic Documentation Update System

Design for a hook + subagent pipeline that detects `recce_cloud/` code changes and creates PRs to update `recce-docs`.

## Overview

When a developer finishes work that modifies `recce_cloud/`, the system:
1. Detects the change via a Claude Code hook
2. Spawns a scanner subagent to assess whether docs need updating
3. Prompts the user for approval
4. If approved, spawns a writer subagent that edits docs and opens a PR

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Claude Code session in recce repo                  │
│                                                     │
│  Task completes → Stop fires           │
│         │                                           │
│         ▼                                           │
│  Hook script (bash)                                 │
│  ├─ git diff: any recce_cloud/ changes?             │
│  ├─ $RECCE_DOCS_PATH set?                           │
│  └─ If both yes → instruct to spawn subagent        │
│         │                                           │
│         ▼                                           │
│  Scanner subagent (haiku)                           │
│  ├─ Spawned via Task tool                           │
│  ├─ Reads git diff for recce_cloud/                 │
│  ├─ Reads relevant docs in $RECCE_DOCS_PATH         │
│  ├─ Judges: does this change affect docs?           │
│  └─ If yes → prompts user, spawns writer            │
│         │                                           │
│         ▼  (user approves)                          │
│  Writer subagent (sonnet)                           │
│  ├─ Spawned via Task tool                           │
│  ├─ Has pre-approved git permissions                │
│  ├─ Uses elements-of-style for tone                 │
│  ├─ Edits markdown files                            │
│  ├─ Creates branch, commits, pushes                 │
│  └─ Opens PR via gh pr create                       │
│         │                                           │
│         ▼                                           │
│  Returns PR URL to user                             │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. Hook: docs-sync-check.sh

**Location:** `.claude/hooks/docs-sync-check.sh`

**Trigger:** `Stop` event

**Logic:**
- Exit silently if `RECCE_DOCS_PATH` is not set
- Exit silently if no changes under `recce_cloud/`
- If both pass, instruct Claude to spawn the scanner subagent

### 2. Scanner Subagent: docs-sync-scanner

**Location:** `.claude/agents/docs-sync-scanner.md`

**Model:** haiku (fast, cheap triage)

**Process:**
1. Read git diff for `recce_cloud/`
2. Read docs structure at `$RECCE_DOCS_PATH/docs/`
3. Judge: SKIP (internal changes) or FLAG (user-facing changes)
4. If FLAG: prompt user via AskUserQuestion
5. If approved: spawn `docs-sync-writer` subagent

### 3. Writer Subagent: docs-sync-writer

**Location:** `.claude/agents/docs-sync-writer.md`

**Model:** sonnet (quality writing)

**Pre-approved permissions:**
- All git operations (diff, checkout, pull, add, commit, push)
- gh pr create
- Skill (elements-of-style)

**Process:**
1. Invoke elements-of-style skill
2. Read code diff and affected docs
3. Edit docs following style rules
4. Create branch, commit with signoff, push
5. Open PR via `gh pr create`
6. Return PR URL

## File Layout

```
recce/
├── .claude/
│   ├── settings.json              # hook config + permissions
│   ├── hooks/
│   │   └── docs-sync-check.sh     # bash gate script
│   └── agents/
│       ├── docs-sync-scanner.md   # haiku triage subagent
│       └── docs-sync-writer.md    # sonnet writing subagent
```

## User Setup

**One-time setup per developer:**
1. Set `export RECCE_DOCS_PATH=/path/to/recce-docs`
2. Ensure `gh` CLI is authenticated

**What gets committed:**
- Hook configuration in `settings.json`
- Hook script and agent definitions

**What stays local:**
- `RECCE_DOCS_PATH` value

## Design Decisions

1. **Subagents over skills** — Subagents run autonomously with pre-approved permissions, reducing user prompts for routine git operations.

2. **Two-stage pipeline** — Scanner (haiku) is cheap for triage; writer (sonnet) only runs when needed for quality output.

3. **Pre-approved git permissions** — The writer subagent has default git/gh permissions so it can create PRs without prompting.

4. **Stop hook** — Fires when Claude finishes responding, catches final state of changes.

5. **Environment variable for docs path** — Simple, portable. Unset = feature disabled.
