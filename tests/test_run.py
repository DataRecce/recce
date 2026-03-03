from recce.models.types import Run, RunType
from recce.run import run_should_be_approved


def _make_run(result=None, error=None, run_type=RunType.ROW_COUNT_DIFF):
    """Helper to create a Run with minimal required fields."""
    return Run(type=run_type, result=result, error=error)


class TestRunShouldBeApproved:
    """Tests for run_should_be_approved handling None values and edge cases."""

    def test_approve_matching_counts(self):
        run = _make_run(result={"customers": {"base": 100, "curr": 100}})
        assert run_should_be_approved(run) is True

    def test_reject_mismatched_counts(self):
        run = _make_run(result={"customers": {"base": 100, "curr": 200}})
        assert run_should_be_approved(run) is False

    def test_reject_none_base(self):
        run = _make_run(result={"customers": {"base": None, "curr": 100}})
        assert run_should_be_approved(run) is False

    def test_reject_none_curr(self):
        run = _make_run(result={"customers": {"base": 100, "curr": None}})
        assert run_should_be_approved(run) is False

    def test_reject_both_none(self):
        """Critical: both-None must NOT be auto-approved (None != None is False)."""
        run = _make_run(result={"customers": {"base": None, "curr": None}})
        assert run_should_be_approved(run) is False

    def test_reject_none_result(self):
        run = _make_run(result=None)
        assert run_should_be_approved(run) is False

    def test_reject_error(self):
        run = _make_run(result={"customers": {"base": 100, "curr": 100}}, error="some error")
        assert run_should_be_approved(run) is False

    def test_reject_non_row_count_type(self):
        run = _make_run(result={"customers": {"base": 100, "curr": 100}}, run_type=RunType.QUERY_DIFF)
        assert run_should_be_approved(run) is False

    def test_approve_multiple_nodes_all_matching(self):
        run = _make_run(
            result={
                "customers": {"base": 100, "curr": 100},
                "orders": {"base": 200, "curr": 200},
            }
        )
        assert run_should_be_approved(run) is True

    def test_reject_multiple_nodes_one_none(self):
        run = _make_run(
            result={
                "customers": {"base": 100, "curr": 100},
                "orders": {"base": None, "curr": 200},
            }
        )
        assert run_should_be_approved(run) is False
