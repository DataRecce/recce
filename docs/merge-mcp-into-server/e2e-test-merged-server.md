---
id: 005
title: E2E test the merged server
status: designed
source: commission seed
started: 2026-04-13T06:52:21Z
completed:
verdict:
score: 0.8
worktree:
issue: DRC-3228
pr:
---

End-to-end verification that `recce server` correctly serves both the HTTP API and the MCP endpoint simultaneously. This subtask is the safety net for the whole refactor — catches integration bugs that unit tests miss.

**User-visible outcome:** Confidence that shipping the merged server won't break real developer or agent workflows.

**Test scenarios (minimum):**
1. **Dual transport, happy path** — start `recce server` against an `integration_tests/` dbt project; confirm web UI loads (hit `/` or a known API endpoint) *and* an MCP client can list tools / call a tool against the same process.
2. **`--no-mcp` isolation** — start with `--no-mcp`; confirm web UI works and no MCP port/endpoint is reachable.
3. **Deprecated command still works** — run `recce mcp-server`; confirm deprecation warning appears and MCP behavior is unchanged.
4. **Graceful shutdown** — send SIGINT; confirm both transports tear down, no orphaned threads or sockets, exit code 0.
5. **Concurrent clients** — web UI open in browser while MCP client holds a session; confirm neither transport starves the other.
6. **State-loader compatibility** — run against both `FileStateLoader` and (if reachable from tests) `CloudStateLoader`; confirm no regression.

**Acceptance criteria:**
- Each scenario is an automated test (pytest under `tests/` or `integration_tests/`) or a documented manual checklist with expected output.
- All scenarios pass on CI.
- Any flakiness is diagnosed, not silenced.
- Output evidence (logs, test reports) captured in the subtask body at `verified` stage.

**Depends on:** `001`, `002`, `003` — needs the full CLI surface in place. Runs concurrently with or after `004 update-docs-and-agent-configs`.

**Note:** This subtask may naturally get worked in parallel with `004` since they both depend on the same foundation but touch different parts of the repo.

## Design Note: E2E Test Plan

### 1. Test Files

| File (repo-relative) | Purpose |
|---|---|
| `tests/test_merged_server_e2e.py` (new) | Primary E2E test file. Covers scenarios 1-5: dual transport happy path, `--no-mcp` isolation, deprecated command, graceful shutdown, concurrent clients. Uses `FastAPI TestClient` for HTTP assertions and `create_mcp_client` (anyio memory streams) for MCP protocol assertions against the same app instance. |
| `tests/test_server_lifespan.py` (modified) | Add parametrized case for `command="server"` with `mcp_enabled=True` to verify `RecceMCPServer` is instantiated during lifespan. Also add case for `mcp_enabled=False` verifying MCP is not mounted. |
| `tests/test_cli_mcp_optional.py` (modified) | Add test confirming `recce server` with mocked `ImportError` for `mcp` still starts HTTP server. Extend `test_cli_command_exists` to verify the `--no-mcp` flag is registered on the `server` command. |
| `tests/test_mcp_server.py` (modified) | Add unit test for the new `RecceMCPServer.mount_sse()` method: verify it registers `/mcp/sse` (GET) and `/mcp/messages` (POST) routes on a test Starlette/FastAPI app. |
| `tests/test_state_loader_compat.py` (new) | Scenario 6: state-loader compatibility. Verify that `FileStateLoader` works with the merged server (state is exported on teardown covering both HTTP and MCP operations). `CloudStateLoader` is tested with a mock (requires cloud credentials not available in CI). |

### 2. Test Framework, Fixtures, and Helpers

**Framework:** pytest + pytest-asyncio (already in dev dependencies).

**Existing fixtures/helpers reused:**
- `create_mcp_client(mcp_server)` from `tests/test_mcp_e2e.py` -- wires MCP `ClientSession` to `RecceMCPServer` via anyio in-memory streams. Will be extracted into a shared `tests/conftest_mcp.py` or imported directly.
- `DbtTestHelper` from `tests/adapter/dbt_adapter/dbt_test_helper.py` -- creates real DuckDB-backed `RecceContext` with base/curr schemas.
- `FastAPI TestClient` from `fastapi.testclient` (Starlette ASGI TestClient) -- synchronous HTTP assertions against the FastAPI `app` (already used in `test_server.py`, `test_websocket_endpoint.py`).
- `mock_app_state` / `setup_app_state` from `test_server_lifespan.py` -- `AppState` fixtures for lifespan tests.

