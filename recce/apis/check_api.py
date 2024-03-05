from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ValidationError

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
    view_options: Optional[dict] = None


class CheckOut(BaseModel):
    check_id: UUID
    name: str
    description: str
    type: str
    params: Optional[dict] = None
    view_options: Optional[dict] = None
    is_checked: bool = False
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
                        )


def _get_ref_model(sql_template: str) -> Optional[str]:
    import re

    pattern = r'\bref\(["\']?(\w+)["\']?\)\s*}}'
    matches = re.findall(pattern, sql_template)
    if len(matches) == 1:
        ref = matches[0]
        return ref

    return None


def _generate_default_name(check_type, params):
    now = datetime.utcnow().strftime("%d %b %Y")
    if check_type == RunType.QUERY:
        ref = _get_ref_model(params.get('sql_template'))
        if ref:
            return f"query of {ref}".capitalize()
        return f"{'query'.capitalize()} - {now}"
    elif check_type == RunType.QUERY_DIFF:
        ref = _get_ref_model(params.get('sql_template'))
        if ref:
            return f"query diff of {ref}".capitalize()
        return f"{'query diff'.capitalize()} - {now}"
    elif check_type == RunType.VALUE_DIFF or check_type == RunType.VALUE_DIFF_DETAIL:
        model = params.get('model')
        return f"value diff of {model}".capitalize()
    elif check_type == RunType.SCHEMA_DIFF:
        node = get_node_by_id(params.get('node_id'))
        return f"{node.resource_type} schema of {node.name}".capitalize()
    elif check_type == RunType.PROFILE_DIFF:
        model = params.get('model')
        return f"profile diff of {model}".capitalize()
    elif check_type == RunType.ROW_COUNT_DIFF:
        nodes = params.get('node_names')
        if len(nodes) == 1:
            node = nodes[0]
            return f"row count of {node}".capitalize()
        return f"{'row count'.capitalize()} - {now}"
    elif check_type == RunType.LINEAGE_DIFF:
        nodes = params.get('node_ids')
        return f"lineage diff of {len(nodes)} nodes".capitalize()
    elif check_type == RunType.TOP_K_DIFF:
        model = params.get('model')
        column = params.get('column_name')
        return f"top-k diff of {model}.{column} ".capitalize()
    elif check_type == RunType.HISTOGRAM_DIFF:
        model = params.get('model')
        column = params.get('column_name')
        return f"histogram diff of {model}.{column} ".capitalize()
    else:
        return f"{'check'.capitalize()} - {now}"


def _validate_check(check_type, params):
    if check_type == RunType.SCHEMA_DIFF:
        validate_schema_diff_check(params)
    pass


@check_router.post("/checks", status_code=201, response_model=CheckOut)
async def create_check(check_in: CreateCheckIn):
    run = None
    if check_in.run_id is not None:
        run = RunDAO().find_run_by_id(check_in.run_id)
        if run is None:
            raise HTTPException(status_code=404, detail='Run Not Found')

        type = run.type
        params = run.params
    else:
        type = check_in.type
        params = check_in.params

    _validate_check(type, params)

    name = check_in.name if check_in.name is not None else _generate_default_name(type, params)
    check = Check(name=name,
                  description=check_in.description,
                  type=type,
                  params=params,
                  view_options=check_in.view_options)
    CheckDAO().create(check)

    if run is not None:
        run.check_id = check.check_id

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


@check_router.post("/checks/export", response_class=PlainTextResponse, status_code=200)
async def export_handler():
    from ..models.state import recce_state

    try:
        return recce_state.model_dump_json()
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)


@check_router.post("/checks/load", status_code=200)
async def load_handler(file: UploadFile):
    from ..models.state import RecceState, recce_state

    try:
        content = await file.read()
        load_state = RecceState().model_validate_json(content)
        recce_state.checks = load_state.checks
        recce_state.runs = load_state.runs

        return {"runs": len(recce_state.runs), "checks": len(recce_state.checks)}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)
