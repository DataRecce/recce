from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.apis.db import runs_db
from recce.apis.types import Run, RunType

run_router = APIRouter(tags=['run'])


class CreateRunIn(BaseModel):
    type: str
    params: dict
    check_id: Optional[str]


class CreateRunOut(BaseModel):
    id: UUID
    run_at: str
    type: str
    params: dict
    result: dict


@run_router.post("/runs", status_code=201, response_model=CreateRunOut)
async def create(run: CreateRunIn):
    from recce.apis.run_func import ExecutorManager

    try:
        run_type = RunType(run.type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Run type '{run.type}' not supported")

    try:
        executor = ExecutorManager.create_executor(run_type, run.params)
    except NotImplementedError:
        raise HTTPException(status_code=400, detail=f"Run type '{run_type.value}' not supported")

    result = executor.execute()

    run_record = Run(run_type, run.params, result=result)
    runs_db.append(run_record)

    return CreateRunOut(id=run_record.id,
                        run_at=run_record.run_at,
                        type=run_record.type.value,
                        params=run_record.params,
                        result=result).dict()


@run_router.get("/runs", status_code=200)
async def list_run():
    runs = [{
        'id': run.id,
        'run_at': run.run_at,
        'type': run.type,
        'params': run.params
    } for run in runs_db]

    return runs
