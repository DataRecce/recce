# kc-sentry-insight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code plugin that scans Sentry for production errors (with native MCP monitoring support), generates diff-aware markdown reports, accumulates domain knowledge via profile YAML, and optionally pushes actionable issues to Linear.

**Architecture:** Single orchestrator skill (`SKILL.md`) dispatches a `sentry-analyzer` agent for context-isolated Sentry queries. Skill handles profile I/O, diff classification, report generation, Linear push, and profile iteration proposals. Per-project data lives in `${project}/.claude/insight/sentry/`.

**Tech Stack:** Claude Code plugin (SKILL.md + agent .md), Sentry MCP tools, Linear MCP tools, YAML profiles, Markdown reports.

**Spec:** `docs/superpowers/specs/2026-03-19-kc-sentry-insight-design.md`

**Target repo:** `/Users/kent/Project/kc-claude-workspace/kc-claude-plugins/kc-sentry-insight/`

---

## File Structure

```
kc-sentry-insight/
├── .claude-plugin/
│   └── plugin.json                    # plugin manifest
├── README.md                          # usage docs
├── skills/
│   └── kc-sentry-insight/
│       └── SKILL.md                   # orchestrator skill (scan, bootstrap, push, profiles)
├── agents/
│   └── sentry-analyzer.md             # Sentry MCP query + classification agent
└── reference/
    └── analysis-guide.md              # classification heuristics, query examples
```

**Responsibilities:**

| File | Responsibility |
|------|---------------|
| `plugin.json` | Plugin identity, metadata, keywords. **Note:** lives in `.claude-plugin/plugin.json` (convention), not at plugin root (spec diagram is simplified). |
| `SKILL.md` | Command routing, profile resolution, bootstrap flow, agent dispatch, diff & classify, report generation, profile iteration proposals, Linear push flow |
| `sentry-analyzer.md` | Agent frontmatter (model, tools, examples), system prompt for Sentry queries by strategy (structured/keyword), noise filtering, unified output format |
| `analysis-guide.md` | Reusable reference: Sentry MCP query patterns for both strategies, classification heuristics, noise detection patterns. Read by agent at runtime. |
| `README.md` | Installation, prerequisites, command reference, profile schema docs |

---

## Task 1: Scaffold Plugin Structure

**Files:**
- Create: `kc-sentry-insight/.claude-plugin/plugin.json`
- Create: `kc-sentry-insight/README.md`

- [ ] **Step 1: Create plugin directory and plugin.json**

Navigate to the kc-claude-plugins repo and create the plugin scaffold:

```bash
cd /Users/kent/Project/kc-claude-workspace/kc-claude-plugins
mkdir -p kc-sentry-insight/.claude-plugin
```

Write `kc-sentry-insight/.claude-plugin/plugin.json`:

```json
{
  "name": "kc-sentry-insight",
  "description": "Scan Sentry for production errors with diff tracking, profile-based domain knowledge, and optional Linear push. Supports Sentry native MCP monitoring (span.op) and keyword-based search.",
  "version": "0.1.0",
  "author": {
    "name": "Kent Chen",
    "url": "https://github.com/iamcxa"
  },
  "license": "MIT",
  "keywords": ["sentry", "insight", "error-analysis", "linear", "mcp-monitoring", "profile"]
}
```

- [ ] **Step 2: Create README.md**

Write `kc-sentry-insight/README.md` with:
- Plugin description
- Prerequisites (Sentry MCP + Linear MCP connections)
- Command reference table (from spec: scan, push, profiles)
- Profile YAML schema reference
- Per-project data location: `${project}/.claude/insight/sentry/`

- [ ] **Step 3: Create directory structure**

```bash
mkdir -p kc-sentry-insight/skills/kc-sentry-insight
mkdir -p kc-sentry-insight/agents
mkdir -p kc-sentry-insight/reference
```

- [ ] **Step 4: Commit scaffold**

Note: empty directories (`skills/`, `agents/`, `reference/`) are not tracked by git. They become visible once files are added in subsequent tasks.

