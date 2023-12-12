from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.apis import Run, checks_db, runs_db
from recce.apis.types import RunParams, RunType, RunResultType

run_router = APIRouter(tags=['run'])


class SubmitRunIn(BaseModel):
    type: str
    params: RunParams
    check_id: Optional[str]


@run_router.post("/runs", status_code=201)
async def submit_run(run: SubmitRunIn):
    from recce.apis.run_func import exec_run

    result = {
        'result_type': None,
        'current': None,
        'base': None,
        'current_error': None,
        'base_error': None
    }
    run_record = None
    run_type = RunType(run.type)
    if run.check_id is None:
        if run_type == RunType.QUERY_DIFF:
            result['base'], result['base_error'] = exec_run(run.params, base=True)
            result['current'], result['current_error'] = exec_run(run.params, base=False)
        else:
            result['current'], result['current_error'] = exec_run(run.params, base=False)

        if result['current'] and result['base']:
            result['result_type'] = RunResultType.DF_DIFF

        run_record = Run(run_type, run.params)
    else:
        found = False
        for check in checks_db:
            if str(check.id) == run.check_id:
                found = True
                if check.type == RunType.QUERY_DIFF:
                    result['base'], result['base_error'] = exec_run(check.params, base=True)
                    result['current'], result['current_error'] = exec_run(check.params, base=False)
                else:
                    result['current'], result['current_error'] = exec_run(check.params, base=False)

                if result['current'] and result['base']:
                    result['result_type'] = RunResultType.JSON

                run_record = Run(check.type, check.params, check.id)
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Check ID '{run.check_id}' not found")

    if result['current_error'] and result['base_error']:
        raise HTTPException(status_code=400, detail=f"base: {result['base_error']}, current: {result['current_error']}")

    if run_record:
        runs_db.append(run_record)

    return dict(
        run_id=run_record.id,
        run_at=run_record.run_at,
        result_type=result.get('result_type'),
        result=result
    )


@run_router.get("/runs", status_code=200)
async def list_run():
    runs = [dict(
        id=run.id,
        run_at=run.run_at,
        type=run.type,
        params=run.params
    ) for run in runs_db]

    return runs
