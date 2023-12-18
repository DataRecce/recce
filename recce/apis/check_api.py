from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.apis.db import checks_db, runs_db
from recce.apis.types import Run, Check

check_router = APIRouter(tags=['check'])


class CreateCheckIn(BaseModel):
    name: Optional[str] = f"Check-{datetime.utcnow().isoformat()}"
    description: Optional[str] = ''
    run_id: str


class CreateCheckOut(BaseModel):
    check_id: UUID
    name: str
    description: str
    type: str
    params: dict
    is_checked: bool = False


def create_check_from_run(name, description, run_id):
    for run in runs_db:
        if run_id == str(run.run_id):
            check = Check(name, description, run.type, run.params)
            run.check_id = check.check_id
            return check
    return None


@check_router.post("/checks", status_code=201, response_model=CreateCheckOut)
async def create_check(check: CreateCheckIn):
    if check.run_id is None:
        raise HTTPException(501, "Not Implemented")
    else:
        check_record = create_check_from_run(check.name, check.description, check.run_id)
        if not check_record:
            raise HTTPException(status_code=404, detail=f"Run ID '{check.run_id}' not found")
        checks_db.append(check_record)

    return CreateCheckOut(check_id=check_record.check_id,
                          name=check_record.name,
                          description=check_record.description,
                          type=check_record.type.value,
                          params=check_record.params,
                          is_checked=check_record.is_checked,
                          ).dict()


class CreateRunOut(BaseModel):
    run_id: UUID
    run_at: str
    type: str
    params: dict
    result: dict


@check_router.post("/checks/{check_id}/run", status_code=201, response_model=CreateRunOut)
async def run_check(check_id: UUID):
    from recce.apis.run_func import ExecutorManager

    run_record = None
    found = False
    for check in checks_db:
        if check.check_id == check_id:
            found = True
            try:
                executor = ExecutorManager.create_executor(check.type, check.params)
            except NotImplementedError:
                raise HTTPException(status_code=400, detail=f"Run type '{check.type.value}' not supported")

            result = executor.execute()
            run_record = Run(check.type, check.params, check_id=check.check_id, result=result)
            runs_db.append(run_record)

    if not found:
        raise HTTPException(status_code=404, detail=f"Check ID '{check_id}' not found")

    return CreateRunOut(run_id=run_record.run_id,
                        run_at=run_record.run_at,
                        type=run_record.type.value,
                        params=run_record.params,
                        result=run_record.result).dict()


class CheckOut(BaseModel):
    check_id: UUID
    name: str
    description: str
    type: str
    params: dict
    is_checked: bool = False
    last_run: Optional[CreateRunOut] = None


@check_router.get("/checks", status_code=200, response_model=list[CheckOut], response_model_exclude_none=True)
async def list_checks():
    checks = []

    for check in checks_db:
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
async def get_check(check_id: UUID):
    found = None
    for check in checks_db:
        if check.check_id == check_id:
            found = check
            break

    if found is None:
        raise HTTPException(status_code=404, detail='Not Found')

    last_run = None
    runs = [run for run in runs_db if run.check_id == check_id]
    if runs:
        last = runs[-1]
        last_run = CreateRunOut(run_id=last.run_id,
                                run_at=last.run_at,
                                type=last.type.value,
                                params=last.params,
                                result=last.result).dict()

    return CheckOut(check_id=found.check_id,
                    name=found.name,
                    description=found.description,
                    type=found.type.value,
                    params=found.params,
                    last_run=last_run,
                    is_checked=found.is_checked,
                    ).dict()


class PatchCheckIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    params: Optional[dict] = None
    is_checked: Optional[bool] = None


@check_router.patch("/checks/{check_id}", status_code=200, response_model=CheckOut, response_model_exclude_none=True)
async def update_check(check_id: UUID, patch: PatchCheckIn):
    found = None
    for check in checks_db:
        if check.check_id == check_id:
            found = check
            if patch.name is not None:
                check.name = patch.name
            if patch.description is not None:
                check.description = patch.description
            if patch.params is not None:
                check.params = patch.params
            if patch.is_checked is not None:
                check.is_checked = patch.is_checked
            break

    if found is None:
        raise HTTPException(status_code=404, detail='Not Found')

    return CheckOut(check_id=found.check_id,
                    name=found.name,
                    description=found.description,
                    type=found.type.value,
                    params=found.params,
                    is_checked=found.is_checked,
                    ).dict()


class DeleteCheckOut(BaseModel):
    check_id: UUID


@check_router.delete("/checks/{check_id}", status_code=200, response_model=DeleteCheckOut)
async def delete(check_id: UUID):
    found = None
    for check in checks_db:
        if check.check_id == check_id:
            found = check
            break

    if found is None:
        raise HTTPException(status_code=404, detail='Not Found')

    checks_db.remove(found)

    return DeleteCheckOut(check_id=check_id).dict()
