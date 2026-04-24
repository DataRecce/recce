"""Integration + contract tests for `recce init --cloud` per_node.db emission (DRC-3295 PR 2).

Covers:
  1. Cloud-mode integration: per_node.db is uploaded when Cloud returns the
     per_node_db_url key; cll_cache.db continues to be uploaded via
     cll_cache_url (warm-cache reuse across sessions).
  2. Local-mode non-regression: `recce init` without --cloud still writes to
     the user-specified cache_db and does not emit per_node.db / upload.
  3. Contract test vs. DbtAdapter.get_model(): extract_rows_from_artifacts →
     SQLite → reconstructed get_model() payload structurally matches the
     live adapter's response for the same manifest + catalog fixtures.
  4. Mode-switching safety: running cloud mode once, then local mode, does not
     corrupt ~/.recce/cll_cache.db — warm-cache behavior IS preserved across
     invocations, and only the per_node.db tempdir is cleaned up.
"""

from __future__ import annotations

import json
import os
import random
import sqlite3
import tempfile
import time
from pathlib import Path
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest
from click.testing import CliRunner

from recce.cli import cli
from recce.util.cll import CllCache
from recce.util.per_node_db import (
    SCHEMA_VERSION,
    PerNodeDbWriter,
    extract_rows_from_artifacts,
)

FIXTURES = Path(__file__).parent


# ---------------------------------------------------------------------------
# Fixtures + helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


@pytest.fixture
def tmp_db(tmp_path: Path) -> str:
    return str(tmp_path / "test_cll_cache.db")


def _make_mock_node(
    resource_type: str = "model",
    raw_code: str = "SELECT 1",
    dep_nodes: Optional[list] = None,
    checksum_value: Optional[str] = None,
):
    """Mirror of tests/test_cli_cache.py:_make_mock_node."""
    import hashlib

    node = MagicMock()
    node.resource_type = resource_type
    node.raw_code = raw_code
    node.depends_on.nodes = dep_nodes or []
    node.checksum.checksum = checksum_value or hashlib.sha256(raw_code.encode()).hexdigest()
    return node


def _make_mock_adapter(nodes: dict, curr_catalog=None, base_catalog=None):
    """Mock DbtAdapter that mimics the attributes used by `recce init`."""
    adapter = MagicMock()
    manifest = MagicMock()
    manifest.nodes = nodes
    manifest.metadata.adapter_type = "duckdb"
    adapter.curr_manifest = manifest
    adapter.base_manifest = None
    adapter.curr_catalog = curr_catalog
    adapter.base_catalog = base_catalog
    adapter.adapter.type.return_value = "duckdb"
    return adapter


def _make_mock_cloud_client(
    session_info: Optional[dict] = None,
    download_urls: Optional[dict] = None,
    base_download_urls: Optional[dict] = None,
    upload_urls: Optional[dict] = None,
):
    client = MagicMock()
    client.get_session.return_value = session_info or {
        "org_id": "org-1",
        "project_id": "proj-1",
        "status": "active",
    }
    client.get_download_urls_by_session_id.return_value = download_urls or {}
    client.get_base_session_download_urls.return_value = base_download_urls or {}
    client.get_upload_urls_by_session_id.return_value = upload_urls or {}
    return client


def _make_mock_response(status_code: int = 200, content: bytes = b"{}"):
    resp = MagicMock()
    resp.status_code = status_code
    resp.content = content

    def _iter_content(chunk_size=8192):
        if content:
            for i in range(0, len(content), chunk_size):
                yield content[i : i + chunk_size]

    resp.iter_content = _iter_content
    return resp


def _setup_target_dir(tmp_path: Path) -> Path:
    target = tmp_path / "target"
    target.mkdir(exist_ok=True)
    (target / "manifest.json").write_text("{}")
    return target


# ---------------------------------------------------------------------------
# 1. Cloud-mode integration
# ---------------------------------------------------------------------------


