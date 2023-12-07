import os

import pytest

import recce.dbt as dbt
from packaging import version

current_dir = os.path.dirname(os.path.abspath(__file__))


@pytest.mark.skipif(dbt.dbt_version < version.parse('v1.6'), reason='skip manifest test before dbt-core 1.6')
def test_load_lineage():
    manifest = dbt.load_manifest(os.path.join(current_dir, 'manifest.json'))
    assert manifest is not None

    catalog = dbt.load_catalog(os.path.join(current_dir, 'catalog.json'))
    assert catalog is not None

    dbt_context = dbt.DBTContext(curr_manifest=manifest)
    lineage = dbt_context.get_lineage()
    assert lineage is not None
    assert lineage['nodes']['model.jaffle_shop.orders'] is not None
    assert 'columns' not in lineage['nodes']['model.jaffle_shop.orders']

    dbt_context = dbt.DBTContext(curr_manifest=manifest, curr_catalog=catalog)
    lineage = dbt_context.get_lineage()
    assert lineage is not None
    assert len(lineage['nodes']['model.jaffle_shop.orders']['columns']) == 16
