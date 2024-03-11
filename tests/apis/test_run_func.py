import os

from recce.apis.run_func import materialize_run_results
from recce.models.state import RecceState

current_dir = os.path.dirname(os.path.abspath(__file__))


def test_something():
    os.path.join(os.path.join(current_dir, "row_count_diff.json"))
    state = RecceState.load("row_count_diff.json")
    result = materialize_run_results(state.runs)

    node_result = result['customers']['row_count_diff']

    node_result['run_id'] == '92f31d63-0758-46af-a674-0e969208ec96'
    node_result['result']['base'] == 1856
    node_result['result']['curr'] == 1856