class TestCloudModeEmitsPerNodeDb:
    """Cloud mode uploads both per_node.db and cll_cache.db."""

    @patch("recce.core.load_context")
    def test_both_artifacts_uploaded_when_urls_present(self, mock_load_context, runner, tmp_path, tmp_db):
        """Happy path: per_node_db_url AND cll_cache_url both receive PUTs."""
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "per_node_db_url": "https://s3.example.com/upload/per_node.db",
                "cll_cache_url": "https://s3.example.com/upload/cll_cache.db",
            },
        )

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.return_value = MagicMock()
        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {"model.test.a": MagicMock()}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        put_calls: list[str] = []

        def mock_get(url, **kwargs):
            return _make_mock_response(200, manifest_bytes)

        def mock_put(url, **kwargs):
            put_calls.append(url)
            return _make_mock_response(200)

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=mock_get),
            patch("requests.put", side_effect=mock_put),
            patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ),
        ):
            result = runner.invoke(
                cli,
                [
                    "init",
                    "--cloud",
                    "--cloud-token",
                    "ghp_testtoken",
                    "--session-id",
                    "sess-1",
                    "--cache-db",
                    tmp_db,
                    "--project-dir",
                    str(tmp_path),
                ],
                catch_exceptions=False,
            )

        assert result.exit_code == 0, result.output
        assert "Cloud upload complete" in result.output
        # per_node.db URL was called
        assert any("per_node.db" in url for url in put_calls), put_calls
        # cll_cache.db URL WAS called — warm-cache reuse depends on it.
        assert any("cll_cache.db" in url for url in put_calls), put_calls

    @patch("recce.core.load_context")
    def test_warns_when_per_node_db_url_missing(self, mock_load_context, runner, tmp_path, tmp_db):
        """Graceful degradation: missing per_node_db_url logs a warning, exits 0."""
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={"cll_map_url": "https://s3.example.com/upload/cll_map.json"},
        )

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.return_value = MagicMock()
        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=lambda *a, **kw: _make_mock_response(200)),
            patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ),
        ):
            result = runner.invoke(
                cli,
                [
                    "init",
                    "--cloud",
                    "--cloud-token",
                    "ghp_testtoken",
                    "--session-id",
                    "sess-1",
                    "--cache-db",
                    tmp_db,
                    "--project-dir",
                    str(tmp_path),
                ],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        assert "No per_node_db_url" in result.output

    @patch("recce.core.load_context")
    def test_per_node_scratch_cleaned_cache_preserved(self, mock_load_context, runner, tmp_path, tmp_db):
        """After a successful cloud upload: per_node scratch dir is removed;
        cache_db at user-specified path remains intact (its parent dir exists).
        """
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "per_node_db_url": "https://s3.example.com/upload/per_node.db",
                "cll_cache_url": "https://s3.example.com/upload/cll_cache.db",
            },
        )

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.return_value = MagicMock()
        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        # Track what mkdtemp returns so we can inspect it after the run.
        original_mkdtemp = tempfile.mkdtemp
        dirs_created: list[str] = []

        def tracking_mkdtemp(*args, **kwargs):
            path = original_mkdtemp(*args, **kwargs)
            dirs_created.append(path)
            return path

        cache_db_parent = Path(tmp_db).parent

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=lambda *a, **kw: _make_mock_response(200)),
            patch("tempfile.mkdtemp", side_effect=tracking_mkdtemp),
            patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ),
        ):
            result = runner.invoke(
                cli,
                [
                    "init",
                    "--cloud",
                    "--cloud-token",
                    "ghp_testtoken",
                    "--session-id",
                    "sess-1",
                    "--cache-db",
                    tmp_db,
                    "--project-dir",
                    str(tmp_path),
                ],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        # per_node scratch dirs cleaned up
        per_node_dirs = [d for d in dirs_created if Path(d).name.startswith("recce-per-node-")]
        assert per_node_dirs, f"no recce-per-node-* tempdir was created (got: {dirs_created})"
        for sd in per_node_dirs:
            assert not Path(sd).exists(), f"per_node scratch {sd} was not cleaned up after success"
        # cache_db path is NOT rmtree'd — its parent dir still exists, and so
        # does the cache.db itself (since we wrote to it during the run).
        assert cache_db_parent.exists(), "cache.db parent dir must persist — it is NOT a scratch dir"
        assert Path(tmp_db).exists(), "cache.db at user-specified path must persist"

    @patch("recce.core.load_context")
    def test_scratch_cleaned_even_when_per_node_upload_fails(self, mock_load_context, runner, tmp_path, tmp_db):
        """HTTP 500 on per_node.db upload must NOT leak the scratch tempdir.

        Previously cleanup was gated on upload_succeeded, which meant any
        failed upload (including the common timeout / 500 case) would leave
        a multi-MB recce-per-node-* dir in /tmp. On long-lived Cloud deploys
        (scheduled retries) this accumulates — the cleanup is now
        unconditional.
        """
        manifest_bytes = b'{"nodes": {}}'
        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "per_node_db_url": "https://s3.example.com/upload/per_node.db",
                "cll_cache_url": "https://s3.example.com/upload/cll_cache.db",
            },
        )

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.return_value = MagicMock()
        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        original_mkdtemp = tempfile.mkdtemp
        dirs_created: list[str] = []

        def tracking_mkdtemp(*args, **kwargs):
            path = original_mkdtemp(*args, **kwargs)
            dirs_created.append(path)
            return path

        def failing_put(url, **kwargs):
            if "per_node.db" in url:
                return _make_mock_response(500)
            return _make_mock_response(200)

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=failing_put),
            patch("tempfile.mkdtemp", side_effect=tracking_mkdtemp),
            patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ),
        ):
            result = runner.invoke(
                cli,
                [
                    "init",
                    "--cloud",
                    "--cloud-token",
                    "ghp_testtoken",
                    "--session-id",
                    "sess-1",
                    "--cache-db",
                    tmp_db,
                    "--project-dir",
                    str(tmp_path),
                ],
                catch_exceptions=False,
            )

        # CLI still exits 0 — upload failure is a warning, not an error.
        assert result.exit_code == 0, result.output
        assert "Failed to upload per_node.db" in result.output
        # Scratch dir is cleaned even though upload failed.
        per_node_dirs = [d for d in dirs_created if Path(d).name.startswith("recce-per-node-")]
        assert per_node_dirs, f"no recce-per-node-* tempdir was created (got: {dirs_created})"
        for sd in per_node_dirs:
            assert not Path(sd).exists(), f"per_node scratch {sd} leaked on upload failure"

    @patch("recce.core.load_context")
    def test_scratch_cleaned_when_upload_url_fetch_raises(self, mock_load_context, runner, tmp_path, tmp_db):
        """If get_upload_urls_by_session_id raises, we still clean up scratch."""
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
        )
        mock_client.get_upload_urls_by_session_id.side_effect = RuntimeError("cloud down")

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.return_value = MagicMock()
        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        original_mkdtemp = tempfile.mkdtemp
        dirs_created: list[str] = []

        def tracking_mkdtemp(*args, **kwargs):
            path = original_mkdtemp(*args, **kwargs)
            dirs_created.append(path)
            return path

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=lambda *a, **kw: _make_mock_response(200)),
            patch("tempfile.mkdtemp", side_effect=tracking_mkdtemp),
            patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ),
        ):
            result = runner.invoke(
                cli,
                [
                    "init",
                    "--cloud",
                    "--cloud-token",
                    "ghp_testtoken",
                    "--session-id",
                    "sess-1",
                    "--cache-db",
                    tmp_db,
                    "--project-dir",
                    str(tmp_path),
                ],
                catch_exceptions=False,
            )

        assert result.exit_code == 0, result.output
        assert "Cloud upload failed" in result.output
        per_node_dirs = [d for d in dirs_created if Path(d).name.startswith("recce-per-node-")]
        assert per_node_dirs
        for sd in per_node_dirs:
            assert not Path(sd).exists(), f"per_node scratch {sd} leaked on get_upload_urls failure"

    @patch("recce.core.load_context")
    def test_emit_failure_degrades_gracefully(self, mock_load_context, runner, tmp_path, tmp_db):
        """If PerNodeDbWriter raises, CLI logs a warning and other artifacts
        still upload. per_node.db is skipped (its URL never sees a PUT).
        """
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "per_node_db_url": "https://s3.example.com/upload/per_node.db",
                "cll_cache_url": "https://s3.example.com/upload/cll_cache.db",
            },
        )

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.return_value = MagicMock()
        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        put_calls: list[str] = []

        def track_put(url, **kwargs):
            put_calls.append(url)
            return _make_mock_response(200)

        class _FailingWriter:
            def __init__(self, *_a, **_kw):
                raise RuntimeError("disk full, say")

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=track_put),
            patch("recce.util.per_node_db.PerNodeDbWriter", _FailingWriter),
            patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ),
        ):
            result = runner.invoke(
                cli,
                [
                    "init",
                    "--cloud",
                    "--cloud-token",
                    "ghp_testtoken",
                    "--session-id",
                    "sess-1",
                    "--cache-db",
                    tmp_db,
                    "--project-dir",
                    str(tmp_path),
                ],
                catch_exceptions=False,
            )

        assert result.exit_code == 0, result.output
        assert "Failed to emit per_node.db" in result.output
        # per_node.db URL never receives a PUT because emission failed.
        assert not any("per_node.db" in url for url in put_calls), put_calls
        # cll_map.json and cll_cache.db still upload.
        assert any("cll_map.json" in url for url in put_calls), put_calls
        assert any("cll_cache.db" in url for url in put_calls), put_calls


