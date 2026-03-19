# Design Spec: kc-sentry-insight

**Date:** 2026-03-19
**Status:** Reviewed
**Plugin repo:** `kc-claude-plugins/kc-sentry-insight`

## Problem

Sentry captures production errors for Recce (and other projects), but reviewing them is manual: open Sentry dashboard, filter, triage, decide what needs a Linear issue. For MCP server errors specifically, Sentry has native MCP monitoring (`span.op: mcp.server`) that provides per-tool error rates, latency, and silent JSON-RPC error capture — but this data isn't systematically reviewed or acted upon.

We need a Claude Code skill that automates the scan-classify-report-act cycle, accumulates domain knowledge over time via profile YAML, and optionally pushes actionable issues to Linear.

## Architecture

**Approach:** Single orchestrator skill + one sentry-analyzer agent.

```
/kc-sentry-insight <keyword>
  ├── skill: bootstrap, profile I/O, diff, report, Linear push, iteration proposals
  └── sentry-analyzer agent: Sentry MCP queries + classification (context-isolated)
```

**Why this split:**
- Sentry query results are large — agent isolates them from main context (validated pattern from kc-nightwatch)
- One agent is sufficient — query + classify is a single coherent task
- Skill retains orchestration control — profile management, diff logic, user interaction

## Plugin Structure

```
kc-sentry-insight/                    # in kc-claude-plugins repo
├── plugin.json
├── README.md
├── skills/
│   └── kc-sentry-insight/
│       └── SKILL.md                  # orchestrator skill
├── agents/
│   └── sentry-analyzer.md            # Sentry query + classification agent
└── reference/
    └── analysis-guide.md             # classification heuristics, Sentry query
                                      # examples, strategy-specific patterns.
                                      # Read by agent at runtime via
                                      # ${CLAUDE_PLUGIN_ROOT}/reference/
```

### Per-Project Data (created by skill at runtime)

```
${project}/.claude/insight/sentry/
├── profiles/
│   └── <keyword>.yaml                # config + scan state
└── reports/
    └── <keyword>/
        └── YYYY-MM-DD.md             # persisted reports
```

## Command Interface

| Command | Action |
|---------|--------|
| `/kc-sentry-insight <keyword>` | Scan + generate report (auto-bootstrap profile if needed) |
| `/kc-sentry-insight <keyword> --learn` | Scan + emphasize profile iteration proposals |
| `/kc-sentry-insight push <keyword> --issues 1,3,5` | Push selected issues from latest report to Linear |
| `/kc-sentry-insight push <keyword> --issues 1,3 --report 2026-03-18` | Push from a specific historical report |
| `/kc-sentry-insight profiles` | List all profiles for current project |

## Analysis Strategy

Profiles support two strategies, chosen once during bootstrap:

| Strategy | When | Query method |
|----------|------|-------------|
| **structured** | Sentry has native integration (e.g., MCP SDK) | `span.op` filter, per-tool metrics, session tracking |
| **keyword** | General scanning, no special integration | keyword-based `search_issues` (nightwatch pattern) |

The strategy is written into the profile YAML at bootstrap time. The sentry-analyzer agent receives the strategy and adapts its query approach accordingly, returning a unified output format regardless of strategy.

## Profile YAML Schema

```yaml
name: mcp                            # matches the <keyword>
strategy: structured                  # structured | keyword
created_at: 2026-03-19

sentry:
  org: datarecce
  projects:                           # supports monorepo (multiple DSNs)
    - slug: recce-python
      label: backend
      dsn_source: recce/event/SENTRY_DNS    # note: actual filename, not typo
    - slug: recce-frontend
      label: frontend
      dsn_source: js/sentry.config.ts       # illustrative — actual path may differ

  # structured strategy fields
  structured:
    span_op: "mcp.server"
    focus:
      - most_failing_tools
      - slowest_tools
      - silent_jsonrpc_errors
      - session_error_patterns

  # keyword strategy fields (used by other profiles)
  # keywords:
  #   primary: [checkout, payment]
  #   secondary: [cart, order]

linear:                                # Linear push defaults (v1: ask if missing)
  team_id: null                        # set on first push, reused after
  default_labels: []                   # e.g., ["Bug", "Sentry"]

noise_patterns:
  - pattern: "TimeoutError.*health_check"
    reason: "infrastructure noise"
    added: 2026-03-19

severity_overrides: []

last_scan:
  timestamp: null
  known_issue_ids: []
  report_path: null

# Per-issue tracking for iteration heuristics
issue_history: []
# Populated after scans. Each entry:
#   - sentry_id: "RECCE-A1B2"
#     seen_count: 3            # how many consecutive scans this appeared in
#     first_scan: 2026-03-05   # first scan where this was observed
#     last_pushed: null        # date when pushed to Linear, or null
```

## Core Flows

### Flow 1: Scan

