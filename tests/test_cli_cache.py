import os
import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from click.testing import CliRunner

from recce.cli import cli
from recce.util.cll import CllCache


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def tmp_db(tmp_path):
    return str(tmp_path / "test_cll_cache.db")


def _make_mock_node(
    resource_type: str = "model",
    raw_code: str = "SELECT 1",
    dep_nodes: list | None = None,
    checksum_value: str | None = None,
):
    """Create a mock dbt manifest node."""
    import hashlib

    node = MagicMock()
    node.resource_type = resource_type
    node.raw_code = raw_code
    node.depends_on.nodes = dep_nodes or []
    node.checksum.checksum = checksum_value or hashlib.sha256(raw_code.encode()).hexdigest()
    return node


def _make_mock_adapter(nodes: dict, base_manifest=None, curr_catalog=None, base_catalog=None):
    """Create a mock DbtAdapter with the given nodes in curr_manifest."""
    adapter = MagicMock()
    manifest = MagicMock()
    manifest.nodes = nodes
    manifest.metadata.adapter_type = "duckdb"
    adapter.curr_manifest = manifest
    adapter.base_manifest = base_manifest
    if base_manifest is not None:
        base_manifest.metadata.adapter_type = "duckdb"
    adapter.curr_catalog = curr_catalog
    adapter.base_catalog = base_catalog
    adapter.adapter.type.return_value = "duckdb"
    return adapter


def _setup_target_dir(tmp_path: Path) -> Path:
    """Create a minimal target/ directory with manifest.json."""
    target_dir = tmp_path / "target"
    target_dir.mkdir(exist_ok=True)
    (target_dir / "manifest.json").write_text("{}")
    return target_dir


class TestCacheStats:
    def test_stats_default_db_path(self, runner):
        """stats without --cache-db should use the default path."""
        with patch("recce.util.cll._DEFAULT_DB_PATH", "/nonexistent/path/cll_cache.db"):
            result = runner.invoke(cli, ["cache", "stats"])
        assert result.exit_code == 0
        assert "0 entries" in result.output

    def test_stats_no_db(self, runner, tmp_db):
        result = runner.invoke(cli, ["cache", "stats", "--cache-db", tmp_db])
        assert result.exit_code == 0
        assert "0 entries" in result.output

    def test_stats_with_entries(self, runner, tmp_db):
        c = CllCache(db_path=tmp_db)
        c.put_nodes_batch(
            [
                ("node.a", "key_a", '{"nodes": {}}'),
                ("node.b", "key_b", '{"nodes": {}}'),
                ("node.c", "key_c", '{"nodes": {}}'),
            ]
        )

        result = runner.invoke(cli, ["cache", "stats", "--cache-db", tmp_db])
        assert result.exit_code == 0
        assert "3 entries" in result.output
        assert "KB" in result.output


class TestCacheClear:
    def test_clear_default_db_path(self, runner):
        """clear without --cache-db should use the default path."""
        with patch("recce.util.cll._DEFAULT_DB_PATH", "/nonexistent/path/cll_cache.db"):
            result = runner.invoke(cli, ["cache", "clear"])
        assert result.exit_code == 0
        assert "No cache file" in result.output

    def test_clear_removes_db(self, runner, tmp_db):
        CllCache(db_path=tmp_db)
        assert os.path.exists(tmp_db)

        result = runner.invoke(cli, ["cache", "clear", "--cache-db", tmp_db])
        assert result.exit_code == 0
        assert "Deleted" in result.output
        assert not os.path.exists(tmp_db)

    def test_clear_no_db(self, runner, tmp_db):
        result = runner.invoke(cli, ["cache", "clear", "--cache-db", tmp_db])
        assert result.exit_code == 0
        assert "No cache file" in result.output

    def test_clear_removes_wal_shm(self, runner, tmp_db):
        """clear should also remove WAL and SHM sidecar files."""
        c = CllCache(db_path=tmp_db)
        c.put_nodes_batch([("node.a", "key_a", '{"nodes": {}}')])
        # Force WAL/SHM files to exist
        wal_path = tmp_db + "-wal"
        shm_path = tmp_db + "-shm"
        # Write dummy sidecar files (WAL mode creates these)
        Path(wal_path).touch()
        Path(shm_path).touch()

        result = runner.invoke(cli, ["cache", "clear", "--cache-db", tmp_db])
        assert result.exit_code == 0
        assert not os.path.exists(tmp_db)
        assert not os.path.exists(wal_path)
        assert not os.path.exists(shm_path)


