# DRC-3033: `create_check` MCP Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `create_check` MCP tool that lets the AI agent persist analysis findings as Recce Check objects with verifiable Run evidence.

**Architecture:** Single new handler method `_tool_create_check` in `RecceMCPServer`, following the exact same pattern as `_tool_list_checks` and `_tool_run_check`. Idempotent upsert by `(type, params)` match. Auto-submits a Run for evidence on non-metadata types. Calls `export_persistent_state` to sync to cloud/disk.

**Tech Stack:** Python 3.9+, FastAPI, MCP SDK, pytest + pytest-asyncio, DuckDB (E2E tests)

**Spec:** `docs/superpowers/specs/2026-03-20-drc-3033-create-check-mcp-design.md`

---

## File Map

| File | Role |
|------|------|
| `recce/mcp_server.py` | **Modify:** Add Tool definition in `list_tools`, dispatcher in `call_tool`, handler `_tool_create_check` |
| `tests/test_mcp_server.py` | **Modify:** Add 8 unit tests (mock-based) |
| `tests/test_mcp_e2e.py` | **Modify:** Add 3 E2E tests (real DuckDB) |

No new files. No DB migration. No changes to `check_func.py`, `CheckDAO`, or `run_func.py`.

---

## Task 1: Tool Registration — `list_tools` + `call_tool` + blocked set

**Files:**
- Modify: `recce/mcp_server.py:648-670` (list_tools, server-mode tools block)
- Modify: `recce/mcp_server.py:692-703` (blocked_tools_in_non_server set)
- Modify: `recce/mcp_server.py:739-744` (call_tool elif chain)

- [ ] **Step 1: Write failing test — `create_check` appears in `list_tools`**

In `tests/test_mcp_server.py`, add inside `TestMCPServerModes` (which already tests tool visibility):

```python
@pytest.mark.asyncio
async def test_create_check_in_server_mode_tools(self):
    """create_check tool is available in server mode."""
    mock_context = MagicMock(spec=RecceContext)
    server = RecceMCPServer(mock_context, mode=RecceServerMode.server)
    tools = await server.server.list_tools()
    tool_names = [t.name for t in tools]
    assert "create_check" in tool_names
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_mcp_server.py::TestMCPServerModes::test_create_check_in_server_mode_tools -v`
Expected: FAIL — `"create_check" not in tool_names`

- [ ] **Step 3: Write failing test — `create_check` blocked in non-server mode**

Use `TestCallToolHandler._invoke_call_tool` helper (same pattern as `test_non_server_mode_blocks_new_diff_tools`):

```python
@pytest.mark.asyncio
async def test_create_check_blocked_in_non_server_mode(self):
    """create_check is blocked in preview/read-only mode."""
    mock_context = MagicMock(spec=RecceContext)
    server = RecceMCPServer(mock_context, mode=RecceServerMode.preview)
    r = await TestCallToolHandler._invoke_call_tool(
        server, "create_check",
        {"type": "row_count_diff", "params": {}, "name": "test"},
    )
    assert r.root.isError is True
```

- [ ] **Step 4: Run test to verify it fails**

Run: `python -m pytest tests/test_mcp_server.py::TestMCPServerModes::test_create_check_blocked_in_non_server_mode -v`
Expected: FAIL — `Unknown tool: create_check` (not the mode-blocking error)

- [ ] **Step 5: Add `create_check` Tool definition in `list_tools`**

In `recce/mcp_server.py`, inside the `if self.mode == RecceServerMode.server:` block (after `run_check` Tool), add:

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
                    "top_k_diff", "histogram_diff",
                ],
                "description": "The check type (must match a diff tool type)",
            },
            "params": {
                "type": "object",
                "description": "Parameters for the check (same format as the corresponding diff tool)",
            },
            "name": {
                "type": "string",
                "description": "Human-readable check name (e.g., 'Row Count Diff of orders')",
            },
            "description": {
                "type": "string",
                "description": "Analysis summary explaining what was found and why it matters",
            },
        },
        "required": ["type", "params", "name"],
    },
),
```

- [ ] **Step 6: Add `"create_check"` to `blocked_tools_in_non_server` set**

In `call_tool`, add `"create_check"` to the set:

```python
blocked_tools_in_non_server = {
    "row_count_diff",
    "query",
    "query_diff",
    "profile_diff",
    "value_diff",
    "value_diff_detail",
    "top_k_diff",
    "histogram_diff",
    "list_checks",
    "run_check",
    "create_check",  # NEW
}
```

Also update the error message string to include `create_check`, or better: generate the allowed tools list dynamically.

- [ ] **Step 7: Add dispatcher in `call_tool` elif chain**

After the `elif name == "run_check":` block, add:

```python
elif name == "create_check":
    result = await self._tool_create_check(arguments)