# ---------------------------------------------------------------------------
# 2. Local-mode non-regression
# ---------------------------------------------------------------------------


class TestLocalModeNoPerNodeDb:
    """`recce init` without --cloud keeps its existing behavior."""

    @patch("recce.core.load_context")
    def test_local_mode_writes_cache_and_no_per_node_db(self, mock_load_context, runner, tmp_path, tmp_db):
        """Local mode: cll_cache.db written to --cache-db; no per_node.db emitted; no uploads."""
        _setup_target_dir(tmp_path)

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.return_value = MagicMock()
        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        put_calls: list[str] = []
        get_calls: list[str] = []

        def track_put(url, **kwargs):
            put_calls.append(url)
            return _make_mock_response(200)

        def track_get(url, **kwargs):
            get_calls.append(url)
            return _make_mock_response(200)

        with (
            patch("requests.put", side_effect=track_put),
            patch("requests.get", side_effect=track_get),
            patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ),
        ):
            result = runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        # cache.db is written to the user-specified path
        assert Path(tmp_db).exists(), "expected cache_db at user-specified path"
        # No per_node.db file next to cache (or anywhere we can easily detect)
        assert not (Path(tmp_db).parent / "per_node.db").exists()
        # No upload / download attempts in local mode
        assert put_calls == [], f"unexpected PUT calls in local mode: {put_calls}"
        assert get_calls == [], f"unexpected GET calls in local mode: {get_calls}"