```
/kc-sentry-insight <keyword>
    │
    ├─ [1. Profile Resolution]
    │   ├─ profiles/<keyword>.yaml exists? → load
    │   └─ doesn't exist → Bootstrap Flow (see below)
    │
    ├─ [2. Dispatch sentry-analyzer agent]
    │   ├─ input: profile config (strategy, span_op/keywords, noise_patterns, projects)
    │   ├─ agent: executes Sentry MCP queries per strategy
    │   ├─ output: structured analysis results (issues + metrics)
    │   └─ context isolation: raw Sentry data stays in agent
    │
    ├─ [3. Diff & Classify]
    │   ├─ compare against profile.last_scan.known_issue_ids
    │   ├─ compare against agent's noise_filtered_ids (see agent output)
    │   ├─ label each issue (using agent's events_trend field):
    │   │   NEW       = sentry_id NOT in known_issue_ids
    │   │   WORSENED  = in known_issue_ids AND events_trend > +50%
    │   │   RECURRING = in known_issue_ids AND (events_trend <= +50%
    │   │               OR events_trend is null — including decreases)
    │   │   RESOLVED  = in known_issue_ids AND NOT in agent issues
    │   │               AND NOT in agent noise_filtered_ids
    │   │   (if in noise_filtered_ids → skip, don't label RESOLVED)
    │   │   (if events_trend null → default to RECURRING, not WORSENED)
    │   └─ sort: NEW + WORSENED first
    │
    ├─ [4. Generate Report]
    │   ├─ write to .claude/insight/sentry/reports/<keyword>/YYYY-MM-DD.md
    │   ├─ each issue numbered (#1, #2, ...) for push reference
    │   ├─ multi-project issues labeled with source ([backend], [frontend])
    │   └─ display summary to user
    │
    ├─ [5. Profile Iteration Proposals] (always; more aggressive with --learn)
    │   ├─ "These 3 patterns look like noise — add to profile?"
    │   ├─ "New tool name detected in errors — add to focus?"
    │   └─ user confirms → update profile YAML
    │
    └─ [6. Update Scan State]
        ├─ update last_scan.timestamp
        ├─ update last_scan.known_issue_ids
        ├─ update last_scan.report_path
        └─ update issue_history:
            ├─ for each issue in agent output:
            │   ├─ existing entry → increment seen_count
            │   └─ new entry → append {sentry_id, seen_count: 1, first_scan: today}
            └─ entries not in agent output AND not in noise_filtered_ids → leave as-is
                (resolved issues keep their history for reference)
```

### Flow 2: Bootstrap

Triggered when profile doesn't exist for the given keyword.

```
1. Scan repo for Sentry config
   ├─ Find DSN by content pattern: match URLs like https://...@o\d+.ingest.sentry.io/...
   │   (note: filenames vary — e.g., Recce uses SENTRY_DNS not SENTRY_DSN)
   ├─ Find all sentry_sdk.init() / Sentry.init() calls → extract DSN → parse org
   ├─ Find nightwatch config → extract sentry_project
   └─ Aggregate into candidate list

2. If multiple DSNs / projects detected (monorepo)
   > Detected 2 Sentry configurations:
   > 1. recce-python (from recce/event/SENTRY_DNS) — backend
   > 2. recce-frontend (from js/sentry.config.ts) — frontend
   > Which to analyze? (multi-select, each becomes a sub-entry in profile)

3. Infer strategy
   ├─ keyword == "mcp" + MCP SDK dependency detected → propose structured
   ├─ sentry MCP integration import found → propose structured
   └─ otherwise → default keyword

4. Present inferences for user confirmation
   > Detected:
   > - Sentry org: datarecce (from DSN)
   > - Sentry project: recce-python (from nightwatch config)
   > - Strategy: structured (MCP SDK detected)
   >
   > Confirm? Anything to adjust?

5. User confirms → write profile YAML
   Inference insufficient → ask for missing fields one at a time
```

### Flow 3: Push to Linear

```
/kc-sentry-insight push <keyword> --issues 1,3,5 [--report YYYY-MM-DD]
    │
    ├─ Load profile
    ├─ Resolve report:
    │   ├─ --report flag → load reports/<keyword>/YYYY-MM-DD.md
    │   └─ no flag → load last_scan.report_path (latest)
    ├─ Parse report for #1, #3, #5 issue data
    ├─ Resolve Linear target:
    │   ├─ profile.linear.team_id set? → use it
    │   └─ not set? → ask user, save to profile for reuse
    ├─ For each issue → build Linear issue
    │   ├─ title: structured → [Sentry] <tool_name> — <error summary>
    │   │          keyword  → [Sentry] <error summary>
    │   ├─ description: Sentry link, stack trace, impact, delta status
    │   ├─ labels: profile.linear.default_labels (or ask if empty)
    │   └─ confirm before creating each issue
    ├─ Update report: mark pushed issues
    └─ Update profile: issue_history[].last_pushed for pushed items
```

## sentry-analyzer Agent

### Input

Receives from skill:
- `strategy`: structured | keyword
- `sentry_org`: organization slug
- `projects`: list of {slug, label}
- `structured` or `keywords` config (depending on strategy)
- `noise_patterns`: patterns to exclude
- `known_issue_ids`: for diff context