```

- [ ] **Step 8: Add stub handler that raises NotImplementedError**

```python
async def _tool_create_check(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Create a persistent check from analysis findings."""
    raise NotImplementedError("create_check handler not yet implemented")
```

- [ ] **Step 9: Run registration tests to verify they pass**

Run: `python -m pytest tests/test_mcp_server.py::TestMCPServerModes::test_create_check_in_server_mode_tools tests/test_mcp_server.py::TestMCPServerModes::test_create_check_blocked_in_non_server_mode -v`
Expected: PASS for tool listing, PASS for mode blocking

- [ ] **Step 10: Commit**

```bash
git add recce/mcp_server.py tests/test_mcp_server.py
git commit -s -m "feat(mcp): register create_check tool with stub handler"
```

---

## Task 2: Handler — Create New Check (happy path)

**Files:**
- Modify: `recce/mcp_server.py` (`_tool_create_check` method)
- Modify: `tests/test_mcp_server.py`

- [ ] **Step 1: Write failing test — basic check creation**

```python
@pytest.mark.asyncio
async def test_tool_create_check_basic(self, mcp_server):
    """create_check creates a new check and auto-runs it."""
    server, _ = mcp_server
    from unittest.mock import AsyncMock
    from uuid import uuid4

    from recce.models.types import Check, RunStatus, RunType

    check_id = uuid4()
    mock_check = MagicMock(spec=Check)
    mock_check.check_id = check_id

    mock_run = MagicMock()
    mock_run.status = RunStatus.FINISHED
    mock_run.error = None

    mock_check_dao = MagicMock()
    mock_check_dao.list.return_value = []  # No existing checks

    with patch("recce.models.CheckDAO", return_value=mock_check_dao), \
         patch("recce.apis.check_func.create_check_without_run", return_value=mock_check) as mock_create, \
         patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))) as mock_submit, \
         patch("recce.apis.check_func.export_persistent_state"):

        result = await server._tool_create_check({
            "type": "row_count_diff",
            "params": {"node_names": ["orders"]},
            "name": "Row Count Diff of orders",
            "description": "15% increase",
        })

    assert result["check_id"] == str(check_id)
    assert result["created"] is True
    assert result["run_executed"] is True
    assert "run_error" not in result
    mock_create.assert_called_once()
    mock_submit.assert_called_once_with(
        RunType.ROW_COUNT_DIFF,
        params={"node_names": ["orders"]},
        check_id=check_id,
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_mcp_server.py::TestRecceMCPServer::test_tool_create_check_basic -v`
Expected: FAIL — `NotImplementedError`

- [ ] **Step 3: Implement `_tool_create_check` handler**

Replace the stub in `recce/mcp_server.py`:

```python
async def _tool_create_check(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Create a persistent check from analysis findings."""
    from recce.apis.check_api import PatchCheckIn
    from recce.apis.check_func import create_check_without_run, export_persistent_state
    from recce.apis.run_func import submit_run
    from recce.models import CheckDAO
    from recce.models.types import RunStatus, RunType

    check_type = RunType(arguments["type"])
    params = arguments.get("params", {})
    name = arguments["name"]
    description = arguments.get("description", "")

    # Idempotency: find existing check with same (type, params)
    # dict == handles key-order invariance but not type coercion after
    # JSON round-trip. Acceptable because agent constructs params
    # consistently within a single session.
    existing_checks = CheckDAO().list()
    existing = None
    for c in existing_checks:
        if c.type == check_type and c.params == params:
            existing = c
            break

    if existing:
        patch = PatchCheckIn(name=name, description=description)
        CheckDAO().update_check_by_id(existing.check_id, patch)
        check_id = existing.check_id
        created = False
    else:
        check = create_check_without_run(
            check_name=name,
            check_description=description,
            check_type=check_type,
            params=params,
            check_view_options={},
        )
        check_id = check.check_id
        created = True

    # Auto-run for evidence. Skip for metadata-only types
    # (schema_diff/lineage_diff read from manifest, no DB query —
    # consistent with how _tool_run_check handles these types).
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

    # Persist state to cloud/disk (matches REST endpoint pattern)
    await asyncio.get_event_loop().run_in_executor(None, export_persistent_state)

    result = {
        "check_id": str(check_id),
        "created": created,
        "run_executed": run_executed,
    }
    if run_error:
        result["run_error"] = run_error
    return result
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_mcp_server.py::TestRecceMCPServer::test_tool_create_check_basic -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add recce/mcp_server.py tests/test_mcp_server.py
git commit -s -m "feat(mcp): implement create_check handler — create + auto-run"
```

---

## Task 3: Handler — Idempotent Update Path

**Files:**
- Modify: `tests/test_mcp_server.py`

- [ ] **Step 1: Write failing test — idempotent update**

```python
@pytest.mark.asyncio
async def test_tool_create_check_idempotent_update(self, mcp_server):
    """create_check with same (type, params) updates instead of creating."""
    server, _ = mcp_server
    from uuid import uuid4

    from recce.models.types import RunStatus, RunType

    check_id = uuid4()
    existing_check = MagicMock()
    existing_check.check_id = check_id
    existing_check.type = RunType.ROW_COUNT_DIFF
    existing_check.params = {"node_names": ["orders"]}
    existing_check.is_checked = True  # Already approved

    mock_run = MagicMock()
    mock_run.status = RunStatus.FINISHED
    mock_run.error = None

    mock_check_dao = MagicMock()
    mock_check_dao.list.return_value = [existing_check]

    with patch("recce.models.CheckDAO", return_value=mock_check_dao), \
         patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))), \
         patch("recce.apis.check_func.export_persistent_state"):

        result = await server._tool_create_check({
            "type": "row_count_diff",
            "params": {"node_names": ["orders"]},
            "name": "Updated name",
            "description": "Updated description",
        })

    assert result["check_id"] == str(check_id)
    assert result["created"] is False
    # Verify update was called with PatchCheckIn (name + description only)
    mock_check_dao.update_check_by_id.assert_called_once()
    call_args = mock_check_dao.update_check_by_id.call_args
    assert call_args[0][0] == check_id  # check_id
    patch_in = call_args[0][1]
    assert patch_in.name == "Updated name"
    assert patch_in.description == "Updated description"
    assert patch_in.is_checked is None  # Not touching approval
