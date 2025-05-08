import os
from uuid import UUID

from recce.apis.run_func import materialize_run_results
from recce.state import RecceState

current_dir = os.path.dirname(os.path.abspath(__file__))


def test_materialize_run_results():
    path = os.path.join(os.path.join(current_dir, "row_count_diff.json"))
    state = RecceState.from_file(path)
    result = materialize_run_results(state.runs)

    node_result = result["customers"]["row_count_diff"]
    assert node_result["run_id"] == UUID("92f31d63-0758-46af-a674-0e969208ec96")
    assert node_result["result"]["base"] == 1856
    assert node_result["result"]["curr"] == 1856

    result = materialize_run_results(state.runs, nodes=["xyz"])
    assert result == {}