```bash
cd /Users/kent/Project/kc-claude-workspace/kc-claude-plugins
git add kc-sentry-insight/
git commit -s -m "$(cat <<'EOF'
chore(kc-sentry-insight): scaffold plugin structure

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Write the analysis-guide.md Reference

**Files:**
- Create: `kc-sentry-insight/reference/analysis-guide.md`

This file is read by the sentry-analyzer agent at runtime. It must be written BEFORE the agent prompt, since the agent references it.

- [ ] **Step 1: Write analysis-guide.md**

Content must cover:

**Section 1 — Structured Strategy Query Patterns:**
- How to use `search_events` with `span.op: mcp.server` filter
- How to extract per-tool error rates from event data
- How to detect silent JSON-RPC errors (errors returned as responses, not exceptions)
- Session ID grouping for stateful debugging
- Example Sentry MCP tool calls with expected parameters

**Section 2 — Keyword Strategy Query Patterns:**
- How to use `search_issues` with keyword combinations
- Primary keywords (domain terms) + secondary keywords (related terms)
- Optional error-type keywords (unhandled, exception, 500)
- Sorting by frequency, scoping to last 14 days
- Pattern borrowed from kc-nightwatch sentry-scanner

**Section 3 — Classification Heuristics:**
- Confidence rating rules:
  - high: spike >3x, regression (resolved→reopened), user-facing >10 events/7d
  - medium: new (<7d first_seen), recurring 3-10 events
  - low: single occurrence, infrastructure noise
- Error type classification: permission_denied, timeout, not_found, unhandled, etc.
- Impact hint generation: derive from error context (user role, affected feature, data scope)

**Section 4 — Noise Detection:**
- Include: user-facing errors, API failures on core paths, unhandled exceptions, regressions, payment/critical errors
- Exclude: infrastructure (timeouts, rate limits, CORS, DNS), assigned issues, bot/crawler errors, health checks, ignored/archived issues
- How to apply `noise_patterns` from profile: regex match against issue title + stack summary

**Section 5 — Events Trend Calculation:**
- `events_7d`: events in last 7 days from scan date
- `events_prior_7d`: events in days 8-14 (null if data unavailable)
- `events_trend`: `(events_7d - events_prior_7d) / events_prior_7d` as percentage string (e.g., "+88%", "-23%")
- Null when `events_prior_7d` unavailable or issue is newly detected

- [ ] **Step 2: Commit reference file**

```bash
git add kc-sentry-insight/reference/analysis-guide.md
git commit -s -m "$(cat <<'EOF'
docs(kc-sentry-insight): add analysis guide reference

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Write the sentry-analyzer Agent

**Files:**
- Create: `kc-sentry-insight/agents/sentry-analyzer.md`

- [ ] **Step 1: Write agent frontmatter**

Follow the kc-nightwatch sentry-scanner pattern for frontmatter:

```yaml
---
name: sentry-analyzer
description: |
  Scan Sentry for production errors using structured (span.op) or keyword strategy.
  Returns unified YAML with classified issues and noise-filtered IDs. Dispatched by
  kc-sentry-insight skill for context-isolated Sentry queries.

  <example>
  Context: Skill dispatches structured scan for MCP errors
  user: "Scan Sentry for mcp errors. Strategy: structured. Org: datarecce. Projects: [{slug: recce-python, label: backend}]. Structured config: {span_op: 'mcp.server', focus: [most_failing_tools, slowest_tools]}. Noise patterns: [{pattern: 'TimeoutError.*health_check'}]. Known issue IDs: ['RECCE-A1B2']."
  assistant: "Scanning Sentry project recce-python with span.op: mcp.server filter."
  <commentary>Structured strategy uses search_events with span.op filter for MCP-native monitoring.</commentary>
  </example>

  <example>
  Context: Skill dispatches keyword scan for checkout errors
  user: "Scan Sentry for checkout errors. Strategy: keyword. Org: my-org. Projects: [{slug: my-app-web, label: frontend}]. Keywords: {primary: [checkout, payment], secondary: [cart, order]}. Noise patterns: []. Known issue IDs: []."
  assistant: "Searching Sentry project my-app-web with keywords: checkout, payment."
  <commentary>Keyword strategy uses search_issues with keyword combinations, similar to nightwatch sentry-scanner.</commentary>
  </example>

  <example>
  Context: Sentry MCP tools unavailable
  user: "Scan Sentry for api errors. Strategy: keyword. Org: my-org. Projects: [{slug: my-service, label: api}]."
  assistant: "Sentry MCP tools not available — returning empty results with warning."
  <commentary>Graceful degradation: tool unavailability returns valid YAML with warning, never errors.</commentary>
  </example>
model: sonnet
color: red
tools: Read, mcp__claude_ai_Sentry__search_issues, mcp__claude_ai_Sentry__get_issue_details, mcp__claude_ai_Sentry__search_events, mcp__claude_ai_Sentry__find_projects
---
```

