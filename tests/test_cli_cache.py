import os
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


def _make_mock_node(resource_type: str = "model", raw_code: str = "SELECT 1", dep_nodes: list | None = None):
    """Create a mock dbt manifest node."""
    node = MagicMock()
    node.resource_type = resource_type
    node.raw_code = raw_code
    node.depends_on.nodes = dep_nodes or []
    return node


def _make_mock_adapter(nodes: dict, base_manifest=None, curr_catalog=None, base_catalog=None):
    """Create a mock DbtAdapter with the given nodes in curr_manifest."""
    adapter = MagicMock()
    manifest = MagicMock()
    manifest.nodes = nodes
    adapter.curr_manifest = manifest
    adapter.base_manifest = base_manifest
    adapter.curr_catalog = curr_catalog
    adapter.base_catalog = base_catalog
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

    def test_clear_sidecar_os_error(self, runner, tmp_db):
        """clear should succeed even if sidecar file deletion fails."""
        CllCache(db_path=tmp_db)
        wal_path = tmp_db + "-wal"
        Path(wal_path).touch()

        original_remove = os.remove

        def selective_remove(path):
            if path.endswith("-wal"):
                raise OSError("device busy")
            return original_remove(path)

        with patch("recce.cli.os.remove", side_effect=selective_remove):
            result = runner.invoke(cli, ["cache", "clear", "--cache-db", tmp_db])
        assert result.exit_code == 0
        assert "Deleted" in result.output
        # WAL still exists because removal failed
        assert os.path.exists(wal_path)


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
        assert "0 skipped" in result.output
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
        assert "2 hits" in result.output
        assert "0 new" in result.output

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
