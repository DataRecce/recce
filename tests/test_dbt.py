import os
from unittest import TestCase
from unittest.mock import patch, MagicMock

from recce.adapter.dbt_adapter import load_manifest, load_catalog, DbtAdapter
from recce.exceptions import RecceException
from recce.util.cll import ColumnLevelDependencyColumn, ColumnLevelDependsOn

current_dir = os.path.dirname(os.path.abspath(__file__))


class TestAdapterLineage(TestCase):
    def setUp(self) -> None:
        self.manifest = load_manifest(path=os.path.join(current_dir, 'manifest.json'))
        assert self.manifest is not None

        self.catalog = load_catalog(path=os.path.join(current_dir, 'catalog.json'))
        assert self.catalog is not None

        # no cll in this test
        self.patcher_append_column_lineage = patch.object(DbtAdapter, 'append_column_lineage')
        self.patcher_append_column_lineage.start()

    def tearDown(self):
        self.patcher_append_column_lineage.stop()

    def test_load_lineage(self):
        dbt_adapter = DbtAdapter(curr_manifest=self.manifest)
        lineage = dbt_adapter.get_lineage()
        assert lineage is not None
        assert lineage['nodes']['model.jaffle_shop.orders'] is not None
        assert 'columns' not in lineage['nodes']['model.jaffle_shop.orders']

    def test_load_lineage_with_catalog(self):
        mock_adapter = MagicMock()
        mock_adapter.type.return_value = None

        dbt_adapter = DbtAdapter(curr_manifest=self.manifest, curr_catalog=self.catalog)
        dbt_adapter.adapter = mock_adapter
        lineage = dbt_adapter.get_lineage()
        assert lineage is not None
        assert len(lineage['nodes']['model.jaffle_shop.orders']['columns']) == 9


class TestAdapterColumnLineage(TestCase):

    def setUp(self) -> None:
        manifest = load_manifest(path=os.path.join(current_dir, 'manifest.json'))
        self.dbt_adapter = DbtAdapter(curr_manifest=manifest)
        self.patcher_generate_sql = patch.object(self.dbt_adapter, 'generate_sql')
        self.mock_generate_sql = self.patcher_generate_sql.start()

        self.mock_adapter = MagicMock()
        self.dbt_adapter.adapter = self.mock_adapter
        self.mock_adapter.type.return_value = None

        # mock 'is_python_model' per test case, default to False
        self.patcher_is_python_model = patch.object(self.dbt_adapter, 'is_python_model', return_value=False)
        self.mock_is_python_model = self.patcher_is_python_model.start()

        # mock return value per test case
        self.patcher_cll = patch('recce.adapter.dbt_adapter.cll')
        self.mock_cll = self.patcher_cll.start()

    def tearDown(self):
        self.patcher_generate_sql.stop()
        self.patcher_is_python_model.stop()
        self.patcher_cll.stop()

    def test_is_python_model(self):
        self.assertFalse(self.dbt_adapter.is_python_model('model.jaffle_shop.orders'))

    def test_seed(self):
        nodes = {
            'seed1': {
                'id': 'seed1',
                'name': 'seed1',
                'resource_type': 'seed',
                'raw_code': None,
                'columns': {
                    'a': {
                        'name': 'a',
                        'type': 'int'
                    },
                }
            }
        }
        parents_map = {
            'seed1': []
        }

        self.dbt_adapter.append_column_lineage(nodes, parents_map)
        self.assertEqual(nodes['seed1']['columns']['a']['transformation_type'], 'source')
        self.assertEqual(nodes['seed1']['columns']['a']['depends_on'], [])

    def test_source(self):
        nodes = {
            'source1': {
                'id': 'source1',
                'name': 'source1',
                'resource_type': 'source',
                'raw_code': None,
                'columns': {
                    'a': {
                        'name': 'a',
                        'type': 'int'
                    },
                }
            }
        }
        parents_map = {
            'source1': []
        }

        self.dbt_adapter.append_column_lineage(nodes, parents_map)
        self.assertEqual(nodes['source1']['columns']['a']['transformation_type'], 'source')
        self.assertEqual(nodes['source1']['columns']['a']['depends_on'], [])

    def test_python_model(self):
        nodes = {
            'py_model': {
                'id': 'py_model',
                'name': 'py_model',
                'resource_type': 'model',
                'raw_code': """
                    def model(dbt, session):
                        dbt.config(materialized = "table")
                        df = dbt.ref("customers")
                        return df
                """,
                'columns': {
                    'a': {
                        'name': 'a',
                        'type': 'int'
                    },
                }
            }
        }
        parents_map = {
            'py_model': ['model.jaffle_shop.customers']
        }

        self.mock_is_python_model.return_value = True
        self.dbt_adapter.append_column_lineage(nodes, parents_map)
        self.assertEqual(nodes['py_model']['columns']['a']['transformation_type'], 'unknown')
        self.assertEqual(nodes['py_model']['columns']['a']['depends_on'], [])

    def test_model(self):
        nodes = {
            'model1': {
                'id': 'model1',
                'name': 'model1',
                'resource_type': 'model',
                'raw_code': 'select * from model2',
                'columns': {
                    'a': {
                        'name': 'a',
                        'type': 'int'
                    },
                }
            }
        }
        parents_map = {
            'model1': ['model2']
        }

        self.mock_cll.return_value = {'a': ColumnLevelDependencyColumn(
            type='passthrough',
            depends_on=[ColumnLevelDependsOn(node='model2', column='a')]
        )}
        self.dbt_adapter.append_column_lineage(nodes, parents_map)
        self.assertEqual(nodes['model1']['columns']['a']['transformation_type'], 'passthrough')
        self.assertEqual(nodes['model1']['columns']['a']['depends_on'][0].node, 'model2')
        self.assertEqual(nodes['model1']['columns']['a']['depends_on'][0].column, 'a')

    def test_model_parse_error(self):
        nodes = {
            'model1': {
                'id': 'model1',
                'name': 'model1',
                'resource_type': 'model',
                'raw_code': 'select * from model2',
                'columns': {
                    'a': {
                        'name': 'a',
                        'type': 'int'
                    },
                }
            }
        }
        parents_map = {
            'model1': ['model2']
        }

        self.mock_cll.side_effect = RecceException('Failed to parse SQL')
        self.dbt_adapter.append_column_lineage(nodes, parents_map)
        self.assertEqual(nodes['model1']['columns']['a']['transformation_type'], 'unknown')
        self.assertEqual(nodes['model1']['columns']['a']['depends_on'], [])

    def test_model_without_catalog(self):
        # no 'columns' key in node
        nodes = {
            'model1': {
                'id': 'model1',
                'name': 'model1',
                'resource_type': 'model',
                'raw_code': 'select * from model2',
            }
        }
        parents_map = {
            'model1': ['model2']
        }

        self.dbt_adapter.append_column_lineage(nodes, parents_map)
        self.assertIsNone(nodes['model1'].get('columns'))
