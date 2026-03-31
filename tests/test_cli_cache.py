import os
from pathlib import Path

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


class TestCacheStats:
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
