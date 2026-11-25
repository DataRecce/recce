"""Ensure negative tests distinguish each sandbox and AST guard branch."""

import json
import subprocess
import sys
from pathlib import Path

import pytest
from sqlglot import exp


class GuardCoverage:
    def __init__(self):
        self.hits = set()

    def trace_frame(self, frame, event, arg):
        if event != "exception":
            return self.trace_frame
        _, error, _ = arg
        if frame.f_code.co_name == "lock_down_duckdb":
            if isinstance(error, ValueError) and str(error) == "DuckDB sandbox settings did not take effect":
                self.hits.add("post-SET mismatch")
        elif str(error) == "SQLMesh requires a single read-only query.":
            expression = frame.f_locals.get("expression")
            filters = frame.f_locals.get("disallowed")
            if filters and isinstance(expression, exp.Expression):
                matched = {t.__name__ for t in filters if any(isinstance(n, t) for n in expression.walk())}
                if isinstance(expression, exp.Query) and len(matched) == 1:
                    self.hits.update(matched)
                elif not isinstance(expression, exp.Query) and not matched:
                    self.hits.add("Query root")
        return self.trace_frame

    def trace(self, frame, event, arg):
        if frame.f_code.co_name in {"lock_down_duckdb", "replace_virtual_tables"}:
            return self.trace_frame

    @pytest.hookimpl(hookwrapper=True)
    def pytest_runtest_call(self, item):
        old = sys.gettrace()
        sys.settrace(self.trace)
        try:
            yield
        finally:
            sys.settrace(old)


@pytest.fixture(scope="module")
def guard_hits(tmp_path_factory):
    report = tmp_path_factory.mktemp("guard-coverage") / "hits.json"
    subprocess.run([sys.executable, __file__, str(report)], check=True, cwd=Path(__file__).resolve().parents[2])
    return set(json.loads(report.read_text()))


def test_repository_exercises_failed_final_readback(guard_hits):
    assert "post-SET mismatch" in guard_hits


def test_repository_exercises_query_root_and_descendants_independently(guard_hits):
    required = {"DDL", "Command", "Block", "Pragma", "Set", "Install", "LoadData", "Query root"}
    missing = required - guard_hits
    assert not missing, f"No distinguishing rejection for {sorted(missing)}"


if __name__ == "__main__":
    recorder = GuardCoverage()
    rc = pytest.main(["tests/adapter/test_sqlmesh_adapter.py", "-q"], plugins=[recorder])
    Path(sys.argv[1]).write_text(json.dumps(sorted(recorder.hits)))
    raise SystemExit(rc)
