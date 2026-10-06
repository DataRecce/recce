import json
import os
import subprocess
import sys
import tempfile
from unittest import TestCase
from unittest.mock import MagicMock

import pytest

from recce.adapter.dbt_adapter import DbtAdapter, load_catalog, load_manifest
from recce.exceptions import UnsupportedDbtSchemaError

current_dir = os.path.dirname(os.path.abspath(__file__))


_ABOVE_CEILING = {"manifest": 13, "catalog": 2}


def _newer_artifact(kind: str) -> dict:
    return {
        "metadata": {"dbt_schema_version": f"https://schemas.getdbt.com/dbt/{kind}/v{_ABOVE_CEILING[kind]}.json"},
    }


class TestAdapterLineage(TestCase):
    def setUp(self) -> None:
        self.manifest = load_manifest(path=os.path.join(current_dir, "manifest.json"))
        assert self.manifest is not None

        self.catalog = load_catalog(path=os.path.join(current_dir, "catalog.json"))
        assert self.catalog is not None

    def tearDown(self):
        pass

    def test_load_lineage(self):
        dbt_adapter = DbtAdapter(curr_manifest=self.manifest)
        lineage = dbt_adapter.get_lineage()
        assert lineage is not None
        assert lineage["nodes"]["model.jaffle_shop.orders"] is not None
        assert "columns" not in lineage["nodes"]["model.jaffle_shop.orders"]

    def test_load_lineage_with_catalog(self):
        mock_adapter = MagicMock()
        mock_adapter.type.return_value = None

        dbt_adapter = DbtAdapter(curr_manifest=self.manifest, curr_catalog=self.catalog)
        dbt_adapter.adapter = mock_adapter
        lineage = dbt_adapter.get_lineage()
        assert lineage is not None
        assert len(lineage["nodes"]["model.jaffle_shop.orders"]["columns"]) == 9


class TestNewerSchemaFailLoud(TestCase):
    def _assert_friendly(self, exc_info, kind):
        msg = str(exc_info.value)
        assert f"v{_ABOVE_CEILING[kind]}" in msg
        assert "newer than Recce supports" in msg

    def test_load_manifest_newer_data_fails_loud(self):
        with pytest.raises(UnsupportedDbtSchemaError) as exc_info:
            load_manifest(data=_newer_artifact("manifest"))
        self._assert_friendly(exc_info, "manifest")

    def test_load_manifest_newer_path_fails_loud(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(_newer_artifact("manifest"), f)
            path = f.name
        try:
            with pytest.raises(UnsupportedDbtSchemaError) as exc_info:
                load_manifest(path=path)
            self._assert_friendly(exc_info, "manifest")
        finally:
            os.unlink(path)

    def test_load_catalog_newer_data_fails_loud(self):
        with pytest.raises(UnsupportedDbtSchemaError) as exc_info:
            load_catalog(data=_newer_artifact("catalog"))
        self._assert_friendly(exc_info, "catalog")

    def test_load_catalog_newer_path_fails_loud(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(_newer_artifact("catalog"), f)
            path = f.name
        try:
            with pytest.raises(UnsupportedDbtSchemaError) as exc_info:
                load_catalog(path=path)
            self._assert_friendly(exc_info, "catalog")
        finally:
            os.unlink(path)

    def test_supported_schema_not_flagged(self):
        from recce.adapter.dbt_adapter import _guard_unsupported_schema

        _guard_unsupported_schema("manifest", "https://schemas.getdbt.com/dbt/manifest/v12.json")
        _guard_unsupported_schema("catalog", "https://schemas.getdbt.com/dbt/catalog/v1.json")

    def test_old_incompatible_artifact_keeps_dbt_error(self):
        from recce.adapter.dbt_adapter import IncompatibleSchemaError

        for loader, kind, version in [(load_manifest, "manifest", 1), (load_catalog, "catalog", 0)]:
            artifact = {
                "metadata": {"dbt_schema_version": f"https://schemas.getdbt.com/dbt/{kind}/v{version}.json"},
            }
            with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
                json.dump(artifact, f)
                path = f.name
            try:
                with pytest.raises(IncompatibleSchemaError):
                    loader(path=path)
            finally:
                os.unlink(path)


def _import_dbt_adapter(fake_packages_dir) -> subprocess.CompletedProcess:
    pythonpath = os.pathsep.join(p for p in [str(fake_packages_dir), os.environ.get("PYTHONPATH")] if p)
    return subprocess.run(
        [sys.executable, "-c", "import recce.adapter.dbt_adapter"],
        env={**os.environ, "PYTHONPATH": pythonpath},
        capture_output=True,
        text=True,
    )


def test_dbt_v2_import_names_dbt_v2(tmp_path):
    (tmp_path / "dbt").mkdir()
    (tmp_path / "dbt" / "__init__.py").write_text("")
    (tmp_path / "dbt" / "_core.py").write_text("")

    result = _import_dbt_adapter(tmp_path)

    assert result.returncode != 0
    assert "DbtUnavailableError: Recce supports dbt-core 1.x. dbt v2 (Fusion) is not supported yet." in result.stderr


def test_unexpected_import_error_keeps_original_error(tmp_path):
    (tmp_path / "agate.py").write_text("raise ImportError(\"cannot import name 'MappedSequence' from 'agate'\")")

    result = _import_dbt_adapter(tmp_path)

    assert result.returncode != 0
    assert "ImportError: cannot import name 'MappedSequence' from 'agate'" in result.stderr
    assert "DbtUnavailableError" not in result.stderr
