import os
from unittest import TestCase
from unittest.mock import MagicMock

from recce.adapter.dbt_adapter import DbtAdapter, load_catalog, load_manifest

current_dir = os.path.dirname(os.path.abspath(__file__))


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
