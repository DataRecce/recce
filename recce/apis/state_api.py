from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import ValidationError

from recce.exceptions import RecceException
from recce.models.util import pydantic_model_json_dump

state_router = APIRouter(tags=['state'])


@state_router.post("/state/export", response_class=PlainTextResponse, status_code=200)
async def export_handler():
    from ..models.state import recce_state

    try:
        return pydantic_model_json_dump(recce_state)
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)


@state_router.post("/state/load", status_code=200)
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