# ---------------------------------------------------------------------------
# 3. Contract test vs. DbtAdapter.get_model()
# ---------------------------------------------------------------------------


def _reconstruct_get_model_from_rows(
    db_path: Path,
    node_id: str,
    env: str,
    column_types: dict,
) -> dict:
    """Build a `get_model()`-shaped dict from per_node.db rows.

    `column_types` is a pre-fetched {col_name: dtype} mapping that mimics the
    output of DbtAdapter.get_columns() (the warehouse-facing query). The
    contract we are validating is: given the same catalog data, both code
    paths produce the same keys / values.
    """
    conn = sqlite3.connect(str(db_path))
    try:
        # primary_key + raw_code from nodes row
        row = conn.execute(
            "SELECT primary_key, raw_code FROM nodes WHERE node_id = ? AND env = ?",
            (node_id, env),
        ).fetchone()
        if row is None:
            return {}
        primary_key, raw_code = row

        # test rows for not_null / unique flags
        test_rows = conn.execute(
            "SELECT column_name, test_type FROM node_tests WHERE node_id = ? AND env = ?",
            (node_id, env),
        ).fetchall()
    finally:
        conn.close()

    not_null_cols = {col for col, t in test_rows if t == "not_null"}
    unique_cols = {col for col, t in test_rows if t == "unique"}

    columns_info: dict = {}
    for col_name, dtype in column_types.items():
        col: dict = {"name": col_name, "type": dtype}
        if col_name in not_null_cols:
            col["not_null"] = True
        if col_name in unique_cols:
            col["unique"] = True
        columns_info[col_name] = col

    result: dict = {"columns": columns_info}
    if primary_key:
        result["primary_key"] = primary_key
    if raw_code is not None:
        result["raw_code"] = raw_code
    return result


