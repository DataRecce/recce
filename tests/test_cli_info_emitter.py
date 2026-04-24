"""Integration tests for `recce init --cloud` info.json + lineage_diff.json emission (DRC-3296).

Covers:
  1. Cloud-mode integration: info.json and lineage_diff.json are uploaded via
     info_url / lineage_diff_url when Cloud returns those keys.
  2. Graceful degradation: missing info_url / lineage_diff_url logs a warning,
     continues, and exits 0 (keeps old-CLI + new-Cloud and vice-versa compat).
  3. Local-mode non-regression: `recce init` without --cloud does not emit
     info.json / lineage_diff.json and does not upload.
  4. Mode-switching safety: cloud-mode uses a `recce-metadata-*` scratch dir
     (distinct prefix from A1's `recce-cll-*`) and cleans it up on success.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest
from click.testing import CliRunner

from recce.cli import cli

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


def _base_cloud_mocks():
    """Return commonly-used patches + helper so individual tests focus on assertions.

    Returns a tuple of (emit_side_effect, mock_put_recorder, cloud_client factory helper).
    Each test wires its own upload_urls to exercise different branches.
    """

    def _emit_side_effect(adapter, info_path: Path, lineage_diff_path: Path):
        """Stub emit_info_and_lineage_diff: write minimal valid JSON files."""
        info_path.parent.mkdir(parents=True, exist_ok=True)
        info_path.write_bytes(b'{"adapter_type":"duckdb","lineage":{"nodes":{},"edges":[],"metadata":{}}}')
        lineage_diff_path.parent.mkdir(parents=True, exist_ok=True)
        lineage_diff_path.write_bytes(b'{"base":{},"current":{},"diff":{}}')

    return _emit_side_effect


# ---------------------------------------------------------------------------
# 1. Cloud-mode integration: both uploads happen via their URLs
# ---------------------------------------------------------------------------


class TestCloudModeEmitsInfoAndLineageDiff:
    """Happy path: info.json and lineage_diff.json are uploaded via their URLs."""

    @patch("recce.core.load_context")
    def test_both_files_uploaded_when_urls_present(self, mock_load_context, runner, tmp_path, tmp_db):
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "info_url": "https://s3.example.com/upload/info.json",
                "lineage_diff_url": "https://s3.example.com/upload/lineage_diff.json",
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

        put_calls: list[tuple[str, bytes]] = []

        def mock_get(url, **kwargs):
            return _make_mock_response(200, manifest_bytes)

        def mock_put(url, **kwargs):
            data = kwargs.get("data")
            payload = b""
            if hasattr(data, "read"):
                payload = data.read()
            elif isinstance(data, (bytes, bytearray)):
                payload = bytes(data)
            put_calls.append((url, payload))
            return _make_mock_response(200)

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=mock_get),
            patch("requests.put", side_effect=mock_put),
            patch("recce.util.info_emitter.emit_info_and_lineage_diff", side_effect=_base_cloud_mocks()),
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
        urls_hit = [u for (u, _) in put_calls]
        # Both metadata URLs were PUT to
        assert any("info.json" in u for u in urls_hit), f"info.json URL not uploaded: {urls_hit}"
        assert any("lineage_diff.json" in u for u in urls_hit), f"lineage_diff.json URL not uploaded: {urls_hit}"
        # User output mentions uploads
        assert "Uploaded info.json" in result.output
        assert "Uploaded lineage_diff.json" in result.output


# ---------------------------------------------------------------------------
# 2. Graceful degradation: missing info_url / lineage_diff_url
# ---------------------------------------------------------------------------


class TestCloudModeGracefulDegradation:
    """Missing upload URL for info/lineage_diff → warn, continue, exit 0."""

    @patch("recce.core.load_context")
    def test_warns_when_info_url_missing(self, mock_load_context, runner, tmp_path, tmp_db):
        manifest_bytes = b'{"nodes": {}}'

        # upload_urls includes lineage_diff_url but NOT info_url
        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "lineage_diff_url": "https://s3.example.com/upload/lineage_diff.json",
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

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=lambda *a, **kw: _make_mock_response(200)),
            patch("recce.util.info_emitter.emit_info_and_lineage_diff", side_effect=_base_cloud_mocks()),
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
        # Warning emitted for missing info_url
        assert "No info_url in upload URLs" in result.output
        # lineage_diff.json still uploaded
        assert "Uploaded lineage_diff.json" in result.output

    @patch("recce.core.load_context")
    def test_warns_when_lineage_diff_url_missing(self, mock_load_context, runner, tmp_path, tmp_db):
        manifest_bytes = b'{"nodes": {}}'

        # upload_urls includes info_url but NOT lineage_diff_url
        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "info_url": "https://s3.example.com/upload/info.json",
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

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=lambda *a, **kw: _make_mock_response(200)),
            patch("recce.util.info_emitter.emit_info_and_lineage_diff", side_effect=_base_cloud_mocks()),
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
        assert "No lineage_diff_url in upload URLs" in result.output
        assert "Uploaded info.json" in result.output

    @patch("recce.core.load_context")
    def test_warns_when_both_urls_missing(self, mock_load_context, runner, tmp_path, tmp_db):
        """Both URLs missing → two warnings, no metadata uploads, exit 0."""
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

        put_urls: list[str] = []

        def mock_put(url, **kwargs):
            put_urls.append(url)
            return _make_mock_response(200)

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=mock_put),
            patch("recce.util.info_emitter.emit_info_and_lineage_diff", side_effect=_base_cloud_mocks()),
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
        assert "No info_url in upload URLs" in result.output
        assert "No lineage_diff_url in upload URLs" in result.output
        # No info.json / lineage_diff.json uploads attempted
        assert not any("info.json" in u for u in put_urls)
        assert not any("lineage_diff.json" in u for u in put_urls)


# ---------------------------------------------------------------------------
# 3. Local-mode non-regression
# ---------------------------------------------------------------------------


class TestLocalModeNoEmission:
    """Local mode must not emit info.json / lineage_diff.json or upload."""

    @patch("recce.core.load_context")
    def test_local_mode_no_emission_no_upload(self, mock_load_context, runner, tmp_path, tmp_db):
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

        put_urls: list[str] = []
        get_urls: list[str] = []
        emit_calls: list[tuple] = []

        def track_put(url, **kwargs):
            put_urls.append(url)
            return _make_mock_response(200)

        def track_get(url, **kwargs):
            get_urls.append(url)
            return _make_mock_response(200)

        def track_emit(adapter, info_path, lineage_diff_path):
            emit_calls.append((info_path, lineage_diff_path))

        with (
            patch("requests.put", side_effect=track_put),
            patch("requests.get", side_effect=track_get),
            patch("recce.util.info_emitter.emit_info_and_lineage_diff", side_effect=track_emit),
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

        assert result.exit_code == 0, result.output
        # Emitter must NOT be called in local mode
        assert emit_calls == [], f"emitter should not be called in local mode, got: {emit_calls}"
        # No uploads/downloads in local mode
        assert put_urls == [], f"unexpected PUT calls in local mode: {put_urls}"
        assert get_urls == [], f"unexpected GET calls in local mode: {get_urls}"
        # No "Emitting lineage metadata" banner
        assert "Emitting lineage metadata" not in result.output


# ---------------------------------------------------------------------------
# 4. Mode-switching / scratch-dir safety
# ---------------------------------------------------------------------------


class TestMetadataScratchDir:
    """Cloud mode uses a `recce-metadata-*` scratch dir and cleans it up on success."""

    @patch("recce.core.load_context")
    def test_scratch_dir_has_distinct_prefix_and_is_cleaned_up(self, mock_load_context, runner, tmp_path, tmp_db):
        """Prefix is `recce-metadata-` (distinct from A1's `recce-cll-`); cleaned on success."""
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "info_url": "https://s3.example.com/upload/info.json",
                "lineage_diff_url": "https://s3.example.com/upload/lineage_diff.json",
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

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=lambda *a, **kw: _make_mock_response(200)),
            patch("tempfile.mkdtemp", side_effect=tracking_mkdtemp),
            patch("recce.util.info_emitter.emit_info_and_lineage_diff", side_effect=_base_cloud_mocks()),
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
        # A scratch dir was created with the DRC-3296-specific prefix
        metadata_scratch_dirs = [d for d in dirs_created if Path(d).name.startswith("recce-metadata-")]
        assert metadata_scratch_dirs, f"no recce-metadata-* tempdir was created (got: {dirs_created})"
        # Prefix does NOT collide with A1's `recce-cll-` prefix.
        assert not any(Path(d).name.startswith("recce-cll-") for d in metadata_scratch_dirs)
        # Cleaned up after a successful upload
        for sd in metadata_scratch_dirs:
            assert not Path(sd).exists(), f"scratch dir {sd} should be cleaned up on success"


