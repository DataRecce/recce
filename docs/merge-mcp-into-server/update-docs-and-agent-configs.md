---
id: 004
title: Update docs, examples, and agent configs
status: designed
source: commission seed
started: 2026-04-13T07:06:28Z
completed:
verdict:
score: 0.5
worktree:
issue: DRC-3228
pr:
---

Update all user-facing documentation and agent integration snippets to reflect the unified `recce server` command. Anywhere that currently shows `recce mcp-server` as the canonical way to start Recce for agents should point to `recce server` (optionally with `--no-http` if mentioned in subtask `003`'s design).

**User-visible outcome:**
- README (root and `js/` subtrees) uses `recce server` in quickstart instructions.
- Docs site (recce-landing / docs content, if accessible from this repo) uses `recce server`.
- Agent config snippets (Claude MCP config examples, Cursor config, etc.) use `recce server`.
- AGENTS.md / CLAUDE.md reflect the unified command where relevant.

**Acceptance criteria:**
- No remaining references to `recce mcp-server` in docs *except* in the deprecation section or migration notes.
- Example invocations are verified to actually work against the updated binary.
- Screenshots or terminal captures (if any) still render correctly.
- Changelog entry drafted for the release.

**Depends on:** `001`, `002`, `003` — need the final CLI surface locked before documenting it.

**Scope note:** This subtask stays within the `recce` repo. Updates to `recce-landing`, marketing pages, or the Recce Cloud docs are tracked separately.

## Design Note: Docs and Agent-Config Updates

### 1. Files Referencing `recce mcp-server` (Comprehensive Grep Audit)

The following files in this repo currently reference `recce mcp-server` or the `mcp_server` CLI command in user-facing or developer-facing documentation/instructions.

| # | File (repo-relative) | Reference type | Intended edit |
|---|---|---|---|
| 1 | `recce/cli.py` (lines 2277-2324) | CLI docstring + examples: `recce mcp-server`, `recce mcp-server recce_state.json`, `recce mcp-server --sse`, etc. | **Handled by subtask 003** (deprecation warning). The docstring itself stays since the command still works during the grace period. No changes in this subtask. |
| 2 | `recce/cli.py` (line 2303) | Link to `https://docs.reccehq.com/setup-guides/mcp-server/#available-tools` | **Out of scope** (code change, not docs). Flag for external docs update. |
| 3 | `.claude/skills/recce-mcp-e2e/SKILL.md` (line 57) | "`recce mcp-server --help` shows Prerequisites section" in the manual checks table | **Rewrite**: Update to `recce server --help` and note that the legacy `recce mcp-server --help` shows deprecated status. |
| 4 | `.claude/skills/recce-mcp-dev/SKILL.md` (line 13) | `run_mcp_server()` entry point reference; no `recce mcp-server` user invocation | **No change needed** -- this references the Python function, not the CLI command. |
| 5 | `.claude/e2e/flows/mcp-error-classification-verification.yaml` (lines 57, 65, 81) | `tests/test_mcp_server.py` (test file path, not CLI invocation) | **No change needed** -- these reference the test file name, not the CLI command. |
| 6 | `CLAUDE.md` (lines 60-66) | "MCP Tool Response Contracts" section | **Update**: Add note that `recce server` now serves MCP by default (post-merge). The MCP response contracts section is still valid but should reference the unified server. |
| 7 | `AGENTS.md` | No MCP references currently | **Add**: A one-line note in the Essential Commands table: `recce server` serves both HTTP and MCP. Add to "Common Pitfalls" table: MCP not starting -> check `--no-mcp` flag or missing `mcp` package. |
| 8 | `README.md` | No `mcp-server` references; uses `recce server` in quickstart | **Add**: Brief mention of MCP capability in the Quick Start or What's Included section. |
| 9 | `docs/KNOWLEDGE_BASE.md` | No MCP references | **No change needed** -- this is an index of architecture docs. The architecture doc it points to (`docs/architecture.md`) may need updating but is lower priority. |
| 10 | `js/packages/ui/README.md` | No MCP references | **No change needed**. |
| 11 | `js/packages/storybook/README.md` | No MCP references | **No change needed**. |

**Workflow docs** (`docs/merge-mcp-into-server/*.md`): These are the workflow design/entity files themselves. References to `recce mcp-server` in these files are historical context and should NOT be edited -- they document what changed and why.

### 2. File-by-File Edit Plan

#### 2a. `AGENTS.md` -- Add MCP to Essential Commands and Pitfalls

**Essential Commands table** -- add row:

```markdown
| **MCP for Agents** | `recce server` (MCP enabled by default) |
```

**Common Pitfalls table** -- add row:

```markdown
| MCP endpoint not available | Ensure `mcp` extra is installed: `pip install 'recce[mcp]'`. Check `--no-mcp` was not passed. |
```

#### 2b. `CLAUDE.md` -- Update MCP Tool Response Contracts Section

Add a contextual note at the top of the existing "MCP Tool Response Contracts" section:

```markdown
## MCP Tool Response Contracts

> **Note:** As of v1.44.0, `recce server` exposes the MCP endpoint by default at `/mcp/sse`. The standalone `recce mcp-server` command is deprecated (removal in v1.46.0). Use `recce server --no-mcp` to disable MCP, or `recce server --no-http` for MCP-only mode.
```

The rest of the section (response format contracts, `_meta` fields, `summary.py` gotchas) remains unchanged.

#### 2c. `README.md` -- Add MCP Mention

In the "What's Included" section, add a bullet after the existing items:

```markdown
- [MCP server for AI agents](https://docs.reccehq.com/setup-guides/mcp-server/): `recce server` includes an MCP endpoint that lets AI assistants (Claude, Cursor, etc.) interact with Recce's data validation tools via the Model Context Protocol.
```

This is a single line addition. The quickstart section already uses `recce server` and needs no change.

#### 2d. `.claude/skills/recce-mcp-e2e/SKILL.md` -- Update Manual Check

Replace line 57:

```markdown
# Before:
| --help | `recce mcp-server --help` shows Prerequisites section |

# After:
| --help | `recce server --help` shows `--mcp / --no-mcp` flag. Legacy `recce mcp-server --help` shows "(Deprecated)". |
```

#### 2e. `docs/KNOWLEDGE_BASE.md` -- No Changes

The knowledge base is an index. The architecture doc it points to may need MCP lifecycle details but that is a separate concern outside this subtask's scope.

### 3. Canonical Example Invocations

Going forward, all user-facing documentation should use these invocations:

**Default (HTTP + MCP):**
```bash
recce server
```

**HTTP only (no MCP):**
```bash
recce server --no-mcp
```

**MCP only (no HTTP/web UI):**
```bash
recce server --no-http
```

**Deprecated (grace period until v1.46.0):**
```bash
recce mcp-server          # still works, prints deprecation warning
```

### 4. Agent Configuration Snippet Format

Agent configurations (Claude Desktop, Claude Code, Cursor) use JSON to specify MCP server commands. The canonical format after this change:

**Claude Desktop / Claude Code (`~/.claude.json` or `.mcp.json`):**

```json
{
  "mcpServers": {
    "recce": {
      "command": "recce",
      "args": ["server", "--no-http"],
      "env": {
        "DBT_PROJECT_DIR": "/path/to/your/dbt-project"
      }
    }
  }
}
```

**Note:** `--no-http` is used here because agent configs want MCP-only (stdio transport). The `recce server` command with `--no-http` replaces the old `recce mcp-server` invocation.

**Previous (deprecated) format for reference:**

```json
{
  "mcpServers": {
    "recce": {
      "command": "recce",
      "args": ["mcp-server"]
    }
  }
}
```

**Cursor MCP settings (`.cursor/mcp.json`):**

```json
{
  "mcpServers": {
    "recce": {
      "command": "recce",
      "args": ["server", "--no-http"]
    }
  }
}
```

These snippets should appear in the README MCP bullet (abbreviated), CLAUDE.md, and the external docs at `docs.reccehq.com/setup-guides/mcp-server/` (out-of-scope for this repo but flagged).

### 5. Changelog / Release Notes Entry

**Format:** GitHub Release Notes (no project-level CHANGELOG file exists).

**Audience:** Data engineers and AI agent developers using Recce.

**Draft text for v1.44.0 release notes:**

```markdown
### Unified Server Command

`recce server` now includes an MCP (Model Context Protocol) endpoint by default,
enabling AI assistants to connect alongside the web UI in a single process.

**What changed:**
- `recce server` starts both the HTTP API and the MCP endpoint.
- Use `--no-mcp` to disable MCP, or `--no-http` for MCP-only mode.
- The standalone `recce mcp-server` command is **deprecated** and will be removed
  in v1.46.0. It still works but prints a deprecation warning on startup.

**Migration for agent configs:**
Replace `recce mcp-server` with `recce server --no-http` in your Claude Desktop,
Cursor, or other MCP client configurations.
```

### 6. Quality Checks

| Check | How | Pass Criteria |
|---|---|---|
| **No stale `recce mcp-server` references** | `grep -rn "recce mcp-server" --include="*.md" .` excluding `docs/merge-mcp-into-server/` and lines that explicitly say "deprecated" or "legacy" | Zero results outside allowed exceptions |
| **Link validation** | `grep -rn "https://docs.reccehq.com" --include="*.md" .` -- verify each URL returns 200 (curl -sI) | All links resolve (or are flagged as external/out-of-scope) |
| **Terminal example verification** | After subtasks 001-003 are implemented: run `recce server --help` and verify `--mcp / --no-mcp` appears; run `recce mcp-server --help` and verify "(Deprecated)" appears | Help output matches documented text |
| **Agent config snippet verification** | After implementation: create a test `.mcp.json` with the canonical snippet and verify MCP client can connect to `recce server --no-http` | Connection established successfully |
| **Markdown lint** | Run any available markdown linter (e.g., `markdownlint`) on changed files | No errors |

**Note on terminal verification:** Since this is the design stage and subtasks 001-003 are not yet implemented, terminal examples cannot be verified now. The implementation stage for this subtask (004) must run these checks before committing doc changes.

### 7. Out-of-Scope Files (External Docs)

The following documentation surfaces live outside this repository and are NOT changed by this subtask:

| Surface | URL/Location | Action Needed |
|---|---|---|
| Recce docs site | `https://docs.reccehq.com/setup-guides/mcp-server/` | Add migration notice, update invocation examples. Track separately. |
| Recce docs site | `https://docs.reccehq.com/get-started/` | May reference `recce mcp-server` in agent setup. Track separately. |
| `recce-landing` repo | Marketing pages at `reccehq.com` | Review for MCP references. Track separately. |
| Recce Cloud docs | `docs.reccehq.com/cloud/` | May reference MCP for cloud mode. Track separately. |
| Third-party tutorials | Blog posts, community guides | Cannot control; the deprecation warning at runtime serves as migration notice. |

### 8. Rollback Plan

All documentation changes in this subtask are confined to markdown files in this repository. Rollback procedure:

1. Identify the doc-update commit(s) via `git log --oneline docs/merge-mcp-into-server/update-docs-and-agent-configs.md`.
2. Run `git revert <commit-sha>` for each doc commit.
3. Verify with `grep -rn "recce mcp-server" --include="*.md" .` that the pre-update state is restored.

No code, configuration, or build artifacts are affected. The revert is safe to perform at any time.

### 9. Zero Stale References Verification

After all edits in this subtask are applied, the following grep must return zero results:

```bash
grep -rn "recce mcp-server" --include="*.md" . \
  | grep -v "docs/merge-mcp-into-server/" \
  | grep -v "deprecated" \
  | grep -v "legacy" \
  | grep -v "migration"
```

**Expected exceptions** (references that intentionally remain):
- `docs/merge-mcp-into-server/*.md` -- workflow design docs (historical context)
- Any line containing "deprecated", "legacy", or "migration" -- these are the migration guide itself
- `.claude/skills/recce-mcp-e2e/SKILL.md` line 57 -- will be updated to reference both old and new commands (the old command mention is in a "Legacy" context)

**Non-markdown files** (`recce/cli.py`) still contain `recce mcp-server` in the command's own docstring. This is correct -- the command still exists during the deprecation grace period. These references are handled by subtask 003, not this subtask.

## Stage Report: designed

- [x] Enumerate all files in this repo that currently reference `recce mcp-server` or equivalent MCP-only startup instructions (use grep). Include exact file paths.
  See section 1: 11 files audited via `grep -rn`. Table includes exact paths, line numbers, and reference types.
- [x] For each file, specify the intended edit: keep the mention (deprecation migration guide), rewrite to `recce server`, or delete entirely.
  See section 1 "Intended edit" column and section 2 file-by-file edit plan. 5 files get edits, 6 require no changes.
- [x] Specify the canonical example invocation users should see going forward (the one-liner pushed in README/docs).
  See section 3: `recce server` (default), `recce server --no-mcp`, `recce server --no-http`, and deprecated `recce mcp-server`.
- [x] Specify the agent-config snippet format (e.g., Claude Desktop `mcp_servers` JSON stanza) with updated command/args.
  See section 4: JSON snippets for Claude Desktop/Code (`.mcp.json`), Cursor (`.cursor/mcp.json`), using `["server", "--no-http"]`.
- [x] Specify a changelog/release-notes entry: format, audience, draft text.
  See section 5: GitHub Release Notes draft for v1.44.0 covering unified server, flags, deprecation, and migration path.
- [x] Specify quality checks: link validation, terminal example verification (how will you confirm the examples actually work).
  See section 6: 5 quality checks including grep audit, link validation, terminal verification, agent config test, and markdown lint.
- [x] Identify out-of-scope files: docs living outside this repo (recce-landing, marketing pages).
  See section 7: 5 external surfaces identified (docs.reccehq.com, recce-landing, cloud docs, third-party tutorials).
- [x] Document rollback plan (git revert of doc commits).
  See section 8: `git revert` of doc commits, no code/config impact, safe at any time.
- [x] Verify the doc set will have zero stale `recce mcp-server` references except in the dedicated "Deprecated commands" / migration section.
  See section 9: Exact grep command provided with expected exceptions. Workflow docs and deprecation-context lines are the only allowed references.

### Summary

Produced a comprehensive design note for updating docs and agent configs to reflect the unified `recce server` command. Five files require edits: AGENTS.md (new MCP row in commands/pitfalls tables), CLAUDE.md (deprecation note in MCP contracts section), README.md (new MCP bullet in What's Included), and the recce-mcp-e2e skill file (updated manual check). The design specifies canonical invocations (`recce server`, `--no-mcp`, `--no-http`), agent-config JSON snippets for Claude/Cursor, a v1.44.0 release notes draft, and five quality gates. External docs (docs.reccehq.com, recce-landing) are flagged as out-of-scope.
