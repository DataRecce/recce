from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.apis import Run, checks_db, runs_db
from recce.apis.types import RunType

run_router = APIRouter(tags=['run'])


class CreateRunIn(BaseModel):
    type: str
    params: dict
    check_id: Optional[str]


@run_router.post("/runs", status_code=201)
async def create(run: CreateRunIn):
    from recce.apis.run_func import RunExecutor

    run_record = None
    result_type = None
    result = {
        'current': None,
        'base': None,
        'current_error': None,
        'base_error': None
    }

    if run.check_id is None:
        run_type = RunType(run.type)
        executor = RunExecutor().get_executor(run_type)

        result['base'], result['base_error'] = executor.execute(run.params, base=True)
        result['current'], result['current_error'] = executor.execute(run.params, base=False)
        result_type = executor.get_result_type()

        run_record = Run(run_type, run.params)
    else:
        found = False
        for check in checks_db:
            if str(check.id) == run.check_id:
                executor = RunExecutor().get_executor(check.type)

                result['base'], result['base_error'] = executor.execute(check.params, base=True)
                result['current'], result['current_error'] = executor.execute(check.params, base=False)
                result_type = executor.get_result_type()

                run_record = Run(check.type, check.params, check.id)
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Check ID '{run.check_id}' not found")

    if result['current_error'] and result['base_error']:
        raise HTTPException(status_code=400, detail=f"base: {result['base_error']}, current: {result['current_error']}")

    if run_record:
        runs_db.append(run_record)

    return {
        'run_id': run_record.id,
        'run_at': run_record.run_at,
        'result_type': result_type,
        'result': result
    }


@run_router.get("/runs", status_code=200)
async def list_run():
    runs = [{
        'id': run.id,
        'run_at': run.run_at,
        'type': run.type,
        'params': run.params
    } for run in runs_db]

    return runs