class TestCacheClearErrors:
    def test_clear_permission_error(self, runner, tmp_db):
        """clear should report permission denied."""
        CllCache(db_path=tmp_db)
        assert os.path.exists(tmp_db)

        with patch("recce.cli.os.remove", side_effect=PermissionError("denied")):
            result = runner.invoke(cli, ["cache", "clear", "--cache-db", tmp_db])
        assert result.exit_code != 0
        assert "Permission denied" in result.output

    def test_clear_toctou_race(self, runner, tmp_db):
        """clear should handle file disappearing between exists() and remove()."""
        CllCache(db_path=tmp_db)
        assert os.path.exists(tmp_db)

        with patch("recce.cli.os.remove", side_effect=FileNotFoundError):
            result = runner.invoke(cli, ["cache", "clear", "--cache-db", tmp_db])
        assert result.exit_code == 0
        assert "already removed" in result.output

    def test_clear_generic_os_error(self, runner, tmp_db):
        """clear should report generic OS errors."""
        CllCache(db_path=tmp_db)
        assert os.path.exists(tmp_db)

        with patch("recce.cli.os.remove", side_effect=OSError("disk error")):
            result = runner.invoke(cli, ["cache", "clear", "--cache-db", tmp_db])
        assert result.exit_code != 0
        assert "Failed to delete" in result.output


