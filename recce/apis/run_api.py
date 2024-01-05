import asyncio
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.apis.db import runs_db
from recce.apis.run_func import submit_run, cancel_run, get_run
from recce.exceptions import RecceException

run_router = APIRouter(tags=['run'])


class CreateRunIn(BaseModel):
    type: str
    params: dict
    check_id: Optional[str] = None
    nowait: Optional[bool] = False


@run_router.post("/runs", status_code=201)
async def create_run_handler(input: CreateRunIn):
    try:
        run, future = submit_run(input.type, input.params)
    except RecceException as e:
        raise HTTPException(status_code=400, detail=str(e))

    if input.nowait:
        return run
    else:
        run.result = await future
        return run


@run_router.post("/runs/{run_id}/cancel")
async def cancel_run_handler(run_id: UUID):
    try:
        cancel_run(run_id)
    except NotImplementedError:
        pass


@run_router.get("/runs/{run_id}/wait")
async def wait_run_handler(run_id: UUID):
    run = get_run(run_id)
    # wait every 1 second
    while run.result is None and run.error is None:
        await asyncio.sleep(1)
    return run


@run_router.get("/runs", status_code=200)
async def list_run_handler():
    runs = [{
        'run_id': run.run_id,
        'run_at': run.run_at,
        'type': run.type,
        'params': run.params
    } for run in runs_db]

    return runs
