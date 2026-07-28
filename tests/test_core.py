# noinspection PyUnresolvedReferences
import os
import tempfile
import unittest
from datetime import datetime

from recce.core import RecceContext
from recce.models import Check, Run, RunType
from recce.models.types import RunStatus
from recce.state import ArtifactsRoot, FileStateLoader, RecceState
from tests.adapter.dbt_adapter.conftest import dbt_test_helper  # noqa: F401

current_dir = os.path.dirname(os.path.abspath(__file__))


class TestRecceState(unittest.TestCase):
    def test_load(self):
        run = Run(type=RunType.QUERY, params=dict(sql_template="select * from users"))
        check = Check(name="check 1", description="desc 1", type=run.type, params=run.params)

        state = RecceState(runs=[run], checks=[check])
        json_content = state.to_json()
        new_state = RecceState.from_json(json_content)

        run_loaded = new_state.runs[0]
        check_loaded = new_state.checks[0]

        assert run.run_id == run_loaded.run_id
        assert check.check_id == check_loaded.check_id

    def test_merge_checks(self):
        check1 = Check(name="test1", description="", type="query")
        check2 = Check(name="test2", description="", type="query", updated_at=datetime(2000, 1, 1))
        check2_2 = Check(
            name="test2_2", description="", type="query", updated_at=datetime(2020, 1, 1), check_id=check2.check_id
        )
        check3 = Check(name="test3", description="", type="query")

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
        check1 = Check(
            name="test1",
            description="test1",
            type="query",
            params=dict(foo="bar"),
            updated_at=datetime(2000, 1, 1),
            is_preset=True,
        )
        check2 = Check(
            name="test2",
            description="test2",
            type="query",
            params=dict(foo="bar"),
            updated_at=datetime(2001, 1, 1),
            is_preset=True,
        )

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
        check1 = Check(name="test1", description="", type="query")
        check2 = Check(name="test2", description="", type="query")
        check2_2 = Check(name="test2_2", description="", type="query", check_id=check2.check_id)
        check3 = Check(name="test3", description="", type="query")

        context = RecceContext(checks=[check1, check2])
        state = RecceState(checks=[check2_2, check3], runs=[])
        context.import_state(state, merge=False)
        self.assertEqual(2, len(context.checks))
        self.assertEqual(check2_2.name, context.checks[0].name)

    def test_merge_runs(self):
        run1 = Run(type="query")
        run2 = Run(type="query")
        run3 = Run(type="query")

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

        with open(os.path.join(current_dir, "manifest.json"), "r") as f:
            manifest = json.load(f)
        manifest["metadata"]["generated_at"] = "2000-01-01T00:00:00Z"
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
        self.assertNotEqual(adapter.base_manifest.metadata.invocation_id, manifest.get("metadata").get("invocation_id"))

        manifest["metadata"]["generated_at"] = "2099-01-01T00:00:00Z"
        adapter.import_artifacts(artifacts)
        self.assertEqual(adapter.base_manifest.metadata.invocation_id, manifest.get("metadata").get("invocation_id"))

    def test_state_loader(self):
        expected_run = Run(
            type=RunType.ROW_COUNT_DIFF,
            name="Customers row count",
            params={"node_names": ["customers"]},
            result={"customers": {"base": 100, "curr": 50}},
            status=RunStatus.FINISHED,
        )
        expected_check = Check(
            name="Customers changed",
            description="Review the customer count",
            type=RunType.ROW_COUNT_DIFF,
            params={"node_names": ["customers"]},
            is_checked=True,
        )
        expected_state = RecceState(runs=[expected_run], checks=[expected_check])

        with tempfile.TemporaryDirectory() as temp_dir:
            state_file = os.path.join(temp_dir, "state.json")
            expected_state.to_file(state_file)
            state = FileStateLoader(state_file=state_file).load()

        self.assertIsInstance(state, RecceState)
        self.assertEqual(len(state.runs), 1)
        self.assertEqual(state.runs[0].run_id, expected_run.run_id)
        self.assertEqual(state.runs[0].type, RunType.ROW_COUNT_DIFF)
        self.assertEqual(state.runs[0].status, RunStatus.FINISHED)
        self.assertEqual(state.runs[0].params, {"node_names": ["customers"]})
        self.assertEqual(state.runs[0].result, {"customers": {"base": 100, "curr": 50}})
        self.assertEqual(len(state.checks), 1)
        self.assertEqual(state.checks[0].check_id, expected_check.check_id)
        self.assertEqual(state.checks[0].name, "Customers changed")
        self.assertEqual(state.checks[0].type, RunType.ROW_COUNT_DIFF)
        self.assertTrue(state.checks[0].is_checked)

    def test_state_loader_reads_legacy_v0_state_file(self):
        """A v0 state file written by recce 0.45 still loads completely.

        ``tests/recce_state.json`` is a real state file captured on 2024-12-06
        and is treated here as immutable historical input — never regenerated,
        because regenerating it would only prove that today's writer can read
        what today's writer wrote. The facts below are what a user upgrading
        recce would lose if a model changed incompatibly: every run and check,
        every run type in use at the time, and the dbt artifacts the lineage is
        rebuilt from.
        """
        state = FileStateLoader(state_file=os.path.join(current_dir, "recce_state.json")).load()

        self.assertEqual(state.metadata.schema_version, "v0")
        self.assertEqual(state.metadata.recce_version, "0.45.0.dev0")

        self.assertEqual(len(state.runs), 17)
        self.assertEqual(len(state.checks), 8)

        # Every run type this file exercises deserializes into the enum; a
        # dropped or renamed member would fail load, not just this assertion.
        self.assertEqual(
            {run.type for run in state.runs},
            {
                RunType.QUERY_DIFF,
                RunType.ROW_COUNT_DIFF,
                RunType.PROFILE_DIFF,
                RunType.VALUE_DIFF,
                RunType.VALUE_DIFF_DETAIL,
                RunType.TOP_K_DIFF,
                RunType.HISTOGRAM_DIFF,
            },
        )
        # Legacy runs carry their identity, params and results, not just a type.
        row_count_run = next(run for run in state.runs if run.type == RunType.ROW_COUNT_DIFF)
        self.assertIsNotNone(row_count_run.run_id)
        self.assertIsNotNone(row_count_run.params)
        self.assertIsNotNone(row_count_run.result)

        # Checks keep the review state the user curated.
        self.assertTrue(all(check.check_id is not None for check in state.checks))
        self.assertTrue(all(isinstance(check.name, str) and check.name for check in state.checks))
        self.assertTrue(any(check.is_checked for check in state.checks))

        # The dbt artifacts both environments were captured with still load,
        # which is what the lineage diff is rebuilt from on import.
        self.assertIsNotNone(state.artifacts)
        self.assertIn("manifest", state.artifacts.base)
        self.assertIn("manifest", state.artifacts.current)
        self.assertIsNotNone(state.artifacts.base["manifest"])
        self.assertIsNotNone(state.artifacts.current["manifest"])