- [ ] **Step 2: Write agent system prompt body**

The body after frontmatter must include:

**Identity:** You are a Sentry error analyzer. You query Sentry and return structured YAML.

**Reference loading:** Read `${CLAUDE_PLUGIN_ROOT}/reference/analysis-guide.md` before starting analysis.

**Input contract:** Document all input fields the agent receives from the skill (strategy, sentry_org, projects, structured/keywords config, noise_patterns, known_issue_ids).

**Execution flow:**
1. Verify projects exist via `find_projects`
2. Branch by strategy:
   - structured: `search_events` with `span.op` → per-tool aggregation → `get_issue_details` for top failures
   - keyword: `search_issues` with keyword combos → `get_issue_details` for top N
3. Apply noise_patterns — issues matching patterns go to `noise_filtered_ids`, not `issues`
4. Calculate events_trend per issue
5. Generate impact_hint from error context

**Output contract:** Exact YAML format from spec (scanned_at, projects_scanned, issues list, noise_filtered_ids). Include the empty/warning variants.

**Rules:**
1. Max 15 issues before noise filtering (return top 10 after)
2. Every issue must cite a real Sentry issue ID
3. YAML only — no prose before or after
4. Graceful degradation — tool unavailability returns valid empty YAML with warning
5. Never fabricate issue IDs or event counts

- [ ] **Step 3: Commit agent**

```bash
git add kc-sentry-insight/agents/sentry-analyzer.md
git commit -s -m "$(cat <<'EOF'
feat(kc-sentry-insight): add sentry-analyzer agent

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Write the Orchestrator Skill — Command Routing & Profile Resolution

**Files:**
- Create: `kc-sentry-insight/skills/kc-sentry-insight/SKILL.md`

This is the largest file. We build it incrementally across Tasks 4-7. Start with the skeleton, routing, and profile resolution.

- [ ] **Step 1: Write skill frontmatter and header**

```yaml
---
name: kc-sentry-insight
description: Use when scanning Sentry for production errors, managing error profiles, or pushing Sentry issues to Linear. Triggered by "/kc-sentry-insight", "sentry insight", "scan sentry", "sentry errors".
---
```

- [ ] **Step 2: Write command routing section**

Parse arguments from invocation:
- `/kc-sentry-insight <keyword>` → Scan Flow
- `/kc-sentry-insight <keyword> --learn` → Scan Flow (learn mode)
- `/kc-sentry-insight push <keyword> --issues N,N,N [--report YYYY-MM-DD]` → Push Flow
- `/kc-sentry-insight profiles` → List Profiles

Include a routing flowchart (dot graph) showing the decision tree.

- [ ] **Step 3: Write profile resolution section**

Profile path: `${project}/.claude/insight/sentry/profiles/<keyword>.yaml`

Logic:
1. Check if profile file exists (Read tool)
2. If exists → load and parse YAML → proceed to scan
3. If not exists → enter Bootstrap Flow (Task 5)

Include: ensure directories exist (`mkdir -p` via Bash) before writing.

- [ ] **Step 4: Commit routing skeleton**

```bash
git add kc-sentry-insight/skills/kc-sentry-insight/SKILL.md
git commit -s -m "$(cat <<'EOF'
feat(kc-sentry-insight): add skill skeleton with routing and profile resolution

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Write the Orchestrator Skill — Bootstrap Flow

