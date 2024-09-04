# add the RecceState test case
import os
import unittest

from recce.models import Check, Run
from recce.state import RecceState, ArtifactsRoot

current_dir = os.path.dirname(os.path.abspath(__file__))


class TestRecceState(unittest.TestCase):
    def test_merge_check(self):
        check1 = Check(name='test1', description='', type='query')
        check2 = Check(name='test2', description='', type='query')
        check2_2 = Check(name='test2_2', description='', type='query', check_id=check2.check_id)
        check3 = Check(name='test3', description='', type='query')

        state = RecceState(checks=[])
        state._merge_check(check1)
        self.assertEqual(len(state.checks), 1)
        self.assertEqual(state.checks[0].check_id, check1.check_id)

        state = RecceState(checks=[check1, check2])
        state._merge_check(check2_2)
        state._merge_check(check3)
        self.assertEqual(len(state.checks), 3)
        self.assertEqual(state.checks[1].check_id, check2.check_id)
        self.assertEqual(state.checks[1].name, check2_2.name)

    def test_merge_run(self):
        run1 = Run(type='query')
        run2 = Run(type='query')
        run3 = Run(type='query')

        state = RecceState(runs=[])
        state._merge_run(run1)
        self.assertEqual(len(state.runs), 1)

        state = RecceState(runs=[run1, run2])
        state._merge_run(run2)
        state._merge_run(run3)
        self.assertEqual(len(state.runs), 3)

    def test_merge_artifacts(self):
        import json
        import os
        # load json from ./manifest.json

        with open(os.path.join(current_dir, 'manifest.json'), 'r') as f:
            manifest = json.load(f)
        with open(os.path.join(current_dir, 'catalog.json'), 'r') as f:
            catalog = json.load(f)

        artifacts1 = ArtifactsRoot(
            base=dict(
                manifest=manifest,
                catalog=catalog,
            )
        )
        artifacts2 = ArtifactsRoot(
            current=dict(
                manifest=manifest,
                catalog=catalog,
            )
        )

        artifacts1.merge(artifacts2)
        self.assertEqual(artifacts1.base['manifest'], manifest)
        self.assertEqual(artifacts1.base['catalog'], catalog)
        self.assertEqual(artifacts1.current['manifest'], manifest)
        self.assertEqual(artifacts1.current['catalog'], catalog)