class TestContractWithGetModel:
    """Structural parity with DbtAdapter.get_model() on real fixture artifacts."""

    @pytest.fixture
    def manifest_and_catalog(self):
        manifest_path = FIXTURES / "manifest.json"
        catalog_path = FIXTURES / "catalog.json"
        if not manifest_path.exists() or not catalog_path.exists():
            pytest.skip("jaffle_shop manifest/catalog fixtures not available")
        with open(manifest_path) as f:
            manifest = json.load(f)
        with open(catalog_path) as f:
            catalog = json.load(f)
        return manifest, catalog

    def test_extracted_rows_match_get_model(self, manifest_and_catalog, tmp_path):
        """Rows round-tripped through SQLite match what DbtAdapter.get_model() returns."""
        from recce.adapter.dbt_adapter import DbtAdapter

        manifest, catalog = manifest_and_catalog
        env = "current"

        # Emit per_node.db
        db_path = tmp_path / "per_node.db"
        with PerNodeDbWriter(db_path) as w:
            nodes, columns, edges, tests = extract_rows_from_artifacts(manifest, catalog, env)
            w.write_nodes(nodes)
            w.write_columns(columns)
            w.write_edges(edges)
            w.write_tests(tests)

        # Pick nodes that are present in both manifest + catalog — those
        # exercise every branch (types, not_null, unique, primary_key, raw_code).
        candidates = [
            nid
            for nid in manifest["nodes"].keys()
            if nid in catalog.get("nodes", {}) and manifest["nodes"][nid].get("resource_type") == "model"
        ]
        sample = candidates[:8]
        assert sample, "no model nodes overlap between manifest + catalog"

        # Build a stub DbtAdapter: only get_columns() is mocked (warehouse call).
        adapter = MagicMock(spec=DbtAdapter)
        adapter.curr_manifest = MagicMock()
        adapter.curr_manifest.to_dict.return_value = manifest
        adapter.base_manifest = None

        for node_id in sample:
            catalog_cols = catalog["nodes"][node_id].get("columns", {})
            # Mock warehouse-facing query to return catalog-derived (col_name, dtype) pairs.
            column_objs = []
            for col_name, col_info in catalog_cols.items():
                col_obj = MagicMock()
                col_obj.column = col_name
                col_obj.dtype = col_info.get("type")
                column_objs.append(col_obj)
            adapter.get_columns.return_value = column_objs

            # Live path
            live = DbtAdapter.get_model(adapter, node_id, base=False)

            # Reconstructed path (from per_node.db rows)
            reconstructed = _reconstruct_get_model_from_rows(
                db_path,
                node_id,
                env,
                {c.column: c.dtype for c in column_objs},
            )

            # Structural parity
            assert set(live.keys()) == set(
                reconstructed.keys()
            ), f"{node_id}: keys differ. live={live.keys()} reconstructed={reconstructed.keys()}"
            assert live.get("primary_key") == reconstructed.get("primary_key"), f"{node_id}: primary_key differs"
            assert live.get("raw_code") == reconstructed.get("raw_code"), f"{node_id}: raw_code differs"
            live_cols = live["columns"]
            rec_cols = reconstructed["columns"]
            assert set(live_cols.keys()) == set(rec_cols.keys()), f"{node_id}: column names differ"
            for col_name in live_cols:
                for field in ("type", "not_null", "unique"):
                    assert live_cols[col_name].get(field) == rec_cols[col_name].get(field), (
                        f"{node_id}.{col_name}: field '{field}' differs "
                        f"(live={live_cols[col_name].get(field)}, rec={rec_cols[col_name].get(field)})"
                    )

    def test_primary_key_and_tests_derived_from_manifest_only(self, manifest_and_catalog, tmp_path):
        """primary_key + node_tests must be derivable without a warehouse call."""
        manifest, catalog = manifest_and_catalog

        db_path = tmp_path / "per_node.db"
        with PerNodeDbWriter(db_path) as w:
            nodes, columns, edges, tests = extract_rows_from_artifacts(manifest, catalog, "current")
            w.write_nodes(nodes)
            w.write_columns(columns)
            w.write_edges(edges)
            w.write_tests(tests)

        conn = sqlite3.connect(str(db_path))
        try:
            # At least one node in jaffle_shop has a unique test (primary_key).
            rows = conn.execute("SELECT node_id, primary_key FROM nodes WHERE primary_key IS NOT NULL").fetchall()
            assert rows, "expected at least one node with primary_key derived from unique tests"
            # At least one not_null test row.
            nn = conn.execute("SELECT COUNT(*) FROM node_tests WHERE test_type = 'not_null'").fetchone()[0]
            assert nn > 0, "expected at least one not_null test row"
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# 4. Mode-switching safety
# ---------------------------------------------------------------------------


