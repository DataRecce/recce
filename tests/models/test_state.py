import json

from recce.models import RunType, Run, RunDAO, CheckDAO, Check
from recce.models.state import RecceState
from recce.models.util import pydantic_model_json_dump


def test_load():
    state = RecceState()

    run = Run(type=RunType.QUERY, params=dict(sql_template='select * from users'))
    check = Check(name='check 1', description='desc 1', type=run.type, params=run.params)

    RunDAO(state).create(run)
    CheckDAO(state).create(check)

    json_data = pydantic_model_json_dump(state)
    new_state = RecceState(**json.loads(json_data))

    run_loaded = new_state.runs[0]
    check_loaded = new_state.checks[0]

    assert run.run_id == run_loaded.run_id
    assert check.check_id == check_loaded.check_id