```

- [ ] **Step 2: Run test to verify it passes** (should already work from Task 2 impl)

Run: `python -m pytest tests/test_mcp_server.py::TestRecceMCPServer::test_tool_create_check_idempotent_update -v`
Expected: PASS

- [ ] **Step 3: Write test — schema_diff skips Run**

```python
@pytest.mark.asyncio
async def test_tool_create_check_skips_run_for_schema_diff(self, mcp_server):
    """create_check with schema_diff type does not submit a run."""
    server, _ = mcp_server

    mock_check = MagicMock()
    mock_check.check_id = MagicMock()

    mock_check_dao = MagicMock()
    mock_check_dao.list.return_value = []

    with patch("recce.models.CheckDAO", return_value=mock_check_dao), \
         patch("recce.apis.check_func.create_check_without_run", return_value=mock_check), \
         patch("recce.apis.run_func.submit_run") as mock_submit, \
         patch("recce.apis.check_func.export_persistent_state"):

        result = await server._tool_create_check({
            "type": "schema_diff",
            "params": {"node_id": "model.proj.customers"},
            "name": "Schema Diff of customers",
        })

    assert result["run_executed"] is False
    mock_submit.assert_not_called()
```

- [ ] **Step 4: Run test**

Run: `python -m pytest tests/test_mcp_server.py::TestRecceMCPServer::test_tool_create_check_skips_run_for_schema_diff -v`
Expected: PASS

- [ ] **Step 5: Write test — Run failure returns `run_error`**

```python
@pytest.mark.asyncio
async def test_tool_create_check_run_failure(self, mcp_server):
    """create_check returns run_error when the auto-run fails."""
    server, _ = mcp_server

    mock_check = MagicMock()
    mock_check.check_id = MagicMock()

    from recce.models.types import RunStatus

    mock_run = MagicMock()
    mock_run.status = RunStatus.FAILED
    mock_run.error = "Table not found: orders"

    mock_check_dao = MagicMock()
    mock_check_dao.list.return_value = []

    with patch("recce.models.CheckDAO", return_value=mock_check_dao), \
         patch("recce.apis.check_func.create_check_without_run", return_value=mock_check), \
         patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))), \
         patch("recce.apis.check_func.export_persistent_state"):

        result = await server._tool_create_check({
            "type": "row_count_diff",
            "params": {"node_names": ["orders"]},
            "name": "Row Count Diff of orders",
        })

    assert result["run_executed"] is False
    assert result["run_error"] == "Table not found: orders"