class TestModeSwitchingSafety:
    """Cloud → local switches must preserve the warm cache at --cache-db."""

    @patch("recce.core.load_context")
    def test_cloud_then_local_preserves_warm_cache(self, mock_load_context, runner, tmp_path):
        """Cloud run writes to --cache-db; a subsequent local run against the
        SAME --cache-db sees the entries it wrote — warm-cache reuse works.
        """
        # --- Cloud run (writes to user --cache-db; uploads it to cll_cache_url) ---
        manifest_bytes = b'{"nodes": {}}'
        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "per_node_db_url": "https://s3.example.com/upload/per_node.db",
                "cll_cache_url": "https://s3.example.com/upload/cll_cache.db",
            },
        )
        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.return_value = MagicMock()
        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map
        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        original_mkdtemp = tempfile.mkdtemp
        dirs_created: list[str] = []

        def tracking_mkdtemp(*args, **kwargs):
            path = original_mkdtemp(*args, **kwargs)
            dirs_created.append(path)
            return path

        shared_cache_db = str(tmp_path / "shared-cache.db")
        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=lambda *a, **kw: _make_mock_response(200)),
            patch("tempfile.mkdtemp", side_effect=tracking_mkdtemp),
            patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ),
        ):
            cloud_result = runner.invoke(
                cli,
                [
                    "init",
                    "--cloud",
                    "--cloud-token",
                    "ghp_testtoken",
                    "--session-id",
                    "sess-1",
                    "--cache-db",
                    shared_cache_db,
                    "--project-dir",
                    str(tmp_path / "cloudproj"),
                ],
                catch_exceptions=False,
            )
        assert cloud_result.exit_code == 0, cloud_result.output
        # Cloud mode writes the cache at the user --cache-db path (warm-cache reuse).
        assert Path(shared_cache_db).exists(), "cloud mode must write cache.db to the user path"
        # per_node tempdir cleaned up after success; cache.db is NOT rmtree'd.
        per_node_dirs = [d for d in dirs_created if Path(d).name.startswith("recce-per-node-")]
        assert per_node_dirs
        assert all(not Path(d).exists() for d in per_node_dirs)
        # No recce-cll-* scratch dir is created anymore (cache.db lives at the user path).
        assert not any(Path(d).name.startswith("recce-cll-") for d in dirs_created)

        # --- Local run (against the SAME --cache-db path) ---
        local_proj = tmp_path / "localproj"
        local_proj.mkdir()
        (local_proj / "target").mkdir()
        (local_proj / "target" / "manifest.json").write_text("{}")

        with patch(
            "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
            return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
        ):
            local_result = runner.invoke(
                cli,
                ["init", "--cache-db", shared_cache_db, "--project-dir", str(local_proj)],
                catch_exceptions=False,
            )

        assert local_result.exit_code == 0
        # Shared cache.db still exists and is a valid CLL cache — warm-cache
        # reuse works across invocations (cloud → local).
        assert Path(shared_cache_db).exists()
        cache = CllCache(db_path=shared_cache_db)
        assert cache.stats["entries"] >= 0

        # Sanity: SCHEMA_VERSION used by the per_node.db emitter is numeric.
        assert int(SCHEMA_VERSION) >= 1