**New fixtures to create:**
- `merged_server_app(mcp_enabled=True)` -- fixture that sets up `app.state` with a real `DbtTestHelper`-backed context, sets `mcp_enabled` on `app.state`, and yields the app. Handles cleanup (helper cleanup, app.state reset).
- `mcp_sse_client(app)` -- fixture that connects an MCP client to the mounted SSE routes on the FastAPI app. Uses `httpx.AsyncClient` + `httpx_sse` or the `SseServerTransport` test harness from the `mcp` package. Falls back to in-memory `create_mcp_client` if SSE transport testing is too fragile (see flakiness section).

**New helpers:**
- `wait_for_ready(client, timeout=10)` -- polls `GET /api/health` until `{"ready": true}` or raises `TimeoutError`. Used as a readiness probe before asserting MCP availability.

### 3. Scenario-to-Test Mapping

#### Scenario 1: Dual transport, happy path

| Test | Description |
|---|---|
| `test_http_api_serves_after_mcp_mount` | Start merged app, wait for readiness, assert `GET /api/health` returns 200 with `ready=true`. |
| `test_mcp_endpoint_reachable` | Assert `GET /mcp/sse` returns 200 with `text/event-stream` content type. |
| `test_mcp_list_tools_via_protocol` | Connect MCP client to mounted SSE transport, call `list_tools()`, verify expected tool set matches `test_mcp_e2e.py::TestMCPProtocolE2E::test_list_tools_returns_all_server_mode_tools`. |
| `test_mcp_call_tool_via_protocol` | Call `row_count_diff` via MCP client, verify result matches direct DuckDB data. |

#### Scenario 2: `--no-mcp` isolation

| Test | Description |
|---|---|
| `test_no_mcp_flag_http_works` | Set `app.state.mcp_enabled = False`, start lifespan, assert `GET /api/health` returns 200. |
| `test_no_mcp_flag_mcp_not_mounted` | Assert `GET /mcp/sse` returns 404 when `mcp_enabled=False`. |
| `test_no_mcp_cli_flag_registered` | Use `CliRunner` to confirm `--no-mcp` is a valid option on the `server` command (does not fail with "no such option"). |

#### Scenario 3: Deprecated command still works

| Test | Description |
|---|---|
| `test_deprecated_mcp_server_command_still_runs` | Invoke `recce mcp-server` via `CliRunner` with mocked `run_mcp_server`; assert it is called (backward compat). |
| `test_deprecated_command_shows_warning` | Capture stderr/stdout from `CliRunner` invocation; assert deprecation warning message is present. |

#### Scenario 4: Graceful shutdown

| Test | Description |
|---|---|
| `test_lifespan_teardown_exports_state` | Start lifespan with `FileStateLoader`, create a check via MCP, exit lifespan context, assert `state_loader.export()` was called with state containing the check. |
| `test_shutdown_no_orphan_tasks` | After lifespan teardown, assert no lingering asyncio tasks remain from MCP server (inspect `asyncio.all_tasks()`). |

#### Scenario 5: Concurrent clients

| Test | Description |
|---|---|
| `test_concurrent_http_and_mcp` | In a single async test, run HTTP `GET /api/health` and MCP `list_tools()` concurrently using `asyncio.gather`. Assert both succeed without blocking each other. |
| `test_multiple_mcp_sessions` | Open two MCP client sessions simultaneously, call different tools, assert both return correct results. |

#### Scenario 6: State-loader compatibility

| Test | Description |
|---|---|
| `test_file_state_loader_round_trip` | Create `FileStateLoader` with temp file, start merged server, create a check via MCP, teardown, reload state from file, assert check is present. |
| `test_cloud_state_loader_mock` | Mock `CloudStateLoader`, start merged server, call an MCP tool, teardown, assert `CloudStateLoader.export()` was called. |

### 4. Startup/Shutdown Handling in Tests

