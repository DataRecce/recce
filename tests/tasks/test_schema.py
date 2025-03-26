import os
from unittest import TestCase
from unittest.mock import MagicMock

import pytest

from recce.adapter.dbt_adapter import load_manifest, load_catalog, DbtAdapter
from recce.core import RecceContext, set_default_context
from recce.run import schema_diff_should_be_approved


def test_validator():
    from recce.tasks.schema import SchemaDiffCheckValidator
    validator = SchemaDiffCheckValidator()

    def validate(params: dict):
        validator.validate({
            'name': 'test',
            'type': 'schema_diff',
            'params': params,
        })

    # Select all models
    validate({})

    # Select by node name
    validate({
        'node_id': 'abc',
    })
    validate({
        'node_id': ['abc'],
    })

    # Select by selector
    validate({
        'select': 'customers',
        'exclude': 'customers',
        'packages': ['jaffle_shop'],
        'view_mode': 'all',
    })

    # packages should be an array
    with pytest.raises(ValueError):
        validate({
            'packages': 'jaffle_shop',
        })

    # view_mode should be 'all' or 'changed_models'
    validate({
        'view_mode': None,
    })
    validate({
        'view_mode': 'all',
    })
    with pytest.raises(ValueError):
        validate({
            'view_mode': 'abc',
        })


test_root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestSchemaDiffAutoApprove(TestCase):

    def setUp(self):
        self.default_context = MagicMock(spec=RecceContext)
        manifest = load_manifest(path=os.path.join(test_root_path, 'manifest.json'))
        catalog = load_catalog(path=os.path.join(test_root_path, 'catalog.json'))
        dbt_adapter = DbtAdapter(curr_manifest=manifest, curr_catalog=catalog)
        self.default_context.adapter = dbt_adapter

        dbt_adapter.adapter = MagicMock()
        dbt_adapter.adapter.type.return_value = None

        dbt_adapter.select_nodes = MagicMock()
        # Base and Current will be the same
        self.default_context.get_lineage.return_value = dbt_adapter.get_lineage()
        set_default_context(self.default_context)

    def test_schema_diff_should_be_approved(self):
        # Node_id is string
        is_approved = schema_diff_should_be_approved({
            'node_id': 'model.jaffle_shop.customers',
        })
        assert is_approved is True

        # Node_id is list
        is_approved = schema_diff_should_be_approved({
            'node_id': ['model.jaffle_shop.customers'],
        })
        assert is_approved is True

        # Select all models
        self.default_context.adapter.select_nodes.return_value = ['model.jaffle_shop.customers']
        is_approved = schema_diff_should_be_approved({
            'select': 'customers',
        })
        assert is_approved is True