# ---------------------------------------------------------------------------
# 5. Partial emit failure: first file written, second write raises
# ---------------------------------------------------------------------------


class TestPartialEmitFailure:
    """Partial emit failure must surface in the upload summary, not a false
    'Cloud upload complete.' message.

    Scenario: ``emit_info_and_lineage_diff`` writes info.json successfully, then
    the second write (lineage_diff.json) raises (e.g. disk full). The caller's
    except arm resets both local paths to None. Without a guard in the upload
    loop the ``elif not metadata_upload_url`` branch never fires (URL IS
    present), and ``upload_failures`` stays empty — so the CLI falsely prints
    'Cloud upload complete.'.

    The fix: treat ``URL present + local file missing`` as a failure and
    append to ``upload_failures``.
    """

    @patch("recce.core.load_context")
    def test_partial_emit_failure_surfaces_in_summary(self, mock_load_context, runner, tmp_path, tmp_db):
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={"manifest_url": "https://s3.example.com/manifest.json"},
            base_download_urls={"manifest_url": "https://s3.example.com/base-manifest.json"},
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "info_url": "https://s3.example.com/upload/info.json",
                "lineage_diff_url": "https://s3.example.com/upload/lineage_diff.json",
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

        put_urls: list[str] = []

        def mock_put(url, **kwargs):
            put_urls.append(url)
            return _make_mock_response(200)

        def partial_emit_side_effect(adapter, info_path: Path, lineage_diff_path: Path):
            """Write info.json but raise before lineage_diff.json is written."""
            info_path.parent.mkdir(parents=True, exist_ok=True)
            info_path.write_bytes(b'{"adapter_type":"duckdb","lineage":{"nodes":{},"edges":[],"metadata":{}}}')
            # Simulate failure on the second write (e.g. disk full, serialization error).
            raise OSError("simulated disk full on lineage_diff.json write")

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=lambda *a, **kw: _make_mock_response(200, manifest_bytes)),
            patch("requests.put", side_effect=mock_put),
            patch("recce.util.info_emitter.emit_info_and_lineage_diff", side_effect=partial_emit_side_effect),
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

        # The emit-time warning is visible.
        assert "Failed to emit metadata artifacts" in result.output
        # Neither metadata artifact should have been PUT — both local paths are None.
        assert not any("info.json" in u for u in put_urls), f"info.json should not be uploaded: {put_urls}"
        assert not any(
            "lineage_diff.json" in u for u in put_urls
        ), f"lineage_diff.json should not be uploaded: {put_urls}"
        # The upload loop surfaces both missing artifacts as warnings.
        assert "Skipping upload of info.json" in result.output
        assert "Skipping upload of lineage_diff.json" in result.output
        # Final summary reflects the failure — NOT a misleading "Cloud upload complete.".
        assert "Cloud upload completed with warnings" in result.output
        assert "info.json" in result.output
        assert "lineage_diff.json" in result.output
        assert "Cloud upload complete." not in result.output