```

- [ ] **Step 6: Run test**

Run: `python -m pytest tests/test_mcp_server.py::TestRecceMCPServer::test_tool_create_check_run_failure -v`
Expected: PASS

- [ ] **Step 7: Write test — idempotent update + run failure combined**

```python
@pytest.mark.asyncio
async def test_tool_create_check_idempotent_update_with_run_failure(self, mcp_server):
    """Idempotent update path also reports run_error when re-run fails."""
    server, _ = mcp_server
    from uuid import uuid4

    from recce.models.types import RunStatus, RunType

    check_id = uuid4()
    existing_check = MagicMock()
    existing_check.check_id = check_id
    existing_check.type = RunType.ROW_COUNT_DIFF
    existing_check.params = {"node_names": ["orders"]}

    mock_run = MagicMock()
    mock_run.status = RunStatus.FAILED
    mock_run.error = "Permission denied"

    mock_check_dao = MagicMock()
    mock_check_dao.list.return_value = [existing_check]

    with patch("recce.models.CheckDAO", return_value=mock_check_dao), \
         patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))), \
         patch("recce.apis.check_func.export_persistent_state"):

        result = await server._tool_create_check({
            "type": "row_count_diff",
            "params": {"node_names": ["orders"]},
            "name": "Updated name",
        })

    assert result["created"] is False
    assert result["run_executed"] is False
    assert result["run_error"] == "Permission denied"
```

- [ ] **Step 8: Run test**

Run: `python -m pytest tests/test_mcp_server.py::TestRecceMCPServer::test_tool_create_check_idempotent_update_with_run_failure -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add tests/test_mcp_server.py
git commit -s -m "test(mcp): add create_check idempotency, skip-run, and failure tests"
```

---

## Task 4: Dispatcher Integration Tests

**Files:**
- Modify: `tests/test_mcp_server.py`

- [ ] **Step 1: Write test — `create_check` dispatches via `call_tool`**

Add to the `test_new_tools_dispatch_via_call_tool` method (or create a new test alongside it):

```python
@pytest.mark.asyncio
async def test_create_check_dispatches_via_call_tool(self, mcp_server):
    """create_check dispatches correctly through call_tool handler."""
    server, mock_context = mcp_server

    mock_check = MagicMock()
    mock_check.check_id = MagicMock()

    from recce.models.types import RunStatus

    mock_run = MagicMock()
    mock_run.status = RunStatus.FINISHED
    mock_run.error = None

    mock_check_dao = MagicMock()
    mock_check_dao.list.return_value = []

    with patch("recce.models.CheckDAO", return_value=mock_check_dao), \
         patch("recce.apis.check_func.create_check_without_run", return_value=mock_check), \
         patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))), \
         patch("recce.apis.check_func.export_persistent_state"):

        r = await self._invoke_call_tool(server, "create_check", {
            "type": "row_count_diff",
            "params": {"node_names": ["m"]},
            "name": "test",
        })
    assert r.root.isError is not True
```

- [ ] **Step 2: Run test**

Run: `python -m pytest tests/test_mcp_server.py -k "test_create_check_dispatches" -v`
Expected: PASS

- [ ] **Step 3: Update `test_list_tools_returns_all_server_mode_tools` expected tool set**

In `tests/test_mcp_e2e.py`, the protocol test `test_list_tools_returns_all_server_mode_tools` checks an exact set of expected tool names. Add `"create_check"` to the `expected` set. The test uses set equality (`expected == tool_names`), not a count.

- [ ] **Step 4: Run all existing MCP tests to verify no regressions**

Run: `python -m pytest tests/test_mcp_server.py tests/test_mcp_e2e.py -v --timeout=60`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_mcp_server.py tests/test_mcp_e2e.py
git commit -s -m "test(mcp): add create_check dispatcher test, update tool count"
```

