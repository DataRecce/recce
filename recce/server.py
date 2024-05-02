import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Any

from fastapi import FastAPI, HTTPException, Request, WebSocket, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from starlette.middleware.sessions import SessionMiddleware
from starlette.websockets import WebSocketDisconnect

from . import __version__, event
from .apis.check_api import check_router
from .apis.run_api import run_router
from .config import RecceConfig
from .core import load_context, default_context
from .exceptions import RecceException
from .run import load_preset_checks

logger = logging.getLogger('uvicorn')


@dataclass
class AppState:
    state_file: Optional[str] = None
    kwargs: Optional[dict] = None


@asynccontextmanager
async def lifespan(fastapi: FastAPI):
    from .core import load_context
    from rich.console import Console

    console = Console()
    app_state: AppState = app.state
    state_file = app_state.state_file
    kwargs = app_state.kwargs
    ctx = load_context(**kwargs, state_file=state_file)
    ctx.start_monitor_artifacts(callback=dbt_artifacts_updated_callback)

    # Initialize Recce Config
    config = RecceConfig(config_file=kwargs.get('config'))
    if not state_file:
        preset_checks = config.get('checks', [])
        if preset_checks and len(preset_checks) > 0:
            console.rule("Loading Preset Checks")
            load_preset_checks(preset_checks)

    yield

    if app_state.state_file:
        ctx.export_state().to_state_file(state_file)

    ctx.stop_monitor_artifacts()


app = FastAPI(lifespan=lifespan)


def dbt_artifacts_updated_callback(file_changed_event: Any):
    src_path = Path(file_changed_event.src_path)
    target_type = src_path.parent.name
    file_name = src_path.name
    logger.info(
        f'Detect {target_type} file {file_changed_event.event_type}: {file_name}')
    ctx = load_context()
    ctx.refresh(file_changed_event.src_path)
    broadcast_command = {
        'command': 'refresh',
        'event': {
            'eventType': file_changed_event.event_type,
            'srcPath': file_changed_event.src_path
        }
    }
    payload = json.dumps(broadcast_command)
    asyncio.run(broadcast(payload))


clients = set()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=uuid.uuid4(),
)


@app.middleware("http")
async def set_context_by_cookie(request: Request, call_next):
    response = await call_next(request)

    user_id_in_cookie = request.cookies.get('recce_user_id')
    user_id = event.get_user_id()

    if event.is_anonymous_tracking() is False:
        # Disable anonymous tracking
        user_id = None

    if user_id_in_cookie is None or user_id_in_cookie != user_id:
        response.set_cookie(key='recce_user_id', value=user_id)
    return response


@app.middleware("http")
async def disable_cache(request: Request, call_next):
    response = await call_next(request)

    # disable cache for '/' and '/index.html'
    if request.url.path in ['/', '/index.html']:
        response.headers['Cache-Control'] = 'no-cache'

    return response


@app.get("/api/health")
async def health_check(request: Request):
    return {"status": "ok"}


@app.get("/api/info")
async def get_info():
    context = default_context()
    demo = os.environ.get('DEMO', False)

    if demo:
        state = context.export_demo_state()
    else:
        state = context.export_state()

    try:
        info = {
            'adapter_type': context.adapter_type,
            'review_mode': context.review_mode,
            'git': state.git.to_dict() if state.git else None,
            'pull_request': state.pull_request.to_dict() if state.pull_request else None,
            'lineage': {
                'base': context.get_lineage(base=True),
                'current': context.get_lineage(base=False),
            },
            'demo': bool(demo)
        }

        if context.adapter_type == 'sqlmesh':
            from recce.adapter.sqlmesh_adapter import SqlmeshAdapter
            sqlmesh_adapter: SqlmeshAdapter = context.adapter
            info['sqlmesh'] = {
                'base_env': sqlmesh_adapter.base_env.name,
                'current_env': sqlmesh_adapter.curr_env.name,
            }

        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/model/{model_id}")
async def get_columns(model_id: str):
    context = default_context()
    try:
        return {
            'model': {
                'base': context.get_model(model_id, base=True),
                'current': context.get_model(model_id, base=False)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/export", response_class=PlainTextResponse, status_code=200)
async def export_handler():
    context = default_context()
    try:
        return context.export_state().to_json()
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)


@app.post("/api/import", status_code=200)
async def import_handler(file: UploadFile):
    from recce.state import RecceState

    context = default_context()
    try:
        content = await file.read()
        state = RecceState.from_json(content)
        import_runs, import_checks = context.import_state(state)

        return {"runs": import_runs, "checks": import_checks}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)


@app.get("/api/version")
async def version():
    try:
        return __version__
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == 'ping':
                await websocket.send_text('pong')
    except WebSocketDisconnect:
        clients.remove(websocket)


async def broadcast(data: str):
    for client in clients:
        await client.send_text(data)


api_prefix = '/api'
app.include_router(check_router, prefix=api_prefix)
app.include_router(run_router, prefix=api_prefix)

static_folder_path = Path(__file__).parent / 'data'
app.mount("/", StaticFiles(directory=static_folder_path, html=True), name="static")