class TestInit:
    def test_init_no_artifacts(self, runner, tmp_path, tmp_db):
        """init should exit gracefully when no dbt artifacts exist."""
        result = runner.invoke(
            cli,
            [
                "init",
                "--cache-db",
                tmp_db,
                "--project-dir",
                str(tmp_path),
            ],
        )
        assert result.exit_code == 0
        assert "No dbt artifacts found" in result.output

    @patch("recce.core.load_context")
    def test_init_cold_cache(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should compute CLL for all models and populate cache."""
        _setup_target_dir(tmp_path)

        nodes = {
            "model.test.a": _make_mock_node(raw_code="SELECT a FROM src"),
            "model.test.b": _make_mock_node(raw_code="SELECT b FROM src"),
        }
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        with patch(
            "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
            return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
        ):
            result = runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        assert "2 ok" in result.output
        assert "2 computed" in result.output
        # Verify cache was populated
        cache = CllCache(db_path=tmp_db)
        assert cache.stats["entries"] == 2

    @patch("recce.core.load_context")
    def test_init_warm_cache(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should report cache hits on second run."""
        _setup_target_dir(tmp_path)

        nodes = {
            "model.test.a": _make_mock_node(raw_code="SELECT a FROM src"),
            "model.test.b": _make_mock_node(raw_code="SELECT b FROM src"),
        }
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        with patch(
            "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
            return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
        ):
            # First run populates cache
            runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )
            # Second run should hit cache
            result = runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        assert "All 2 cached" in result.output

    @patch("recce.core.load_context")
    def test_init_computation_failure(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should count failed computations as skipped."""
        _setup_target_dir(tmp_path)

        nodes = {
            "model.test.a": _make_mock_node(raw_code="SELECT a FROM src"),
            "model.test.b": _make_mock_node(raw_code="SELECT b FROM src"),
        }
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.side_effect = RuntimeError("sqlglot error")

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        result = runner.invoke(
            cli,
            ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
            catch_exceptions=False,
        )

        assert result.exit_code == 0
        assert "2 skipped" in result.output
        assert "skip:" in result.output

    @patch("recce.core.load_context")
    def test_init_cll_returns_none(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should count None CLL results as skipped."""
        _setup_target_dir(tmp_path)

        nodes = {"model.test.a": _make_mock_node()}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.return_value = None

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        result = runner.invoke(
            cli,
            ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
            catch_exceptions=False,
        )

        assert result.exit_code == 0
        assert "1 skipped" in result.output

    @patch("recce.core.load_context")
    def test_init_filters_non_model_nodes(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should only process model and snapshot resource types."""
        _setup_target_dir(tmp_path)

        nodes = {
            "model.test.a": _make_mock_node(resource_type="model"),
            "test.test.t1": _make_mock_node(resource_type="test"),
            "seed.test.s1": _make_mock_node(resource_type="seed"),
        }
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        with patch(
            "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
            return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
        ):
            result = runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        # Only the model should be processed
        assert "1 ok" in result.output
        cache = CllCache(db_path=tmp_db)
        assert cache.stats["entries"] == 1

    @patch("recce.core.load_context")
    def test_init_load_context_error(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should report failure when load_context raises."""
        _setup_target_dir(tmp_path)
        mock_load_context.side_effect = RuntimeError("cannot load")

        result = runner.invoke(
            cli,
            ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
        )

        assert result.exit_code != 0
        assert "Failed to load context" in result.output

    @patch("recce.core.load_context")
    def test_init_single_env_message(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should display single-env message when only target/ exists."""
        _setup_target_dir(tmp_path)

        nodes = {"model.test.a": _make_mock_node()}
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        with patch(
            "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
            return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
        ):
            result = runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        assert "Only target/ found" in result.output

    @patch("recce.core.load_context")
    def test_init_batch_write_failure(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should warn when batch write to cache fails."""
        _setup_target_dir(tmp_path)

        nodes = {"model.test.a": _make_mock_node()}
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        with (
            patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ),
            patch.object(CllCache, "put_nodes_batch", return_value=False),
        ):
            result = runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        assert "Failed to write" in result.output

    @patch("recce.core.load_context")
    def test_init_base_only_env(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should handle only target-base/ existing."""
        base_dir = tmp_path / "target-base"
        base_dir.mkdir()
        (base_dir / "manifest.json").write_text("{}")

        nodes = {"model.test.a": _make_mock_node()}
        base_manifest = MagicMock()
        base_manifest.nodes = nodes
        adapter = _make_mock_adapter({}, base_manifest=base_manifest)
        adapter.curr_manifest = None
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        with patch(
            "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
            return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
        ):
            result = runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        assert "Only target-base/ found" in result.output
        assert "1 ok" in result.output

    @patch("recce.core.load_context")
    def test_init_with_catalog(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should include catalog column names in content key."""
        _setup_target_dir(tmp_path)

        nodes = {"model.test.a": _make_mock_node()}
        adapter = _make_mock_adapter(nodes)

        # Set up a catalog with columns
        catalog = MagicMock()
        cat_node = MagicMock()
        cat_node.columns = {"id": MagicMock(), "name": MagicMock()}
        catalog.nodes = {"model.test.a": cat_node}
        adapter.curr_catalog = catalog

        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        with patch(
            "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
            return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
        ):
            result = runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        assert "1 ok" in result.output
        cache = CllCache(db_path=tmp_db)
        assert cache.stats["entries"] == 1

    @patch("recce.core.load_context")
    def test_init_many_failures_truncated(self, mock_load_context, runner, tmp_path, tmp_db):
        """init should truncate error messages after 3 failures."""
        _setup_target_dir(tmp_path)

        nodes = {f"model.test.m{i}": _make_mock_node() for i in range(5)}
        adapter = _make_mock_adapter(nodes)
        adapter.get_cll_cached.side_effect = RuntimeError("parse error")

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        result = runner.invoke(
            cli,
            ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
            catch_exceptions=False,
        )

        assert result.exit_code == 0
        assert "5 skipped" in result.output
        assert "and 2 more skipped" in result.output

    def test_init_warns_missing_catalog(self, runner, tmp_path, tmp_db):
        """init should warn when catalog.json is missing."""
        _setup_target_dir(tmp_path)  # creates target/manifest.json but no catalog.json

        with patch("recce.core.load_context") as mock_load_context:
            nodes = {"model.test.a": _make_mock_node()}
            adapter = _make_mock_adapter(nodes)
            adapter.get_cll_cached.return_value = MagicMock()
            mock_ctx = MagicMock()
            mock_ctx.adapter = adapter
            mock_load_context.return_value = mock_ctx

            with patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ):
                result = runner.invoke(
                    cli,
                    ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                    catch_exceptions=False,
                )

        assert result.exit_code == 0
        assert "catalog.json not found" in result.output
        assert "dbt docs generate" in result.output

    def test_init_no_warning_when_catalog_exists(self, runner, tmp_path, tmp_db):
        """init should NOT warn when catalog.json exists."""
        target_dir = _setup_target_dir(tmp_path)
        (target_dir / "catalog.json").write_text("{}")

        with patch("recce.core.load_context") as mock_load_context:
            nodes = {"model.test.a": _make_mock_node()}
            adapter = _make_mock_adapter(nodes)
            adapter.get_cll_cached.return_value = MagicMock()
            mock_ctx = MagicMock()
            mock_ctx.adapter = adapter
            mock_load_context.return_value = mock_ctx

            with patch(
                "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
                return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
            ):
                result = runner.invoke(
                    cli,
                    ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                    catch_exceptions=False,
                )

        assert result.exit_code == 0
        assert "catalog.json not found" not in result.output


def _make_mock_cloud_client(
    session_info: dict | None = None,
    download_urls: dict | None = None,
    base_download_urls: dict | None = None,
    upload_urls: dict | None = None,
):
    """Create a mock RecceCloud client with sensible defaults."""
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


def _make_valid_cache_db_bytes() -> bytes:
    """Create a valid SQLite CLL cache database as bytes for testing warm-start downloads."""
    tmp_fd, tmp_name = tempfile.mkstemp(suffix=".db")
    os.close(tmp_fd)
    try:
        conn = sqlite3.connect(tmp_name)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute(
            "CREATE TABLE IF NOT EXISTS cll_cache "
            "(node_id TEXT, content_key TEXT, cll_json TEXT, last_used_at REAL, PRIMARY KEY (node_id))"
        )
        conn.commit()
        conn.close()
        return Path(tmp_name).read_bytes()
    finally:
        Path(tmp_name).unlink(missing_ok=True)
        # Also clean up WAL/SHM files
        Path(tmp_name + "-wal").unlink(missing_ok=True)
        Path(tmp_name + "-shm").unlink(missing_ok=True)


def _make_mock_response(status_code: int = 200, content: bytes = b"{}"):
    """Create a mock requests.Response with streaming support."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.content = content

    def _iter_content(chunk_size=8192):
        if content:
            for i in range(0, len(content), chunk_size):
                yield content[i : i + chunk_size]

    resp.iter_content = _iter_content
    return resp


class TestInitCloud:
    """Tests for `recce init --cloud` mode."""

    def test_init_cloud_missing_token(self, runner, tmp_path, tmp_db):
        """--cloud without --cloud-token or --api-token should error."""
        result = runner.invoke(
            cli,
            [
                "init",
                "--cloud",
                "--session-id",
                "sess-1",
                "--cache-db",
                tmp_db,
                "--project-dir",
                str(tmp_path),
            ],
        )
        assert result.exit_code == 1
        assert "requires --cloud-token" in result.output

    def test_init_cloud_missing_session_id(self, runner, tmp_path, tmp_db):
        """--cloud with token but no --session-id should error."""
        result = runner.invoke(
            cli,
            [
                "init",
                "--cloud",
                "--cloud-token",
                "ghp_testtoken",
                "--cache-db",
                tmp_db,
                "--project-dir",
                str(tmp_path),
            ],
        )
        assert result.exit_code == 1
        assert "requires --session-id" in result.output

    @patch("recce.cli.RecceCloud", create=True)
    def test_init_cloud_session_error(self, mock_cloud_cls, runner, tmp_path, tmp_db):
        """Session info returning error status should exit 1."""
        mock_client = _make_mock_cloud_client(
            session_info={"status": "error", "message": "Access denied"},
        )
        mock_cloud_cls.return_value = mock_client

        with patch("recce.util.recce_cloud.RecceCloud", mock_cloud_cls):
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
            )
        assert result.exit_code == 1
        assert "Failed to get session" in result.output

    @patch("recce.cli.RecceCloud", create=True)
    def test_init_cloud_missing_org_project(self, mock_cloud_cls, runner, tmp_path, tmp_db):
        """Session info without org_id/project_id should exit 1."""
        mock_client = _make_mock_cloud_client(
            session_info={"org_id": None, "project_id": None, "status": "active"},
        )
        mock_cloud_cls.return_value = mock_client

        with patch("recce.util.recce_cloud.RecceCloud", mock_cloud_cls):
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
            )
        assert result.exit_code == 1
        assert "missing org_id or project_id" in result.output

    @patch("recce.core.load_context")
    def test_init_cloud_downloads_artifacts(self, mock_load_context, runner, tmp_path, tmp_db):
        """Happy path: cloud mode downloads artifacts, computes CLL, uploads results."""
        manifest_bytes = b'{"nodes": {}}'
        catalog_bytes = b'{"nodes": {}}'
        cache_bytes = b""  # Empty cache = no warm start

        mock_client = _make_mock_cloud_client(
            download_urls={
                "manifest_url": "https://s3.example.com/manifest.json",
                "catalog_url": "https://s3.example.com/catalog.json",
                "cll_cache_url": "https://s3.example.com/cll_cache.db",
            },
            base_download_urls={
                "manifest_url": "https://s3.example.com/base-manifest.json",
                "catalog_url": "https://s3.example.com/base-catalog.json",
                "cll_cache_url": "https://s3.example.com/base-cll_cache.db",
            },
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "cll_cache_url": "https://s3.example.com/upload/cll_cache.db",
            },
        )

        # Mock requests.get for artifact downloads
        def mock_get(url, **kwargs):
            if "manifest" in url:
                return _make_mock_response(200, manifest_bytes)
            elif "catalog" in url:
                return _make_mock_response(200, catalog_bytes)
            elif "cll_cache" in url:
                return _make_mock_response(200, cache_bytes)
            return _make_mock_response(404)

        # Mock requests.put for uploads
        def mock_put(url, **kwargs):
            return _make_mock_response(200)

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        # build_full_cll_map returns a CllData-like object
        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {"model.test.a": MagicMock()}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

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

        assert result.exit_code == 0
        assert "Cloud upload complete" in result.output

    @patch("recce.core.load_context")
    def test_init_cloud_download_failure_warns(self, mock_load_context, runner, tmp_path, tmp_db):
        """HTTP 404 on artifact download should warn but continue."""
        mock_client = _make_mock_cloud_client(
            download_urls={
                "manifest_url": "https://s3.example.com/manifest.json",
                "catalog_url": "https://s3.example.com/catalog.json",
            },
            base_download_urls={},
        )

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        # All downloads return 404
        def mock_get(url, **kwargs):
            return _make_mock_response(404)

        with (
            patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client),
            patch("requests.get", side_effect=mock_get),
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
        assert "Failed to download" in result.output or "No dbt artifacts found" in result.output

    @patch("recce.core.load_context")
    def test_init_cloud_upload_failure_warns(self, mock_load_context, runner, tmp_path, tmp_db):
        """Upload returning HTTP 500 should warn but still exit 0."""
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={
                "manifest_url": "https://s3.example.com/manifest.json",
            },
            base_download_urls={
                "manifest_url": "https://s3.example.com/base-manifest.json",
            },
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "cll_cache_url": "https://s3.example.com/upload/cll_cache.db",
            },
        )

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {"model.test.a": MagicMock()}
        mock_cll_map.columns = {}
        mock_cll_map.model_dump.return_value = {"nodes": {}, "columns": {}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        def mock_get(url, **kwargs):
            return _make_mock_response(200, manifest_bytes)

        # Uploads return 500
        def mock_put(url, **kwargs):
            return _make_mock_response(500)

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

        assert result.exit_code == 0
        assert "Failed to upload" in result.output

    @patch("recce.core.load_context")
    def test_init_cloud_cll_map_build_failure(self, mock_load_context, runner, tmp_path, tmp_db):
        """build_full_cll_map raising exception should warn but still complete."""
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={
                "manifest_url": "https://s3.example.com/manifest.json",
            },
            base_download_urls={
                "manifest_url": "https://s3.example.com/base-manifest.json",
            },
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
                "cll_cache_url": "https://s3.example.com/upload/cll_cache.db",
            },
        )

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll
        adapter.build_full_cll_map.side_effect = RuntimeError("CLL map computation failed")

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        def mock_get(url, **kwargs):
            return _make_mock_response(200, manifest_bytes)

        def mock_put(url, **kwargs):
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

        assert result.exit_code == 0
        assert "Failed to build CLL map" in result.output

    def test_init_cloud_get_session_raises_recce_cloud_exception(self, runner, tmp_path, tmp_db):
        """get_session raising RecceCloudException (non-403 HTTP errors) should exit 1 cleanly."""
        from recce.util.recce_cloud import RecceCloudException

        mock_client = MagicMock()
        mock_client.get_session.side_effect = RecceCloudException(
            message="Failed to get session from Recce Cloud.",
            reason="Internal Server Error",
            status_code=500,
        )

        with patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client):
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
            )
        assert result.exit_code == 1
        assert "Failed to get session" in result.output

    @patch("recce.core.load_context")
    def test_init_cloud_warm_cache_from_current_session(self, mock_load_context, runner, tmp_path, tmp_db):
        """When current session has a CLL cache, it should be downloaded and used (no base fallback)."""
        manifest_bytes = b'{"nodes": {}}'
        cache_content = _make_valid_cache_db_bytes()

        mock_client = _make_mock_cloud_client(
            download_urls={
                "manifest_url": "https://s3.example.com/manifest.json",
                "cll_cache_url": "https://s3.example.com/cll_cache.db",
            },
            base_download_urls={
                "manifest_url": "https://s3.example.com/base-manifest.json",
                "cll_cache_url": "https://s3.example.com/base-cll_cache.db",
            },
        )

        def mock_get(url, **kwargs):
            if "base" not in url and "cll_cache" in url:
                return _make_mock_response(200, cache_content)
            elif "manifest" in url:
                return _make_mock_response(200, manifest_bytes)
            return _make_mock_response(404)

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
            patch("requests.get", side_effect=mock_get),
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
        assert "Downloaded CLL cache from session" in result.output
        # Should NOT fall back to base
        assert "Downloaded CLL cache from base session" not in result.output

    @patch("recce.core.load_context")
    def test_init_cloud_warm_cache_fallback_to_base(self, mock_load_context, runner, tmp_path, tmp_db):
        """When current session has no cache, base session cache should be used."""
        manifest_bytes = b'{"nodes": {}}'
        base_cache_content = _make_valid_cache_db_bytes()

        mock_client = _make_mock_cloud_client(
            download_urls={
                "manifest_url": "https://s3.example.com/manifest.json",
                # No cll_cache_url for current session
            },
            base_download_urls={
                "manifest_url": "https://s3.example.com/base-manifest.json",
                "cll_cache_url": "https://s3.example.com/base-cll_cache.db",
            },
        )

        def mock_get(url, **kwargs):
            if "base-cll_cache" in url:
                return _make_mock_response(200, base_cache_content)
            elif "manifest" in url:
                return _make_mock_response(200, manifest_bytes)
            return _make_mock_response(404)

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
            patch("requests.get", side_effect=mock_get),
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
        assert "Downloaded CLL cache from base session" in result.output

    @patch("recce.core.load_context")
    def test_init_cloud_no_cache_computes_from_scratch(self, mock_load_context, runner, tmp_path, tmp_db):
        """When neither session has a cache, the message should say computing from scratch."""
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={
                "manifest_url": "https://s3.example.com/manifest.json",
                # No cll_cache_url
            },
            base_download_urls={
                "manifest_url": "https://s3.example.com/base-manifest.json",
                # No cll_cache_url
            },
        )

        def mock_get(url, **kwargs):
            if "manifest" in url:
                return _make_mock_response(200, manifest_bytes)
            return _make_mock_response(404)

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
            patch("requests.get", side_effect=mock_get),
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
        assert "No existing CLL cache found" in result.output

    def test_init_cloud_session_id_from_env_var(self, runner, tmp_path, tmp_db):
        """RECCE_SESSION_ID env var should be accepted in place of --session-id."""
        mock_client = _make_mock_cloud_client(
            session_info={"org_id": None, "project_id": None, "status": "active"},
        )

        with patch("recce.util.recce_cloud.RecceCloud", return_value=mock_client):
            result = runner.invoke(
                cli,
                [
                    "init",
                    "--cloud",
                    "--cloud-token",
                    "ghp_testtoken",
                    # No --session-id flag — use env var instead
                    "--cache-db",
                    tmp_db,
                    "--project-dir",
                    str(tmp_path),
                ],
                env={"RECCE_SESSION_ID": "sess-from-env"},
            )
        # Should get past the "requires --session-id" check and reach session validation
        assert result.exit_code == 1
        assert "missing org_id or project_id" in result.output

    @patch("recce.core.load_context")
    def test_init_cloud_upload_partial_failure_shows_warning(self, mock_load_context, runner, tmp_path, tmp_db):
        """If one upload succeeds and one fails, message should indicate partial failure."""
        manifest_bytes = b'{"nodes": {}}'

        mock_client = _make_mock_cloud_client(
            download_urls={
                "manifest_url": "https://s3.example.com/manifest.json",
            },
            base_download_urls={
                "manifest_url": "https://s3.example.com/base-manifest.json",
            },
            upload_urls={
                "cll_map_url": "https://s3.example.com/upload/cll_map.json",
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

        def mock_get(url, **kwargs):
            return _make_mock_response(200, manifest_bytes)

        # CLL map upload succeeds, cache upload fails
        def mock_put(url, **kwargs):
            if "cll_map" in url:
                return _make_mock_response(200)
            return _make_mock_response(500)

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

        assert result.exit_code == 0
        assert "completed with warnings" in result.output
        assert "cll_cache.db" in result.output


class TestInitLocalCllMap:
    """Tests for cll_map.json generation in non-cloud (local) init."""

    @patch("recce.core.load_context")
    def test_init_local_creates_cll_map_json(self, mock_load_context, runner, tmp_path, tmp_db):
        """recce init (local) should create cll_map.json next to the cache db."""
        import json

        _setup_target_dir(tmp_path)

        nodes = {"model.test.a": _make_mock_node(raw_code="SELECT a FROM src")}
        adapter = _make_mock_adapter(nodes)
        mock_cll = MagicMock()
        adapter.get_cll_cached.return_value = mock_cll

        mock_cll_map = MagicMock()
        mock_cll_map.nodes = {"model.test.a": MagicMock()}
        mock_cll_map.columns = {"col_a": MagicMock()}
        mock_cll_map.model_dump.return_value = {"nodes": {"model.test.a": {}}, "columns": {"col_a": {}}}
        adapter.build_full_cll_map.return_value = mock_cll_map

        mock_ctx = MagicMock()
        mock_ctx.adapter = adapter
        mock_load_context.return_value = mock_ctx

        with patch(
            "recce.adapter.dbt_adapter.DbtAdapter._serialize_cll_data",
            return_value='{"nodes":{}, "columns":{}, "parent_map":{}}',
        ):
            result = runner.invoke(
                cli,
                ["init", "--cache-db", tmp_db, "--project-dir", str(tmp_path)],
                catch_exceptions=False,
            )

        assert result.exit_code == 0
        cll_map_path = Path(tmp_db).parent / "cll_map.json"
        assert cll_map_path.is_file(), "cll_map.json should be created next to cache db"
        data = json.loads(cll_map_path.read_text())
        assert "nodes" in data
        assert "columns" in data
        assert "CLL map saved to" in result.output


class TestServerCllCacheFlag:
    def test_enable_cll_cache_activates_sqlite_cache(self, tmp_db):
        """--enable-cll-cache should call set_cll_cache with a real db_path."""
        from recce.util.cll import CllCache, get_cll_cache, set_cll_cache

        # Save original and set a no-op cache
        original = get_cll_cache()
        set_cll_cache(CllCache())  # no db_path = no-op
        assert get_cll_cache()._db_path is None

        try:
            # Simulate what the server command does
            set_cll_cache(CllCache(db_path=tmp_db))
            cache = get_cll_cache()
            assert cache._db_path == tmp_db

            # Verify the cache is functional
            cache.put_node("model.x", "key_x", '{"test": true}')
            assert cache.get_node("model.x", "key_x") == '{"test": true}'
        finally:
            set_cll_cache(original)
