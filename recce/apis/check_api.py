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
    id: UUID
    name: str
    description: str
    type: str
    params: dict


def create_check_from_run(name, description, run_id):
    for run in runs_db:
        if run_id == str(run.id):
            return Check(name, description, run.type, run.params)
    return None


@check_router.post("/checks", status_code=201, response_model=CreateCheckOut)
async def create(check: CreateCheckIn):
    if check.run_id is None:
        raise HTTPException(501, "Not Implemented")
    else:
        check_record = create_check_from_run(check.name, check.description, check.run_id)
        if not check_record:
            raise HTTPException(status_code=404, detail=f"Run ID '{check.run_id}' not found")
        checks_db.append(check_record)

    return CreateCheckOut(id=check_record.id,
                          name=check_record.name,
                          description=check_record.description,
                          type=check_record.type.value,
                          params=check_record.params).dict()


class CreateRunOut(BaseModel):
    id: UUID
    run_at: str
    type: str
    params: dict
    result: dict


@check_router.post("/checks/{check_id}/run", status_code=201, response_model=CreateRunOut)
async def create(check_id: UUID):
    from recce.apis.run_func import ExecutorManager

    run_record = None
    found = False
    for check in checks_db:
        if check.id == check_id:
            found = True
            try:
                executor = ExecutorManager.create_executor(check.type, check.params)
            except NotImplementedError:
                raise HTTPException(status_code=400, detail=f"Run type '{check.type.value}' not supported")

            result = executor.execute()
            run_record = Run(check.type, check.params, check_id=check.id, result=result)
            runs_db.append(run_record)

    if not found:
        raise HTTPException(status_code=404, detail=f"Check ID '{check_id}' not found")

    return CreateRunOut(id=run_record.id,
                        run_at=run_record.run_at,
                        type=run_record.type.value,
                        params=run_record.params,
                        result=run_record.result).dict()


class CheckOut(BaseModel):
    id: UUID
    name: str
    description: str
    type: str
    params: dict
    last_run: Optional[CreateRunOut] = None


@check_router.get("/checks", status_code=200, response_model=list[CheckOut], response_model_exclude_none=True)
async def list_checks():
    checks = []

    for check in checks_db:
        checks.append(
            CheckOut(id=check.id,
                     name=check.name,
                     description=check.description,
                     type=check.type.value,
                     params=check.params).dict()
        )

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
        last_run = CreateRunOut(id=runs[-1].id,
                                run_at=runs[-1].run_at,
                                type=runs[-1].type.value,
                                params=runs[-1].params,
                                result=runs[-1].result).dict()

    return CheckOut(id=found.id,
                    name=found.name,
                    description=found.description,
                    type=found.type.value,
                    params=found.params,
                    last_run=last_run).dict()


class PatchCheckIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@check_router.patch("/checks/{check_id}", status_code=200, response_model=CheckOut, response_model_exclude_none=True)
async def get(check_id: UUID, patch: PatchCheckIn):
    found = None
    for check in checks_db:
        if check.id == check_id:
            found = check
            check.name = patch.name if patch.name else check.name
            check.description = patch.description if patch.description else check.description
            break

    if found is None:
        raise HTTPException(status_code=404, detail='Not Found')

    return CheckOut(id=found.id,
                    name=found.name,
                    description=found.description,
                    type=found.type.value,
                    params=found.params).dict()
