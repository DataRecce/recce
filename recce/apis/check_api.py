from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from recce.apis.db import checks_db, runs_db
from recce.apis.types import Run, Check, RunType

check_router = APIRouter(tags=['check'])


class CreateCheckIn(BaseModel):
    type: RunType
    name: Optional[str] = None
    description: str = ''
    run_id: Optional[str] = None
    params: Optional[dict] = None


class CreateCheckOut(BaseModel):
    check_id: UUID
    name: str
    description: str
    type: str
    params: Optional[dict] = None
    is_checked: bool = False


def create_check_from_run(name, description, run_id):
    def generate_name_by_run(r):
        now = datetime.utcnow().isoformat()
        if r.type == RunType.QUERY_DIFF:
            return f"check query - {now}".capitalize()
        elif r.type == RunType.VALUE_DIFF:
            model = r.params.get('model')
            return f"value diff of {model} - {now}".capitalize()
        else:
            return f"check - {now}".capitalize()

    if run_id is None:
        return None

    for run in runs_db:
        if run_id == str(run.run_id):
            if name is None:
                name = generate_name_by_run(run)
            check = Check(name=name, description=description, type=run.type, params=run.params)
            run.check_id = check.check_id
            return check
    return None


def create_check_from_schema(name, description, node_id):
    def get_manifests_by_id(unique_id):
        from recce.server import dbt_context
        curr_manifest = dbt_context.get_manifest(base=False)
        base_manifest = dbt_context.get_manifest(base=True)
        if unique_id in curr_manifest.nodes.keys() or unique_id in base_manifest.nodes.keys():
            return {
                'current': curr_manifest.nodes.get(unique_id),
                'base': base_manifest.nodes.get(unique_id)
            }
        return None

    manifests = get_manifests_by_id(node_id)
    if manifests is None:
        return None

    node = manifests['current'] or manifests['base']
    if name is None:
        name = f"{node.resource_type} schema of {node.name} - {datetime.utcnow().isoformat()}".capitalize()

    params = {
        "node_id": node_id,
    }

    check = Check(name=name, description=description, type=RunType.SCHEMA_DIFF, params=params)
    return check


def create_check_dispatcher(check: CreateCheckIn):
    check_record = None
    if check.type == RunType.QUERY_DIFF or check.type == RunType.VALUE_DIFF:
        if check.run_id is None:
            raise HTTPException(status_code=400, detail='Run ID is required')
        check_record = create_check_from_run(check.name, check.description, check.run_id)
        if check_record is None:
            raise HTTPException(status_code=404, detail=f'Run ID {check.run_id} not found')
    elif check.type == RunType.SCHEMA_DIFF:
        if isinstance(check.params, dict) is False or check.params.get('node_id') is None:
            raise HTTPException(status_code=400, detail='Node ID is required in params')
        node_id = check.params.get('node_id')
        check_record = create_check_from_schema(check.name, check.description, node_id)
        if check_record is None:
            raise HTTPException(status_code=404, detail=f'Node ID {node_id} not found')
    elif check.type == RunType.SIMPLE:
        check_record = Check(name=f"Check - {datetime.utcnow().isoformat()}", description=check.description,
                             type=RunType.SIMPLE)
    else:
        run_type = RunType(check.type)
        check_record = Check(name=f"Check - {datetime.utcnow().isoformat()}", description=check.description,
                             type=run_type)
    return check_record


@check_router.post("/checks", status_code=201, response_model=CreateCheckOut)
async def create_check(check: CreateCheckIn):
    check_record = create_check_dispatcher(check)
    if check_record is None:
        raise HTTPException(status_code=400, detail='Invalid check type')

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
            run_record = Run(type=check.type, params=check.params, check_id=check.check_id, result=result)
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
    params: Optional[dict] = None
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