**Files:**
- Modify: `kc-sentry-insight/skills/kc-sentry-insight/SKILL.md`

- [ ] **Step 1: Write bootstrap flow section**

Bootstrap triggers when profile doesn't exist. Steps:

**Step B1 — Scan repo for Sentry config:**
- Use Grep to find DSN by content pattern: `https://.*@o\d+\.ingest\.sentry\.io/`
- Use Grep to find `sentry_sdk.init(` and `Sentry.init(` calls
- Use Glob to find nightwatch config: `**/nightwatch-targets.yaml`
- **Org slug resolution (important):** The DSN URL only contains a numeric org ID (e.g., `o1081482`), NOT the human-readable org slug (e.g., `datarecce`). To get the org slug:
  1. First try: extract from nightwatch config if present
  2. Fallback: use `find_projects` Sentry MCP tool to resolve numeric org ID → org slug
  3. Last resort: ask the user
  - Do NOT parse org slug from the DSN URL directly.
- Aggregate findings into candidate list

**Step B2 — Handle multiple projects (monorepo):**
- If >1 DSN/project found → present numbered list to user
- User multi-selects → each becomes a sub-entry in `sentry.projects`

**Step B3 — Infer strategy:**
- If keyword matches known Sentry native integrations (mcp → span.op: mcp.server) AND project has MCP SDK dependency → propose `structured`
- Check for `MCPIntegration` or `wrapMcpServerWithSentry` imports
- Otherwise → `keyword`

**Step B4 — Present inferences and confirm:**
- Show detected org, projects, strategy to user
- Ask for confirmation
- If inference incomplete → ask missing fields one at a time

**Step B5 — Write profile YAML:**
- Use Write tool to create `${project}/.claude/insight/sentry/profiles/<keyword>.yaml`
- Schema matches spec exactly (name, strategy, sentry, linear, noise_patterns, severity_overrides, last_scan, issue_history)

- [ ] **Step 2: Commit bootstrap flow**

```bash
git add kc-sentry-insight/skills/kc-sentry-insight/SKILL.md
git commit -s -m "$(cat <<'EOF'
feat(kc-sentry-insight): add bootstrap flow to skill

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Write the Orchestrator Skill — Scan Flow (Agent Dispatch, Diff, Report)

**Files:**
- Modify: `kc-sentry-insight/skills/kc-sentry-insight/SKILL.md`

- [ ] **Step 1: Write agent dispatch section**

After profile is loaded, dispatch `sentry-analyzer` agent:
- Build prompt from profile fields (strategy, org, projects, structured/keywords config, noise_patterns, known_issue_ids)
- If `--learn` mode: add `learn_mode: true` to agent prompt — agent runs additional distribution queries (e.g., top error categories across all issues, not just keyword-matching ones) and includes an `error_distribution` section in output
- Use Agent tool with `subagent_type: "kc-sentry-insight:sentry-analyzer"`
- Agent returns YAML string → skill parses result

Include: graceful handling if agent returns warning (Sentry unavailable).

- [ ] **Step 2: Write diff & classify section**

Receive agent output (issues + noise_filtered_ids). For each issue:
- `NEW` = sentry_id NOT in `profile.last_scan.known_issue_ids`
- `WORSENED` = in known_issue_ids AND `events_trend > +50%`
- `RECURRING` = in known_issue_ids AND (`events_trend <= +50%` OR events_trend null)
- `RESOLVED` = in known_issue_ids AND NOT in agent issues AND NOT in noise_filtered_ids

Sort: NEW + WORSENED first, then RECURRING, then RESOLVED.

- [ ] **Step 3: Write report generation section**

Generate markdown report following spec format:
- Header: keyword, strategy, projects, org, scan period, last scan date
- Summary counts: new, worsened, recurring, resolved
- Issues: numbered `#1`, `#2`, etc. with all fields from agent output:
  - Sentry ID, Project label, First seen, Events (7d), Events trend (e.g., "+88% vs prior 7d"), Tool (structured only), Impact, Stack
  - Delta label in the header: `[NEW]`, `[WORSENED]`, `[RECURRING]`, `[RESOLVED]`