---

## Task 5: E2E Tests with Real DuckDB

**Files:**
- Modify: `tests/test_mcp_e2e.py`

- [ ] **Step 1: Write E2E test — create row_count_diff check**

Add a new test class after the existing `TestRunCheckE2E`:

```python
class TestCreateCheckE2E:
    """Layer 1: create_check with real DuckDB."""

    @pytest.mark.asyncio
    async def test_create_check_row_count_diff(self, mcp_e2e_with_data):
        """create_check creates a check with a linked run."""
        from recce.models import CheckDAO

        server, _ = mcp_e2e_with_data
        result = await server._tool_create_check({
            "type": "row_count_diff",
            "params": {"node_names": ["customers"]},
            "name": "Row Count Diff of customers",
            "description": "Checking row count changes",
        })

        assert result["created"] is True
        assert result["run_executed"] is True
        assert "run_error" not in result

        # Verify check appears in list_checks
        checks_result = await server._tool_list_checks({})
        assert checks_result["total"] == 1
        assert checks_result["checks"][0]["name"] == "Row Count Diff of customers"
        assert checks_result["checks"][0]["check_id"] == result["check_id"]
```

- [ ] **Step 2: Run test**

Run: `python -m pytest tests/test_mcp_e2e.py::TestCreateCheckE2E::test_create_check_row_count_diff -v`
Expected: PASS

- [ ] **Step 3: Write E2E test — idempotent (no duplicates)**

```python
    @pytest.mark.asyncio
    async def test_create_check_idempotent(self, mcp_e2e_with_data):
        """Calling create_check twice with same (type, params) does not duplicate."""
        server, _ = mcp_e2e_with_data

        await server._tool_create_check({
            "type": "row_count_diff",
            "params": {"node_names": ["customers"]},
            "name": "First name",
            "description": "First description",
        })
        result2 = await server._tool_create_check({
            "type": "row_count_diff",
            "params": {"node_names": ["customers"]},
            "name": "Updated name",
            "description": "Updated description",
        })

        assert result2["created"] is False

        checks_result = await server._tool_list_checks({})
        assert checks_result["total"] == 1
        assert checks_result["checks"][0]["name"] == "Updated name"
```

- [ ] **Step 4: Run test**

Run: `python -m pytest tests/test_mcp_e2e.py::TestCreateCheckE2E::test_create_check_idempotent -v`
Expected: PASS

- [ ] **Step 5: Write E2E test — created check is re-runnable**

```python
    @pytest.mark.asyncio
    async def test_create_check_then_run_check(self, mcp_e2e_with_data):
        """A check created via create_check can be re-run via run_check."""
        server, _ = mcp_e2e_with_data

        create_result = await server._tool_create_check({
            "type": "row_count_diff",
            "params": {"node_names": ["customers"]},
            "name": "Row Count Check",
        })
        check_id = create_result["check_id"]

        run_result = await server._tool_run_check({"check_id": check_id})
        assert "run_id" in run_result
        assert run_result["type"] == "row_count_diff"
```

- [ ] **Step 6: Run all E2E tests**

Run: `python -m pytest tests/test_mcp_e2e.py -v --timeout=60`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add tests/test_mcp_e2e.py
git commit -s -m "test(mcp): add create_check E2E tests with real DuckDB"
```

---

## Task 6: Final Verification

**Files:** None (read-only)

- [ ] **Step 1: Run full MCP test suite**

Run: `python -m pytest tests/test_mcp_server.py tests/test_mcp_e2e.py tests/test_cli_mcp_optional.py -v --timeout=60`
Expected: All PASS

- [ ] **Step 2: Run linting**

Run: `make format && make flake8`
Expected: Clean

- [ ] **Step 3: Run full test suite to check for regressions**

Run: `python -m pytest tests/ -v --timeout=120 -x`
Expected: PASS (pre-existing SPA failures are known, ignore those)

- [ ] **Step 4: Verify tool count in MCP protocol E2E test**

Check that `test_list_tools_returns_all_server_mode_tools` passes with the updated count.

- [ ] **Step 5: Commit any lint/format fixes**

```bash
git add -u
git commit -s -m "style: format create_check handler"
```
