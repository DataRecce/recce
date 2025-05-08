import asyncio
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from recce.apis.run_func import cancel_run, materialize_run_results, submit_run
from recce.event import log_api_event
from recce.exceptions import RecceException
from recce.models import RunDAO

run_router = APIRouter(tags=["run"])


class CreateRunIn(BaseModel):
    type: str
    params: dict
    check_id: Optional[str] = None
    nowait: Optional[bool] = False
    track_props: Optional[dict] = None


@run_router.post("/runs", status_code=201)
async def create_run_handler(input: CreateRunIn):
    log_api_event(
        "create_run",
        dict(
            type=input.type,
            track_props=input.track_props,
        ),
    )
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
async def wait_run_handler(run_id: UUID, timeout: int = Query(None, description="Maximum number of seconds to wait")):
    run = RunDAO().find_run_by_id(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Not Found")

    start_time = asyncio.get_event_loop().time()
    while run.result is None and run.error is None:
        await asyncio.sleep(1)
        if timeout is not None and (asyncio.get_event_loop().time() - start_time) > timeout:
            break
    return run


@run_router.get("/runs", status_code=200)
async def list_run_handler():
    runs = RunDAO().list() or []

    result = [
        {
            "run_id": run.run_id,
            "run_at": run.run_at,
            "name": run.name,
            "type": run.type,
            "params": run.params,
            "status": run.status,
            "check_id": run.check_id,
        }
        for run in runs
    ]

    # sort by run_at
    result = sorted(result, key=lambda x: x["run_at"], reverse=True)

    return result


class SearchRunsIn(BaseModel):
    type: str
    params: dict
    limit: Optional[int] = None


@run_router.post("/runs/search", status_code=200)
async def search_runs_handler(search: SearchRunsIn):
    runs = RunDAO().list()

    result = []
    for run in runs:
        if run.type.value != search.type:
            continue
        if not all(search.params[key] == run.params.get(key) for key in search.params.keys()):
            continue

        result.append(run)

    if search.limit:
        return result[-search.limit :]

    return result


class AggregateRunsIn(BaseModel):
    class AggregateFilter(BaseModel):
        nodes: Optional[List[str]] = None

    filter: Optional[AggregateFilter] = None


@run_router.post("/runs/aggregate", status_code=200)
async def aggregate_runs_handler(input: AggregateRunsIn):
    try:
        runs = RunDAO().list()
        nodes = input.filter.nodes if input.filter and input.filter.nodes else None
        result = materialize_run_results(runs, nodes=nodes)
        return result
    except Exception as e:
        raise HTTPException(status_code=405, detail=str(e))