- Conditional Tool line (only for structured strategy)
- Multi-project label: `[backend]`, `[frontend]`
- Footer: "Pushed to Linear: (none yet)"

Write to: `${project}/.claude/insight/sentry/reports/<keyword>/YYYY-MM-DD.md`
Display summary to user in conversation.

- [ ] **Step 4: Write profile iteration proposals section**

After report, check for iteration opportunities:
- `issue_history` entries with `seen_count >= 2` and `last_pushed: null` → propose as noise
- New tool names in issues (structured) not in `structured.focus` → propose adding
- Known issues resolved 3+ consecutive scans → propose removal
- `--learn` mode: lower thresholds to `seen_count >= 1`, suggest keyword/focus adjustments

Present each proposal individually, user confirms yes/no, update profile YAML.

- [ ] **Step 5: Write scan state update section**

After proposals:
1. Update `last_scan.timestamp` to current ISO 8601
2. Update `last_scan.known_issue_ids` to current issue sentry_ids
3. Update `last_scan.report_path` to the new report path
4. Update `issue_history`:
   - Existing entries in agent `issues` list → increment `seen_count`
   - New entries in agent `issues` list → append `{sentry_id, seen_count: 1, first_scan: today, last_pushed: null}`
   - Issues in `noise_filtered_ids` → do NOT increment `seen_count`, do NOT create new entries (noise-filtered issues are excluded from history to avoid triggering noise-driven proposals)
   - Entries not in agent output AND not in noise_filtered_ids → leave as-is (resolved issues keep history)

Write updated profile YAML back to disk.

- [ ] **Step 6: Commit scan flow**

```bash
git add kc-sentry-insight/skills/kc-sentry-insight/SKILL.md
git commit -s -m "$(cat <<'EOF'
feat(kc-sentry-insight): add scan flow — dispatch, diff, report, iteration

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Write the Orchestrator Skill — Push Flow & Profiles List

**Files:**
- Modify: `kc-sentry-insight/skills/kc-sentry-insight/SKILL.md`

- [ ] **Step 1: Write push flow section**

Parse push command: `push <keyword> --issues 1,3,5 [--report YYYY-MM-DD]`

Steps:
1. Load profile
2. **Discover Linear MCP tool prefix:** Use `ToolSearch` with query `"+linear save"` to find the active Linear MCP tool name (prefix varies by installation — could be `mcp__claude_ai_Linear__` or `mcp__plugin_linear_linear__` etc.). Cache the discovered prefix for the session.
3. Resolve report: `--report` flag → specific date, otherwise `last_scan.report_path`
4. Parse report markdown to extract issue data for selected `#N` numbers
5. Resolve Linear target:
   - `profile.linear.team_id` set → use it
   - Not set → ask user → save to profile
6. For each selected issue:
   - Build title: structured → `[Sentry] <tool_name> — <error summary>`, keyword → `[Sentry] <error summary>`
   - Build description from Linear Issue Template in spec
   - Show to user for confirmation before creating
   - Use discovered `{prefix}save_issue` to create
   - Use discovered `{prefix}list_issue_labels` to resolve label names if needed
7. Update report: append pushed issue IDs to footer
8. Update profile: set `issue_history[].last_pushed` for pushed items

**Important:** Do NOT hardcode Linear MCP tool names (e.g., `mcp__claude_ai_Linear__save_issue`). Tool name prefixes vary by installation. Always discover via ToolSearch first.

- [ ] **Step 2: Write profiles list section**

For `/kc-sentry-insight profiles`:
1. Glob `${project}/.claude/insight/sentry/profiles/*.yaml`
2. For each profile, read and display: name, strategy, projects, last_scan timestamp, known issues count
3. Format as table