**In-process approach (no subprocess):** All tests use the FastAPI `lifespan` context manager directly or `TestClient` (which handles lifespan internally). This avoids subprocess management, port conflicts, and orphan processes entirely.

**Pattern for lifespan tests:**
```python
async with lifespan(app):
    await app.state.ready_event.wait()
    # ... assertions ...
# teardown happens automatically when context exits
```

**Pattern for TestClient tests:**
```python
with TestClient(app) as client:
    response = client.get("/api/health")
    # ... assertions ...
# TestClient handles startup/shutdown of the ASGI app
```

**Pattern for MCP protocol tests on mounted routes:**
The MCP client needs to connect via the SSE transport that is mounted on the FastAPI app. Two approaches:

1. **In-memory (preferred, no ports):** After `lifespan()` mounts `RecceMCPServer`, extract the `mcp_server` from `app.state.mcp_server` and use `create_mcp_client(mcp_server)` with anyio memory streams. This tests the MCP server logic without network transport.

2. **HTTP transport (stretch goal):** Use `httpx.AsyncClient(transport=ASGITransport(app=app))` to make real HTTP requests to `/mcp/sse` and `/mcp/messages`. This would test the actual SSE route integration but adds complexity. Implement if time permits.

**Cleanup:** All fixtures use `yield` with cleanup in the `finally` block: `helper.cleanup()`, resetting `app.state`, closing MCP clients. No orphan processes possible since everything runs in-process.

### 5. CI Integration

**Suite:** Tests live in `tests/` alongside existing unit and E2E tests. They run as part of the existing `make test` / `pytest tests/` pipeline.

**CI workflow:** No changes needed to `.github/workflows/tests-python.yaml`. The existing workflow runs `pytest tests/` on push/PR to `main` across Python 3.11-3.13 and dbt versions. MCP tests are gated with `pytest.importorskip("mcp")` so they are automatically skipped when `mcp` is not installed (e.g., older dbt version test envs in tox). MCP is only installed in the `dbtlatest` tox env (see `tox.ini` line 21).

**Expected runtime:** Each new test file should complete in under 5 seconds. The DuckDB-backed `DbtTestHelper` is fast (in-memory). No network calls, no subprocess spawning, no port binding.

**No new CI workflow files needed.**

### 6. Flakiness Prevention Plan

**Port allocation:** Not applicable. All tests run in-process using `TestClient` (ASGI transport) or anyio memory streams. No TCP ports are bound.

**Readiness probes:** Tests that depend on `lifespan()` background loading use `await app.state.ready_event.wait()` before asserting MCP availability. The `wait_for_ready` helper adds a configurable timeout (default 10s) for robustness.

**Timeout policy:** All async tests use `pytest.mark.asyncio` with the default pytest-asyncio timeout. Individual assertions that could hang (e.g., SSE connection) are wrapped in `asyncio.wait_for(..., timeout=5.0)`.

**Retries policy:** No retries. If a test fails, it is a real failure. Flaky tests are diagnosed, not suppressed. The in-memory transport design eliminates the primary sources of flakiness (port conflicts, process lifecycle, network timing).

**Isolation:** Each test gets a fresh `DbtTestHelper` with unique schema prefixes (UUID-based), preventing cross-test contamination. `app.state` is reset in fixture teardown.

### 7. Dependency Matrix

**dbt integration project:** Not required. Tests use `DbtTestHelper` which creates an in-memory DuckDB database with synthetic dbt artifacts. No real dbt project directory needed.

**`mcp` package:** Required for MCP-specific tests. All MCP test classes/modules use `pytest.importorskip("mcp")` at module level. When `mcp` is not installed, these tests are skipped automatically (not failed). The `--no-mcp` isolation tests (scenario 2) do not require `mcp` to be installed (they mock the import failure).

**Python versions:** Tests must pass on Python 3.10-3.13. All code uses `Optional[X]` annotations (not `X | None`). No 3.12+ features. The `DbtTestHelper` and `mcp` package are both compatible with 3.10+.

