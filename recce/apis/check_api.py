from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.apis.check_func import create_check_without_run, create_check_from_run
from recce.apis.run_func import submit_run
from recce.exceptions import RecceException
from recce.models import RunType, RunDAO, Check, CheckDAO, Run

check_router = APIRouter(tags=['check'])


class CreateCheckIn(BaseModel):
    name: Optional[str] = None
    description: str = ''
    run_id: Optional[str] = None
    type: Optional[RunType] = None,
    params: Optional[dict] = None
    view_options: Optional[dict] = None


class CheckOut(BaseModel):
    check_id: UUID
    name: str
    description: str
    type: str
    params: Optional[dict] = None
    view_options: Optional[dict] = None
    is_checked: bool = False
    is_preset: bool = False
    last_run: Optional[Run] = None

    @classmethod
    def from_check(cls, check: Check):
        return CheckOut(check_id=check.check_id,
                        name=check.name,
                        description=check.description,
                        type=check.type.value,
                        params=check.params,
                        view_options=check.view_options,
                        is_checked=check.is_checked,
                        is_preset=check.is_preset,
                        )


@check_router.post("/checks", status_code=201, response_model=CheckOut)
async def create_check(check_in: CreateCheckIn):
    try:
        if check_in.run_id is not None:
            check = create_check_from_run(
                check_in.run_id,
                check_name=check_in.name,
                check_description=check_in.description,
                check_view_options=check_in.view_options
            )
        else:
            check = create_check_without_run(
                check_name=check_in.name,
                check_description=check_in.description,
                check_type=check_in.type,
                params=check_in.params,
                check_view_options=check_in.view_options
            )
    except NameError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return CheckOut.from_check(check)


class RunCheckIn(BaseModel):
    nowait: Optional[bool] = False


@check_router.post("/checks/{check_id}/run", status_code=201, response_model=Run)
async def run_check_handler(check_id: UUID, input: RunCheckIn):
    check = CheckDAO().find_check_by_id(check_id)
    if not check:
        raise HTTPException(status_code=404, detail=f"Check ID '{check_id}' not found")

    try:
        run, future = submit_run(check.type, check.params, check_id=check_id)
    except RecceException as e:
        raise HTTPException(status_code=400, detail=str(e))

    if input.nowait:
        return run
    else:
        run.result = await future
        return run


@check_router.get("/checks", status_code=200, response_model=list[CheckOut], response_model_exclude_none=True)
async def list_checks_handler():
    checks = []

    for check in CheckDAO().list():
        checks.append(CheckOut.from_check(check))

    return checks


@check_router.get("/checks/{check_id}", status_code=200, response_model=CheckOut)
async def get_check_handler(check_id: UUID):
    check = CheckDAO().find_check_by_id(check_id)
    if check is None:
        raise HTTPException(status_code=404, detail='Not Found')

    runs = RunDAO().list_by_check_id(check_id)
    # only get the last with successful result
    runs = [run for run in runs if run.result is not None]
    last_run = runs[-1] if len(runs) > 0 else None

    out = CheckOut.from_check(check)
    out.last_run = last_run
    return out


class PatchCheckIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    params: Optional[dict] = None
    view_options: Optional[dict] = None
    is_checked: Optional[bool] = None


@check_router.patch("/checks/{check_id}", status_code=200, response_model=CheckOut, response_model_exclude_none=True)
async def update_check_handler(check_id: UUID, patch: PatchCheckIn):
    check = CheckDAO().find_check_by_id(check_id)
    if check is None:
        raise HTTPException(status_code=404, detail='Not Found')

    if patch.name is not None:
        check.name = patch.name
    if patch.description is not None:
        check.description = patch.description
    if patch.params is not None:
        check.params = patch.params
    if patch.view_options is not None:
        check.view_options = patch.view_options
    if patch.is_checked is not None:
        check.is_checked = patch.is_checked

    return CheckOut.from_check(check)


class DeleteCheckOut(BaseModel):
    check_id: UUID


@check_router.delete("/checks/{check_id}", status_code=200, response_model=DeleteCheckOut)
async def delete_handler(check_id: UUID):
    CheckDAO().delete(check_id)

    return DeleteCheckOut(check_id=check_id)


class ReorderChecksIn(BaseModel):
    source: int
    destination: int


@check_router.post("/checks/reorder", status_code=200)
async def reorder_handler(order: ReorderChecksIn):
    try:
        CheckDAO().reorder(order.source, order.destination)
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)
