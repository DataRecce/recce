import os

from recce.adapter.dbt_adapter import load_manifest, load_catalog, DbtAdapter

current_dir = os.path.dirname(os.path.abspath(__file__))


def test_load_lineage():
    manifest = load_manifest(path=os.path.join(current_dir, 'manifest.json'))
    assert manifest is not None

    catalog = load_catalog(path=os.path.join(current_dir, 'catalog.json'))
    assert catalog is not None

    dbt_adapter = DbtAdapter(curr_manifest=manifest)
    lineage = dbt_adapter.get_lineage()
    assert lineage is not None
    assert lineage['nodes']['model.jaffle_shop.orders'] is not None
    assert 'columns' not in lineage['nodes']['model.jaffle_shop.orders']

    dbt_adapter = DbtAdapter(curr_manifest=manifest, curr_catalog=catalog)
    lineage = dbt_adapter.get_lineage()
    assert lineage is not None
    assert len(lineage['nodes']['model.jaffle_shop.orders']['columns']) == 9
