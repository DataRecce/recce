import json
import os
import tempfile
from unittest import TestCase
from unittest.mock import MagicMock

import pytest

from recce.adapter.dbt_adapter import DbtAdapter, load_catalog, load_manifest
from recce.exceptions import UnsupportedDbtSchemaError

current_dir = os.path.dirname(os.path.abspath(__file__))


def _fusion_artifact(kind: str) -> dict:
    return {
        "metadata": {"dbt_schema_version": f"https://schemas.getdbt.com/dbt/{kind}/v20.json"},
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


class TestFusionManifestFailLoud(TestCase):
    """A v20 (dbt v2 / Fusion) artifact must fail loud with a Recce-branded message."""

    def _assert_friendly(self, exc_info):
        msg = str(exc_info.value)
        assert "Fusion" in msg
        assert "v20" in msg
        assert "not yet supported" in msg

    def test_load_manifest_v20_data_fails_loud(self):
        with pytest.raises(UnsupportedDbtSchemaError) as exc_info:
            load_manifest(data=_fusion_artifact("manifest"))
        self._assert_friendly(exc_info)

    def test_load_manifest_v20_path_fails_loud(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(_fusion_artifact("manifest"), f)
            path = f.name
        try:
            with pytest.raises(UnsupportedDbtSchemaError) as exc_info:
                load_manifest(path=path)
            self._assert_friendly(exc_info)
        finally:
            os.unlink(path)

    def test_load_catalog_v20_data_fails_loud(self):
        with pytest.raises(UnsupportedDbtSchemaError) as exc_info:
            load_catalog(data=_fusion_artifact("catalog"))
        self._assert_friendly(exc_info)

    def test_load_catalog_v20_path_fails_loud(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(_fusion_artifact("catalog"), f)
            path = f.name
        try:
            with pytest.raises(UnsupportedDbtSchemaError) as exc_info:
                load_catalog(path=path)
            self._assert_friendly(exc_info)
        finally:
            os.unlink(path)

    def test_v12_not_flagged_as_fusion(self):
        # A v12 manifest / v1 catalog is dbt 1.x, not Fusion — the guard must not fire,
        # regardless of which dbt version Recce is running against.
        from recce.adapter.dbt_adapter import _guard_unsupported_schema

        _guard_unsupported_schema("manifest", "https://schemas.getdbt.com/dbt/manifest/v12.json")
        _guard_unsupported_schema("catalog", "https://schemas.getdbt.com/dbt/catalog/v1.json")

    def test_old_incompatible_artifact_keeps_dbt_error(self):
        # v1 / v0 sit below the 1.x ceiling but dbt still rejects them as too old —
        # the guard must stay silent, not mislabel them as Fusion.
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
