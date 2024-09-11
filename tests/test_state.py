# add the RecceState test case
import os
import unittest
from datetime import datetime

from recce.core import RecceContext
from recce.models import Check, Run
from recce.state import RecceState, ArtifactsRoot

current_dir = os.path.dirname(os.path.abspath(__file__))


class TestRecceState(unittest.TestCase):
    def test_merge_checks(self):
        check1 = Check(name='test1', description='', type='query')
        check2 = Check(name='test2', description='', type='query',
                       updated_at=datetime(2000, 1, 1))
        check2_2 = Check(name='test2_2', description='', type='query',
                         updated_at=datetime(2020, 1, 1),
                         check_id=check2.check_id)
        check3 = Check(name='test3', description='', type='query')

        context = RecceContext()
        state = RecceState(checks=[check1], runs=[])
        context.import_state(state)
        self.assertEqual(1, len(context.checks))
        self.assertEqual(check1.name, context.checks[0].name)

        context = RecceContext(checks=[check1, check2])
        state = RecceState(checks=[check1, check2_2, check3], runs=[])
        context.import_state(state)
        self.assertEqual(3, len(context.checks))
        self.assertEqual(check2_2.name, context.checks[1].name)

    def test_merge_preset_checks(self):
        check1 = Check(name='test1', description='test1', type='query', params=dict(foo='bar'),
                       updated_at=datetime(2000, 1, 1), is_preset=True)
        check2 = Check(name='test2', description='test2', type='query', params=dict(foo='bar'),
                       updated_at=datetime(2001, 1, 1), is_preset=True)

        context = RecceContext(checks=[check1])
        state = RecceState(checks=[check2], runs=[])
        context.import_state(state)
        self.assertEqual(1, len(context.checks))
        self.assertEqual(check2.name, context.checks[0].name)

        context = RecceContext(checks=[check2])
        state = RecceState(checks=[check1], runs=[])
        context.import_state(state)
        self.assertEqual(1, len(context.checks))
        self.assertEqual(check2.name, context.checks[0].name)

    def test_revert_checks(self):
        check1 = Check(name='test1', description='', type='query')
        check2 = Check(name='test2', description='', type='query')
        check2_2 = Check(name='test2_2', description='', type='query', check_id=check2.check_id)
        check3 = Check(name='test3', description='', type='query')

        context = RecceContext(checks=[check1, check2])
        state = RecceState(checks=[check2_2, check3], runs=[])
        context.import_state(state, merge=False)
        self.assertEqual(2, len(context.checks))
        self.assertEqual(check2_2.name, context.checks[0].name)

    def test_merge_runs(self):
        run1 = Run(type='query')
        run2 = Run(type='query')
        run3 = Run(type='query')

        context = RecceContext(runs=[])
        state = RecceState(runs=[run1])
        context.import_state(state)
        self.assertEqual(1, len(context.runs))

        context = RecceContext(runs=[run1, run2])
        state = RecceState(runs=[run2, run3])
        context.import_state(state)
        self.assertEqual(3, len(context.runs))

    def test_merge_dbt_artifacts(self):
        import json
        import os
        with open(os.path.join(current_dir, 'manifest.json'), 'r') as f:
            manifest = json.load(f)
        manifest['metadata']['generated_at'] = '2000-01-01T00:00:00Z'
        artifacts = ArtifactsRoot(
            base=dict(
                manifest=manifest,
            ),
            current=dict(
                manifest=manifest,
            ),
        )

        from tests.adapter.dbt_adapter.dbt_test_helper import DbtTestHelper
        adapter = DbtTestHelper().adapter
        adapter.import_artifacts(artifacts)
        self.assertNotEqual(adapter.base_manifest.metadata.invocation_id, manifest.get('metadata').get('invocation_id'))

        manifest['metadata']['generated_at'] = '2099-01-01T00:00:00Z'
        adapter.import_artifacts(artifacts)
        self.assertEqual(adapter.base_manifest.metadata.invocation_id, manifest.get('metadata').get('invocation_id'))