### Behavior by Strategy

| Strategy | Agent behavior |
|----------|---------------|
| **structured** | `search_events` with `span.op: mcp.server` → per-tool error rates → `get_issue_details` for top failing → structured result |
| **keyword** | `search_issues` with keywords → `get_issue_details` for top N → classify → structured result (nightwatch sentry-scanner pattern) |

### Output

Fixed format regardless of strategy:

```yaml
scanned_at: <ISO 8601>
projects_scanned:
  - slug: recce-python
    label: backend
    queries_run: 3
issues:
  - sentry_id: "RECCE-A1B2"
    project: recce-python
    title: "_tool_row_count — PermissionDenied on BigQuery dataset"
    tool: row_count_diff           # structured: tool name; keyword: null
    first_seen: 2026-03-15
    last_seen: 2026-03-19
    events_7d: 47
    events_prior_7d: 25            # events in days 8-14 (null if unavailable)
    events_trend: "+88%"           # = (events_7d - events_prior_7d) / events_prior_7d
                                   # null if events_prior_7d unavailable or first scan
    status: unresolved
    stack_summary: "recce/mcp_server.py:432 → _query_row_count → Forbidden"
    error_type: permission_denied
    impact_hint: "Users with restricted BQ roles"
noise_filtered_ids: ["RECCE-X1Y2"]  # issues matched by noise_patterns, excluded
                                     # from issues list — skill uses this to avoid
                                     # misclassifying as RESOLVED
```

## Profile Iteration (Semi-Automatic)

After each scan, the skill checks:

| Detection | Proposal |
|-----------|----------|
| Error in `issue_history` with `seen_count >= 2` and `last_pushed: null` | "Add to noise_patterns?" |
| New tool name appears in errors (structured) | "Add to structured.focus?" |
| known_issue resolved for 3+ consecutive scans | "Remove from known_issue_ids?" |
| `--learn` flag | All of the above with lowered thresholds (`seen_count >= 1`), PLUS: agent runs additional queries to analyze overall error distribution, skill suggests keyword/focus adjustments based on distribution |

User confirms each proposal individually → skill updates profile YAML.

## Report Format

```markdown
# Sentry Insight: <keyword> — YYYY-MM-DD

**Strategy:** structured (span.op: mcp.server) | keyword
**Projects:** recce-python (backend) | **Org:** datarecce
**Scan period:** YYYY-MM-DD → YYYY-MM-DD (vs last scan: YYYY-MM-DD)

## Summary
- N new issues
- N worsened
- N recurring (stable)
- N resolved since last scan

## Issues

### #1 [NEW] `_tool_row_count` — PermissionDenied on BigQuery dataset
- **Sentry ID:** RECCE-A1B2
- **Project:** recce-python [backend]
- **First seen:** 2026-03-15
- **Events (7d):** 47
- **Tool:** row_count_diff (structured strategy only — omit for keyword)
- **Impact:** Users with restricted BQ roles hit this on every row count check
- **Stack:** `recce/mcp_server.py:432` → `_query_row_count` → `Forbidden`

(... more issues ...)

---
**Pushed to Linear:** (none yet)
```

## Linear Issue Template

```markdown
Title: [Sentry] _tool_row_count — PermissionDenied on BigQuery dataset

## Source
- Sentry Issue: RECCE-A1B2 (link)
- First seen: 2026-03-15
- Events (7d): 47
- Delta: NEW

## Impact
Users with restricted BQ roles hit this on every row count check.

## Stack Trace
`recce/mcp_server.py:432` → `_query_row_count` → `Forbidden`

## Context
Detected by `/kc-sentry-insight mcp` scan on 2026-03-19.
Tool: row_count_diff | Strategy: structured (span.op: mcp.server)
(Tool line omitted for keyword strategy)

## Suggested Action
(skill provides initial suggestion based on error type)
```

## Implementation Notes

- **Agent model:** sonnet (fast, sufficient for structured queries)
- **Agent tools:** Read, mcp__claude_ai_Sentry__search_issues, mcp__claude_ai_Sentry__get_issue_details, mcp__claude_ai_Sentry__search_events, mcp__claude_ai_Sentry__find_projects
- **Linear tools (skill-level):** mcp__claude_ai_Linear__save_issue, mcp__claude_ai_Linear__list_issue_labels
- **Graceful degradation:** If Sentry MCP tools unavailable, report with warning (no error). If Linear MCP tools unavailable, skip push with warning.
- **Build with kc-plugin-forge:** Use `/kc-plugin-forge new kc-sentry-insight` to scaffold, then implement through the forge pipeline.

## Open Questions (for post-v1 iteration)

1. ~~Linear project/team targeting~~ — Resolved: ask on first push, save to `profile.linear.team_id` for reuse.
2. Report retention — keep all reports or prune after N days?
3. Cross-profile analysis — compare errors across keywords (e.g., mcp vs api)?
