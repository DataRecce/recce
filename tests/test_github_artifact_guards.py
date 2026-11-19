"""Replay the arbiter's nine guard mutations against the artifact contract tests."""

import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import recce.github as github_module

# These deliberately remove one guard at a time; the ordinary artifact tests must
# distinguish each variant from the current implementation without relying on
# unrelated layout failures in the review's older source snapshots.
GUARDS = {
    "early_worktree_mutation": (
        'prefix="recce-artifact-validated-", dir=temporary_parent',
        'prefix="recce-artifact-validated-", dir=root',
    ),
    "declared_byte_count": ("sum(info.file_size for info in members) > MAX_ARCHIVE_BYTES", "False"),
    "download_byte_count_per_chunk_only": ("received += len(chunk)", "received = len(chunk)"),
    "directory_wrapper": (
        "len(parts) != 1 or parts[0] not in wrappers or info.file_size",
        "info.file_size",
    ),
    "empty_directory_payload": (
        "len(parts) != 1 or parts[0] not in wrappers or info.file_size",
        "len(parts) != 1 or parts[0] not in wrappers",
    ),
    "existing_output_anchor": ("if not os.path.isdir(root):", "if False:"),
    "existing_output_collision": ("if os.path.lexists(output):", "if False:"),
    "artifact_name_markup": ('f"Artifact: {escape(artifact.name)}"', 'f"Artifact: {artifact.name}"'),
    "http_status": ("response.raise_for_status()", "pass"),
}

# Each subprocess has a fresh module namespace and cannot contact external hosts,
# including through CLI telemetry. Only the touched contract module is collected.
RUN_SUITE = """
import socket
import sys
from pathlib import Path
import pytest
import requests

def blocked(*args, **kwargs):
    raise AssertionError("Artifact guard tests must remain offline")

requests.sessions.Session.send = blocked
socket.socket.connect = blocked
socket.socket.connect_ex = blocked
from recce import event
event.init = lambda: None
event.should_log_event = lambda: False
event.flush_events = lambda: None
event.log_codespaces_events = lambda command: None
import recce.github
source, directory, suite = map(Path, sys.argv[1:])
exec(compile(source.read_bytes(), str(source), "exec"), vars(recce.github))
raise SystemExit(pytest.main([
    str(suite), "-q", "--tb=short", "-p", "no:cacheprovider",
    "--basetemp", str(directory / "pytest"),
    "--junitxml", str(directory / "result.xml"),
]))
"""


def review_suite(source, directory):
    directory.mkdir()
    module = directory / "github.py"
    module.write_text(source)
    suite = Path(__file__).with_name("test_github_artifact.py").resolve()
    result = subprocess.run(
        [sys.executable, "-B", "-c", RUN_SUITE, str(module), str(directory), str(suite)],
        cwd=suite.parents[1],
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"},
        capture_output=True,
        text=True,
    )
    (directory / "output.txt").write_text(result.stdout + result.stderr)
    xml = directory / "result.xml"
    assert result.returncode in (0, 1) and xml.is_file(), result.stdout + result.stderr
    cases = ET.parse(xml).findall(".//testcase")
    assert cases and all(case.find("error") is None for case in cases), result.stdout
    return {
        (case.get("classname"), case.attrib["name"]): case.find("failure") is not None
        for case in cases
        if case.find("skipped") is None
    }


def test_upstream_suite_detects_guard_regressions(tmp_path):
    source = Path(github_module.__file__).read_text()
    control = review_suite(source, tmp_path / "control")
    assert not any(control.values()), "The control artifact suite must pass"
    survived = []
    for guard, (original, replacement) in GUARDS.items():
        assert source.count(original) == 1, f"Update the {guard} mutation for the current implementation"
        variant = review_suite(source.replace(original, replacement), tmp_path / guard)
        assert variant.keys() == control.keys(), guard
        if not any(variant.values()):
            survived.append(guard)
    assert not survived, f"Undetected regressions: {survived}"