- [ ] **Step 3: Commit push flow and profiles list**

```bash
git add kc-sentry-insight/skills/kc-sentry-insight/SKILL.md
git commit -s -m "$(cat <<'EOF'
feat(kc-sentry-insight): add push flow and profiles list

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Validate with kc-plugin-forge

**Files:**
- Potentially modify: any file that fails validation

- [ ] **Step 1: Run plugin-forge validation**

Run forge from an existing Claude session where `kc-plugin-forge` is already loaded (e.g., the kc-claude-workspace session). This is NOT a separate `claude` launch — forge must be a loaded plugin.

```
/kc-plugin-forge /Users/kent/Project/kc-claude-workspace/kc-claude-plugins/kc-sentry-insight
```

This runs the full 4-phase forge pipeline:
- Phase 1: Structure validation (plugin.json, file layout, agent frontmatter)
- Phase 2: Skill TDD (pressure scenarios for SKILL.md)
- Phase 3: Agent verify (sentry-analyzer examples, tools, prompt)
- Phase 4: Re-validate + summary report

- [ ] **Step 2: Fix any FAIL items from Phase 1**

Common fixes: missing fields in plugin.json, agent frontmatter issues, file naming.

- [ ] **Step 3: Complete Skill TDD (Phase 2)**

Follow forge's RED/GREEN/REFACTOR cycle for the skill. Expected pressure scenarios:
1. Profile doesn't exist → bootstrap triggers correctly
2. Sentry MCP tools unavailable → graceful degradation
3. All issues are noise → empty report with noise proposals
4. Push with no report → error message

- [ ] **Step 4: Complete Agent Verify (Phase 3)**

Verify sentry-analyzer:
- Examples cover both strategies + graceful degradation
- Tools list is correct
- System prompt references `${CLAUDE_PLUGIN_ROOT}/reference/analysis-guide.md`
- Output contract matches spec YAML format

- [ ] **Step 5: Address Phase 4 findings and commit fixes**

```bash
git add -A kc-sentry-insight/
git commit -s -m "$(cat <<'EOF'
fix(kc-sentry-insight): address forge validation findings

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: End-to-End Smoke Test

- [ ] **Step 1: Load the plugin and test profile bootstrap**

From the Recce repo (which has Sentry DSN). The plugin must be registered (marketplace.json + enabledPlugins) OR launched with `--plugin-dir`:

```bash
# Option A: register in marketplace.json + enabledPlugins, then start new session
# Option B: quick test with --plugin-dir
claude --plugin-dir /Users/kent/Project/kc-claude-workspace/kc-claude-plugins/kc-sentry-insight
```

Run: `/kc-sentry-insight mcp`

Verify:
- Bootstrap detects `recce/event/SENTRY_DNS`
- Strategy inferred as `structured` (MCP SDK present)
- Profile written to `.claude/insight/sentry/profiles/mcp.yaml`

- [ ] **Step 2: Test scan flow**

After profile exists, run: `/kc-sentry-insight mcp`

Verify:
- Agent dispatched and returns YAML
- Diff classification works (all issues should be NEW on first scan)
- Report written to `.claude/insight/sentry/reports/mcp/YYYY-MM-DD.md`
- Profile `last_scan` updated
- Iteration proposals shown (if applicable)

- [ ] **Step 3: Test push flow**

Run: `/kc-sentry-insight push mcp --issues 1`

Verify:
- Report parsed correctly
- Linear team/labels prompted on first push
- Issue created in Linear with correct format
- Report footer updated
- Profile `issue_history[].last_pushed` updated

- [ ] **Step 4: Test profiles list**

Run: `/kc-sentry-insight profiles`

Verify: table shows mcp profile with correct data.

- [ ] **Step 5: Commit any smoke test fixes**

```bash
git add -A kc-sentry-insight/
git commit -s -m "$(cat <<'EOF'
fix(kc-sentry-insight): address smoke test findings

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```
