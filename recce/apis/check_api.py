from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.apis import runs_db, checks_db, Check

check_router = APIRouter(tags=['check'])
# checks_db: list[Check] = []


class CreateCheckIn(BaseModel):
    name: str
    description: str = ''
    run_id: str


class CreateCheckOut(BaseModel):
    success: bool
    message: str


def create_check_from_run(name, description, run_id):
    check_record = None
    for run in runs_db:
        if run_id == str(run.id):
            return Check(name, description, run.type, run.params)
    return check_record


@check_router.post("/checks", status_code=201, response_model=CreateCheckOut)
async def create(check: CreateCheckIn):
    if check.run_id is None:
        raise HTTPException(501, "Not Implemented")
    else:
        check_record = create_check_from_run(check.name, check.description, check.run_id)
        if not check_record:
            raise HTTPException(status_code=404, detail=f"Run ID '{check.run_id}' not found")
        checks_db.append(check_record)

    return {"success": True, "message": "Check created"}


class CheckOut(BaseModel):
    id: UUID
    name: str
    description: str
    params: dict
    last_run: Optional[UUID]


@check_router.get("/checks", status_code=200, response_model=list[CheckOut], response_model_exclude_none=True)
async def list_checks():
    checks = [{
        'id': check.id,
        'name': check.name,
        'description': check.description,
        'params': check.params,
    } for check in checks_db]

    return checks


@check_router.get("/checks/{check_id}", status_code=200, response_model=CheckOut)
async def get(check_id: UUID):
    found = None
    for check in checks_db:
        if check.id == check_id:
            found = check
            break

    if found is None:
        raise HTTPException(status_code=404, detail='Not Found')

    last_run = None
    runs = [run for run in runs_db if run.check_id == check_id]
    if runs:
        last_run = runs[-1].id

    return {
        'id': found.id,
        'name': found.name,
        'description': found.description,
        'params': found.params,
        'last_run': last_run
    }
