# DRC-3033: Agent Creates Persistent Checks via MCP — Design Spec

**Author:** KC + Claude
**Date:** 2026-03-20
**Status:** Draft
**Linear:** [DRC-3033](https://linear.app/recce/issue/DRC-3033)
**Notion Plan:** [Summary-to-Checks Pipeline](https://www.notion.so/infuseai/32879451d357801884dbf359a528e775)

---

## Problem

AI-generated PR summary includes suggested checks as markdown checkboxes. When CI reruns, the entire PR comment gets overwritten — completed items are lost. Users abandon the AI checklist and manually create Recce checklist items instead.

> "I prefer to go directly to the instance and check by myself and create the checklist items because I have the impression that part is kind of volatile." — Fabio Gutiyama, 205datalab

**Root cause:** Agent outputs flat markdown — suggestions are text, not Recce Check objects. `update_comment_with_summary()` does full `comment.edit()` replace. Agent has `list_checks` + `run_check` but no `create_check` MCP tool.

## Design Direction

The Recce `Checks` model already has persistence, approval workflow (`is_checked`, `approved_by`, `approved_at`), and AI actor support (`CheckEvents.actor_type=RECCE_AI`). Don't build a parallel persistence layer — extend the existing system with one new MCP tool.

### Architecture: Before and After

```
Current (broken):
  Agent runs tools → outputs markdown → posts to PR comment → CI overwrites → 💀

Target:
  Agent runs tools → creates Recce Check objects (via new MCP tool)
                           ↓
                     Persistent in DB (Checks model)
                     User approves in Recce UI
                           ↓
                     comment_builder reads Check status from DB
                     Renders checklist table in PR comment
                     CI rerun = re-render only, no state loss
```

## Design Decisions

### Timing: Post-Analysis Check Creation

Agent completes its full 6-step analysis workflow (lineage → list_checks → schema → row_count → profile → query), then selectively creates checks for significant findings. This is the "reviewer model" — agent curates what matters, not a mechanical test runner that records everything.

**Rationale:**
- Cross-referencing multiple findings produces richer check descriptions
- Agent can deduplicate against existing checks from `list_checks` (Step 2)
- Fewer, higher-quality checklist items (matches user expectation)
- Aligns with current agent prompt structure (analyze, then summarize)

### Evidence: Auto-Run on Check Creation

`create_check` MCP tool internally creates the Check AND submits a Run. This ensures every check has verifiable evidence — a linked Run with actual results that users can inspect and re-run.

**Why not `create_check_without_run`?** Without a Run, the agent's claims are unverifiable. Users like Fabio want to "check by myself" — they need to see actual data behind each checklist item. A Check without a Run is less trustworthy than a manually-created check.

**Re-run cost is acceptable:** The diff executes twice (once ad-hoc for agent analysis, once formally for evidence). In CI context this adds seconds of DB queries to a pipeline that takes minutes. The trade-off is simplicity — no changes to existing diff tool handlers.

### Idempotency

Same `(type, params)` in the same session → update name/description, preserve approval status. This ensures:
- No duplicate checklist items on CI re-run
- Approved checks stay approved when agent re-analyzes
- Agent can update descriptions with new findings without breaking user state

### Separation of Analysis and Rendering

Agent is responsible for analysis + creating checks (authoring). Comment builder is responsible for reading DB + rendering the checklist table (rendering). This separation is what makes CI re-run safe — the checklist table always reflects DB state, not agent output.

---

## Component Design

### 1. `create_check` MCP Tool (recce repo)

**File:** `recce/mcp_server.py`

#### Tool Definition

```python
Tool(
    name="create_check",
    description=(
        "Create a persistent checklist item from analysis findings. "
        "The check is saved to the session and a run is automatically executed "
        "to produce verifiable evidence. Use this after completing analysis "
        "to persist important findings as reviewable checklist items.\n\n"
        "Idempotent: if a check with the same (type, params) already exists "
        "in this session, its name and description are updated instead of "
        "creating a duplicate."
    ),
    inputSchema={
        "type": "object",
        "properties": {
            "type": {
                "type": "string",
                "enum": [
                    "row_count_diff", "schema_diff", "query_diff",
                    "profile_diff", "value_diff", "value_diff_detail",
                    "top_k_diff", "histogram_diff"
                ],
                "description": "The check type (must match a diff tool type)",
            },
            "params": {
                "type": "object",
                "description": "Parameters for the check (same as the corresponding diff tool)",
            },
            "name": {
                "type": "string",
                "description": "Human-readable check name",
            },
            "description": {
                "type": "string",
                "description": "Analysis summary explaining what was found and why it matters",
            },
        },
        "required": ["type", "params", "name"],
    },
)
```

#### Handler

```python
async def _tool_create_check(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
    from recce.apis.check_func import create_check_without_run, export_persistent_state
    from recce.apis.run_func import submit_run
    from recce.models import CheckDAO
    from recce.models.types import RunType, RunStatus
    from recce.apis.check_api import PatchCheckIn

    check_type = RunType(arguments["type"])
    params = arguments.get("params", {})
    name = arguments["name"]
    description = arguments.get("description", "")

    # Idempotency: find existing check with same (type, params)
    # Note: dict == handles key-order invariance but not type coercion
    # (e.g., 1 vs 1.0 after JSON round-trip). This is acceptable because
    # the agent constructs params consistently within a single session.
    existing_checks = CheckDAO().list()
    existing = None
    for c in existing_checks:
        if c.type == check_type and c.params == params:
            existing = c
            break

    if existing:
        # Update name/description, preserve approval status
        patch = PatchCheckIn(name=name, description=description)
        check = CheckDAO().update_check_by_id(existing.check_id, patch)
        check_id = existing.check_id
    else:
        # Create new check
        check = create_check_without_run(
            check_name=name,
            check_description=description,
            check_type=check_type,
            params=params,
            check_view_options={},
        )
        check_id = check.check_id

    # Auto-run for evidence
    # Skip for metadata-only types (schema_diff/lineage_diff read from manifest,
    # no DB query needed — consistent with how run_check handles these types).
    # Note: schema_diff checks have no linked Run. This is a known limitation;
    # their evidence is the manifest itself, not a DB query result.
    run_executed = False
    run_error = None
    if check_type not in (RunType.LINEAGE_DIFF, RunType.SCHEMA_DIFF):
        run, future = submit_run(check_type, params=params, check_id=check_id)
        await future
        # submit_run's future always resolves (errors caught internally).
        # Check run.status, not the return value, to determine success.
        run_executed = run.status == RunStatus.FINISHED
        if run.status == RunStatus.FAILED:
            run_error = run.error

    # Persist state to cloud/disk (matches REST endpoint pattern in check_api.py)
    await asyncio.get_event_loop().run_in_executor(None, export_persistent_state)

    result = {
        "check_id": str(check_id),
        "created": existing is None,
        "run_executed": run_executed,
    }
    if run_error:
        result["run_error"] = run_error
    return result
```

#### Registration Points

- `list_tools()`: Add to `if self.mode == RecceServerMode.server:` block
- `call_tool()`: Add `elif name == "create_check"` dispatch
- `blocked_tools_in_non_server`: Add `"create_check"`
- Error message in mode-blocking `raise ValueError(...)`: Update to dynamically list allowed tools from code instead of hardcoding (or add `create_check` to the hardcoded string)

### 2. Agent Prompt Changes (recce-cloud-infra)

**Files:**
- `recce_agent/src/recce/agent.ts` — `RECCE_TOOLS` constant
- `recce_agent/src/agents/pr_analyzer.ts` — workflow prompt

#### RECCE_TOOLS

```typescript
const RECCE_TOOLS = [
    'mcp__recce__lineage_diff',
    'mcp__recce__schema_diff',
    'mcp__recce__row_count_diff',
    'mcp__recce__query',
    'mcp__recce__query_diff',
    'mcp__recce__profile_diff',
    'mcp__recce__list_checks',
    'mcp__recce__run_check',
    'mcp__recce__create_check',    // NEW
];
```

#### Workflow: New Step 7

Appended after the existing 6-step analysis workflow:

```
Step 7 — Persist findings as Checklist Items

After completing analysis, create persistent checks for significant findings:
- Call `create_check` for each finding that a reviewer should verify
- Do NOT create checks for:
  - Expected changes (e.g., row count diff on incremental models with known growth)
  - Findings already covered by existing checks (from list_checks in Step 2)
  - Metadata-only observations with no data impact
- The check `description` should include your analysis, not just raw numbers
- Reference the check name in your summary text for attribution
```

#### Checklist Section Removal

The ☑️ Checklist section in `pr_analyzer.ts` (lines 184-200) currently renders a markdown table from `list_checks`. This is removed from agent output — checklist rendering moves to `comment_builder.py`.

Agent summary output changes to:

```markdown
## Summary
Based on the analysis, 3 checks have been created:
- **Row Count Diff of orders**: Row count increased by 15%...
- **Schema Diff of customers**: 2 new columns added...

See the checklist below for approval status.
```

### 3. Comment Builder Changes (recce-cloud-infra)

**Files:**
- `recce_instance_launcher/src/comment_builder.py`
- `recce_instance_launcher/src/recce_task_func.py`

#### New Method: `with_checks(checks)`

```python
def with_checks(self, checks: list[dict], instance_url: str = None) -> "RecceCommentBuilder":
    """Set checklist data from session checks.

    Args:
        checks: List of check dicts from list_checks API.
                Each has: check_id, name, type, is_checked, description
        instance_url: Recce instance URL for linking check names
    """
    self._checks = checks
    self._checks_instance_url = instance_url
    return self
```

#### Checklist Table Rendering

```python
def _build_checks_section(self) -> str:
    if not self._checks:
        return ""

    rows = []
    for check in self._checks:
        status = "✅" if check.get("is_checked") else "⏳"
        name = check["name"]
        # Basic instance link (upgraded to check-specific deep link in DRC-3034)
        if self._checks_instance_url:
            name = f"[{name}]({self._checks_instance_url})"
        check_type = check["type"].replace("_", " ").title()
        rows.append(f"| {name} | {check_type} | {status} |")

    header = "| Check | Type | Status |\n| --- | --- | --- |"
    table = header + "\n" + "\n".join(rows)
    return f"\n---\n\n### ☑️ Checklist\n\n{table}\n"
```

#### Caller Change in `recce_task_func.py`

```python
# After agent summary is generated:
checks = recce_api.list_checks(session_id)
builder.with_summary(agent_output).with_checks(checks, instance_url=instance_url)
comment_body = builder.build()
scm_handler.update_comment(comment_body)
```

#### `build()` Output Structure

```markdown
<!-- recce-cloud-comment:session_id=xyz -->
🔍 **Recce Instance Ready**
View your Recce instance: [URL](URL)

---

[Agent summary text — references check names, no inline table]

---

### ☑️ Checklist

| Check | Type | Status |
| --- | --- | --- |
| [Row Count Diff of orders](instance_url) | Row Count Diff | ⏳ |
| [Schema Diff of customers](instance_url) | Schema Diff | ✅ |

---

**Was this summary helpful?** [👍](up_url) [👎](down_url)
```

---

## Cross-Repo Change Summary

| Repo | File | Change |
|------|------|--------|
| `recce` | `recce/mcp_server.py` | Add `create_check` tool + handler |
| `recce` | `tests/test_mcp_server.py` | 9 unit tests |
| `recce` | `tests/test_mcp_e2e.py` | 3 E2E tests |
| `recce-cloud-infra` | `recce_agent/src/recce/agent.ts` | `RECCE_TOOLS` += `create_check` |
| `recce-cloud-infra` | `recce_agent/src/agents/pr_analyzer.ts` | Step 7 + remove checklist section |
| `recce-cloud-infra` | `src/comment_builder.py` | `with_checks()` + `_build_checks_section()` |
| `recce-cloud-infra` | `src/recce_task_func.py` | Read checks from DB, pass to builder |
| `recce-cloud-infra` | `tests/test_comment_builder_states.py` | 4 new tests |
| `recce-cloud-infra` | `tests/test_scm_comment_sync.py` | 2 new tests |

| `recce` | `tests/test_mcp_server.py` | +1 test: submit_run failure returns run_error |

**Files not changed:** `scm_handler.py` (still full replace), `check_func.py` (used as-is), `CheckDAO` (used as-is), DB schema (no migration).

## Dependency & Execution Order

```
1. recce repo: create_check MCP tool + tests     ← FIRST (blocks everything)
2. recce-cloud-infra: agent prompt changes        ← after MCP tool is available
3. recce-cloud-infra: comment_builder changes     ← parallel with #2
```

Step 1 can ship as its own PR. Steps 2+3 ship together in a second PR.

## What This Ticket Does NOT Cover

- **Check-specific deep links in table** → DRC-3034 (upgrades instance URL to `/check/{checkId}`)
- **Previous State column** → DRC-3034
- **Slash command approval** → DRC-3035 (Jared)
- **Summary text attribution with check IDs** → DRC-2619
- **Run history UI for AI checks** → DRC-2641
- **Frontend deep link routes** → DRC-2638 (Cycle 101)

## Success Criteria

- [ ] Agent creates Check objects via `create_check` MCP tool (not markdown)
- [ ] Each check has a linked Run with verifiable evidence
- [ ] PR comment checklist table renders from DB-persisted Checks
- [ ] CI rerun does not overwrite approved check status
- [ ] Idempotent: same check type + params in same session → update, not duplicate
- [ ] Check names in checklist table link to Recce instance URL

## Future Evolution (Approach 3)

If re-run cost becomes a concern, `create_check` can accept an optional `run_id` parameter to link existing Runs instead of re-executing. This requires diff tool handlers to optionally produce Run objects. Deferred as YAGNI — current re-run cost is negligible in CI context.