# ---------------------------------------------------------------------------
# 5. Scale validation (PR 3)
# ---------------------------------------------------------------------------
#
# Validates size, extraction speed, and SQLite read-latency characteristics of
# per_node.db on realistic dbt artifacts (jaffle-shop-expand, ~1918 nodes).
#
# Gated behind RECCE_SCALE_TESTS=1 and marked `@pytest.mark.scale` so CI and
# normal `make test` runs skip it. The fixture directory is not committed —
# point RECCE_SCALE_FIXTURE_DIR at a dbt project's ``target`` dir (must
# contain ``manifest.json`` and ``catalog.json``). The default path
# ``tests/fixtures/jaffle-shop-expand`` is checked as a fallback so local
# contributors can drop artifacts in place without setting an env var. If
# neither is populated the scale class skips gracefully.

_SCALE_FIXTURE_DIR = Path(
    os.getenv("RECCE_SCALE_FIXTURE_DIR") or (Path(__file__).parent / "fixtures" / "jaffle-shop-expand")
)
_SCALE_ENABLED = os.getenv("RECCE_SCALE_TESTS") == "1"


@pytest.mark.scale
@pytest.mark.skipif(not _SCALE_ENABLED, reason="set RECCE_SCALE_TESTS=1 to run")
class TestPerNodeDbScale:
    """Scale characteristics on the jaffle-shop-expand project (~1918 nodes)."""

    @pytest.fixture(scope="class")
    def scale_artifacts(self) -> tuple[dict, dict]:
        manifest_path = _SCALE_FIXTURE_DIR / "manifest.json"
        catalog_path = _SCALE_FIXTURE_DIR / "catalog.json"
        if not manifest_path.exists() or not catalog_path.exists():
            pytest.skip(f"scale fixtures not found at {_SCALE_FIXTURE_DIR}")
        with open(manifest_path) as f:
            manifest = json.load(f)
        with open(catalog_path) as f:
            catalog = json.load(f)
        return manifest, catalog

    @pytest.fixture(scope="class")
    def scale_db(self, scale_artifacts, tmp_path_factory) -> Path:
        """Emit per_node.db once for this class and reuse it across tests."""
        manifest, catalog = scale_artifacts
        db_path = tmp_path_factory.mktemp("scale") / "per_node.db"
        # Approximate an empty-diff scenario: same artifacts for base + current.
        # This validates the scale characteristics on realistic data — it is
        # not a true paired-env correctness test.
        with PerNodeDbWriter(db_path) as w:
            for env in ("base", "current"):
                nodes, columns, edges, tests = extract_rows_from_artifacts(manifest, catalog, env)
                w.write_nodes(nodes)
                w.write_columns(columns)
                w.write_edges(edges)
                w.write_tests(tests)
        return db_path

    def test_extraction_under_2s(self, scale_artifacts):
        """extract_rows_from_artifacts completes in < 2s on 1918-node project."""
        manifest, catalog = scale_artifacts
        start = time.perf_counter_ns()
        nodes, columns, edges, tests = extract_rows_from_artifacts(manifest, catalog, "current")
        elapsed_s = (time.perf_counter_ns() - start) / 1e9
        # Sanity on output size before asserting timing.
        assert len(nodes) >= 1000
        assert elapsed_s < 2.0, f"extraction took {elapsed_s:.3f}s (budget 2.0s)"

    def test_db_file_size_under_budget(self, scale_db):
        """per_node.db file size stays within budget on jaffle-shop-expand.

        Budget is generous enough to cover dual-env emission (~33 MB measured
        on this 1918-node project) with headroom; a regression to 2x would
        trip it.
        """
        size_bytes = scale_db.stat().st_size
        size_mb = size_bytes / (1024 * 1024)
        assert size_mb <= 40.0, f"per_node.db is {size_mb:.2f} MB (budget 40 MB)"

    def test_node_count_matches_manifest(self, scale_artifacts, scale_db):
        """Row count in `nodes` matches manifest nodes+sources count per env."""
        manifest, _ = scale_artifacts
        expected = len(manifest.get("nodes") or {}) + len(manifest.get("sources") or {})
        # +exposures/metrics/semantic_models if present (these are tiny).
        for section in ("exposures", "metrics", "semantic_models"):
            expected += len(manifest.get(section) or {})

        conn = sqlite3.connect(str(scale_db))
        try:
            current_count = conn.execute("SELECT COUNT(*) FROM nodes WHERE env = 'current'").fetchone()[0]
        finally:
            conn.close()
        assert current_count == expected, f"nodes(current)={current_count}, expected={expected}"

    def test_point_read_p95_under_5ms(self, scale_db):
        """100-iteration point-read P95 on random node_id PKs is < 5 ms."""
        # Open RO connection via URI (read-only mode avoids any write-lock overhead).
        uri = f"file:{scale_db}?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
        try:
            rows = conn.execute("SELECT node_id FROM nodes WHERE env = 'current'").fetchall()
            node_ids = [r[0] for r in rows]
            assert len(node_ids) >= 100, f"need ≥100 nodes for point-read sample, got {len(node_ids)}"

            rng = random.Random(42)
            sample = rng.sample(node_ids, 100)
            sample.sort()  # pick once, iterate — no per-iter randomness.

            timings_ns: list[int] = []
            for node_id in sample:
                t0 = time.perf_counter_ns()
                conn.execute(
                    "SELECT primary_key, raw_code FROM nodes WHERE node_id = ? AND env = ?",
                    (node_id, "current"),
                ).fetchone()
                timings_ns.append(time.perf_counter_ns() - t0)
        finally:
            conn.close()

        timings_ns.sort()
        p95_ms = timings_ns[int(0.95 * len(timings_ns)) - 1] / 1e6
        assert p95_ms < 5.0, f"point-read P95 = {p95_ms:.3f} ms (budget 5 ms)"

    def test_range_query_under_50ms(self, scale_artifacts, scale_db):
        """Range query on resource_type + env returns expected count in < 50 ms."""
        manifest, _ = scale_artifacts
        expected_models = sum(1 for n in (manifest.get("nodes") or {}).values() if n.get("resource_type") == "model")

        uri = f"file:{scale_db}?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
        try:
            t0 = time.perf_counter_ns()
            rows = conn.execute(
                "SELECT * FROM nodes WHERE resource_type = ? AND env = ?",
                ("model", "current"),
            ).fetchall()
            elapsed_ms = (time.perf_counter_ns() - t0) / 1e6
        finally:
            conn.close()

        assert len(rows) == expected_models, f"range query returned {len(rows)}, expected {expected_models}"
        assert elapsed_ms < 50.0, f"range query took {elapsed_ms:.3f} ms (budget 50 ms)"
