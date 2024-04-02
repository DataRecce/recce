from recce.models import RunType, Run, Check
from recce.state import RecceState


def test_load():
    run = Run(type=RunType.QUERY, params=dict(sql_template='select * from users'))
    check = Check(name='check 1', description='desc 1', type=run.type, params=run.params)

    state = RecceState(runs=[run], checks=[check])
    json_content = state.to_json()
    new_state = RecceState.from_json(json_content)

    run_loaded = new_state.runs[0]
    check_loaded = new_state.checks[0]

    assert run.run_id == run_loaded.run_id
    assert check.check_id == check_loaded.check_id