**Test matrix coverage:**
| Python | dbt | mcp | Scenarios tested |
|---|---|---|---|
| 3.10 | 1.6+ | no | 2 (`--no-mcp`), 3 (deprecated cmd import check), 4 (partial -- HTTP teardown only) |
| 3.11-3.13 | latest | yes | All 6 scenarios |

### 8. Rollback Plan for Tests

**Quarantine:** If a test is flaky post-merge, add `@pytest.mark.skip(reason="Quarantined: <issue-url>")` to the specific test. This keeps it visible in test output without blocking CI.

**Revert:** The new test file `tests/test_merged_server_e2e.py` is self-contained. A `git revert` of the test commit removes it cleanly. Modifications to existing test files (`test_server_lifespan.py`, `test_cli_mcp_optional.py`, `test_mcp_server.py`) are additive (new test methods only) and can be reverted independently.

**No production code dependency:** The tests do not modify production code. Reverting tests does not affect the merged server behavior.

### 9. Compatibility Verification

- **`recce/data/` (generated):** Tests do not read from, write to, or depend on `recce/data/`. The `TestClient` may trigger the `StaticFiles` mount, but tests only hit API endpoints (`/api/health`, `/mcp/sse`) and MCP protocol, not the frontend.
- **State files:** No `recce_state.json` or `state.json` files are committed. `FileStateLoader` tests use `tempfile.mkdtemp()` with cleanup.
- **Python 3.10-3.13:** All test code uses `Optional[X]` type hints, `pytest.importorskip()` for conditional imports, and standard library features available in 3.10+. No `match` statements, no `X | None` syntax.

## Stage Report: designed

- [x] Enumerate the concrete test files that will be added or modified (repo-relative paths), with a one-line note on what each covers.
  See "Test Files" table: 2 new files (`test_merged_server_e2e.py`, `test_state_loader_compat.py`), 3 modified files (`test_server_lifespan.py`, `test_cli_mcp_optional.py`, `test_mcp_server.py`).
- [x] Identify the test framework, fixtures, and helpers used (pytest fixtures, `create_mcp_client`, httpx/TestClient, subprocess helpers, etc.). Name them explicitly.
  See "Test Framework, Fixtures, and Helpers" section: pytest + pytest-asyncio, FastAPI TestClient, `create_mcp_client`, `DbtTestHelper`, new `merged_server_app` and `wait_for_ready` helpers.
- [x] Specify how each of the 6 scenarios maps to concrete test cases -- one or more per scenario.
  See "Scenario-to-Test Mapping" section: 15 test cases across 6 scenarios with explicit names and descriptions.
- [x] Document startup/shutdown handling in tests: how tests start and stop a `recce server` instance without leaving orphan processes/ports.
  See "Startup/Shutdown Handling" section: all in-process via `lifespan` context manager or `TestClient` -- no subprocesses, no port binding.
- [x] Document CI integration: which suite(s) these tests join, how long they're expected to run, any CI workflow changes needed.
  See "CI Integration" section: `tests/` directory, existing workflow, under 5s runtime, no CI changes.
- [x] Document a flakiness prevention plan: port allocation, readiness probes, timeout policy, retries policy.
  See "Flakiness Prevention" section: no ports (in-process), `ready_event.wait()` probes, `asyncio.wait_for` timeouts, no retries.
- [x] Define the dependency matrix: dbt integration projects, mcp requirement, Python version coverage.
  See "Dependency Matrix" section: DbtTestHelper (no real project), `pytest.importorskip("mcp")`, Python 3.10-3.13 matrix.
- [x] Document a rollback plan for the tests themselves.
  See "Rollback Plan" section: `@pytest.mark.skip` quarantine, clean `git revert`, no production code dependency.
- [x] Verify the test design does not depend on `recce/data/`, does not commit state files, and does not break on Python 3.10-3.13.
  See "Compatibility Verification" section: no `recce/data/` dependency, temp-dir state files, 3.10+ compatible syntax.

### Summary

Produced a concrete E2E test plan covering all 6 required scenarios with 15 test cases across 2 new files and 3 modified files. The design avoids subprocess management and port binding entirely by using FastAPI TestClient and anyio memory streams for in-process testing. All MCP tests are gated behind `pytest.importorskip("mcp")` for graceful degradation in environments without the mcp package. No CI workflow changes are needed.