def test_lineage_diff(dbt_test_helper):
    sql_model1 = """
    select a from T
    """

    sql_model2 = """
    select a from {{ ref("model1") }}
    """

    sql_model2_ = """
    select
    a,b
    from
    {{ ref("model1") }}
    """

    dbt_test_helper.create_model("model1", sql_model1, sql_model1)
    dbt_test_helper.create_model("model2", sql_model2, sql_model2_)
    result = dbt_test_helper.context.get_lineage_diff()
    nodediff = result.diff.get("model1")
    assert nodediff is None
    nodediff2 = result.diff.get("model2")
    assert nodediff2 is not None and nodediff2.change_status == "modified"


def test_get_merged_lineage_cached(dbt_test_helper):
    """DRC-3326: /api/info serves a cached merged lineage.

    The merge result must equal build_merged_lineage(get_lineage_diff()),
    be returned as the same cached instance on repeated calls, and be
    invalidated when artifacts change (refresh clears the cache).
    """
    from recce.models.lineage import build_merged_lineage

    sql_model1 = """
    select a from T
    """
    sql_model2 = """
    select a from {{ ref("model1") }}
    """
    dbt_test_helper.create_model("model1", sql_model1, sql_model1)
    dbt_test_helper.create_model("model2", sql_model2, sql_model2)

    adapter = dbt_test_helper.adapter

    # 1. Equivalence: cached merge == fresh merge of the lineage diff.
    expected = build_merged_lineage(adapter.get_lineage_diff())
    merged = adapter.get_merged_lineage()
    assert merged.model_dump(exclude_none=True, by_alias=True) == expected.model_dump(exclude_none=True, by_alias=True)

    # 2. Caching: repeated calls return the identical instance (no recompute).
    assert adapter.get_merged_lineage() is merged

    # 3. Invalidation: clearing the cache yields a freshly-built instance.
    adapter._get_merged_lineage_cached.cache_clear()
    assert adapter.get_merged_lineage() is not merged
