import asyncio
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.apis.check_func import get_node_by_id, validate_schema_diff_check
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


class CreateCheckOut(BaseModel):
    check_id: UUID
    name: str
    description: str
    type: str
    params: Optional[dict] = None
    is_checked: bool = False


def _generate_default_name(check_type, params):
    now = datetime.utcnow().isoformat()
    if check_type == RunType.QUERY:
        return f"query {now}".capitalize()
    elif check_type == RunType.QUERY_DIFF:
        return f"query diff {now}".capitalize()
    elif check_type == RunType.VALUE_DIFF:
        model = params.get('model')
        return f"value diff of {model}".capitalize()
    elif check_type == RunType.SCHEMA_DIFF:
        node = get_node_by_id(params.get('node_id'))
        return f"{node.resource_type} schema of {node.name} - {now}".capitalize()
    elif check_type == RunType.PROFILE_DIFF:
        model = params.get('model')
        return f"profile diff of {model}".capitalize()
    elif check_type == RunType.ROW_COUNT_DIFF:
        return f"row count - {now}".capitalize()
    else:
        return f"check - {now}".capitalize()


def _validate_check(check_type, params):
    if check_type == RunType.SCHEMA_DIFF:
        validate_schema_diff_check(params)
    pass


@check_router.post("/checks", status_code=201, response_model=CreateCheckOut)
async def create_check(checkIn: CreateCheckIn):
    run = None
    if checkIn.run_id is not None:
        run = RunDAO().find_run_by_id(checkIn.run_id)
        if run is None:
            raise HTTPException(status_code=404, detail='Run Not Found')

        type = run.type
        params = run.params
    else:
        type = checkIn.type
        params = checkIn.params

    _validate_check(type, params)

    name = checkIn.name if checkIn.name is not None else _generate_default_name(type, params)
    check = Check(name=name, description=checkIn.description, type=type, params=params)
    CheckDAO().create(check)

    if run is not None:
        run.check_id = check.check_id

    return CreateCheckOut(check_id=check.check_id,
                          name=check.name,
                          description=check.description,
                          type=check.type.value,
                          params=check.params,
                          is_checked=check.is_checked,
                          ).dict()


@check_router.post("/checks/{check_id}/run", status_code=201, response_model=Run)
async def run_check_handler(check_id: UUID):
    check = CheckDAO().find_check_by_id(check_id)
    if not check:
        raise HTTPException(status_code=404, detail=f"Check ID '{check_id}' not found")

    try:
        run, future = submit_run(check.type, check.params)
        run.result = asyncio.wait(future)
        return run
    except RecceException as e:
        raise HTTPException(status_code=400, detail=str(e))


class CheckOut(BaseModel):
    check_id: UUID
    name: str
    description: str
    type: str
    params: Optional[dict] = None
    is_checked: bool = False
    last_run: Optional[Run] = None


@check_router.get("/checks", status_code=200, response_model=list[CheckOut], response_model_exclude_none=True)
async def list_checks_handler():
    checks = []

    for check in CheckDAO().list():
        checks.append(
            CheckOut(check_id=check.check_id,
                     name=check.name,
                     description=check.description,
                     type=check.type.value,
                     params=check.params,
                     is_checked=check.is_checked,
                     ).dict()

        )

    return checks


@check_router.get("/checks/{check_id}", status_code=200, response_model=CheckOut)
async def get_check_handler(check_id: UUID):
    check = CheckDAO().find_check_by_id(check_id)
    if check is None:
        raise HTTPException(status_code=404, detail='Not Found')

    runs = RunDAO().list_by_check_id(check_id)
    last_run = runs[-1] if len(runs) > 0 else None

    return CheckOut(check_id=check.check_id,
                    name=check.name,
                    description=check.description,
                    type=check.type.value,
                    params=check.params,
                    last_run=last_run,
                    is_checked=check.is_checked,
                    ).dict()


class PatchCheckIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    params: Optional[dict] = None
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
    if patch.is_checked is not None:
        check.is_checked = patch.is_checked

    return CheckOut(check_id=check.check_id,
                    name=check.name,
                    description=check.description,
                    type=check.type.value,
                    params=check.params,
                    is_checked=check.is_checked,
                    ).dict()


class DeleteCheckOut(BaseModel):
    check_id: UUID


@check_router.delete("/checks/{check_id}", status_code=200, response_model=DeleteCheckOut)
async def delete_handler(check_id: UUID):
    CheckDAO().delete(check_id)

    return DeleteCheckOut(check_id=check_id).dict()


class ReorderChecksIn(BaseModel):
    source: int
    destination: int


@check_router.post("/checks/reorder", status_code=200)
async def reorder_handler(order: ReorderChecksIn):
    try:
        CheckDAO().reorder(order.source, order.destination)
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)
