import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Any, Set

from fastapi import FastAPI, HTTPException, Request, WebSocket, UploadFile, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError, BaseModel
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.websockets import WebSocketDisconnect

from . import __version__, event
from .apis.check_api import check_router
from .apis.run_api import run_router
from .config import RecceConfig
from .core import load_context, default_context
from .exceptions import RecceException
from .run import load_preset_checks
from .state import RecceStateLoader

logger = logging.getLogger('uvicorn')


@dataclass
class AppState:
    state_loader: Optional[RecceStateLoader] = None
    kwargs: Optional[dict] = None


@asynccontextmanager
async def lifespan(fastapi: FastAPI):
    from .core import load_context
    from rich.console import Console

    console = Console()
    app_state: AppState = app.state
    state_loader = app_state.state_loader
    kwargs = app_state.kwargs
    ctx = load_context(**kwargs, state_loader=state_loader)
    ctx.start_monitor_artifacts(callback=dbt_artifacts_updated_callback)

    # Initialize Recce Config
    config = RecceConfig(config_file=kwargs.get('config'))
    if not state_loader:
        preset_checks = config.get('checks', [])
        if preset_checks and len(preset_checks) > 0:
            console.rule("Loading Preset Checks")
            load_preset_checks(preset_checks)

    from recce.event import log_load_state
    log_load_state(command='server')

    yield

    state_loader.export(ctx.export_state())

    ctx.stop_monitor_artifacts()


app = FastAPI(lifespan=lifespan)


def verify_json_file(file_path: str) -> bool:
    try:
        with open(file_path, 'r') as f:
            json.load(f)
    except Exception:
        return False
    return True


def dbt_artifacts_updated_callback(file_changed_event: Any):
    src_path = Path(file_changed_event.src_path)
    target_type = src_path.parent.name
    file_name = src_path.name

    if not verify_json_file(file_changed_event.src_path):
        logger.debug('Skip to refresh the artifacts because the file is not updated completely.')
        return

    logger.info(
        f'Detect {target_type} file {file_changed_event.event_type}: {file_name}')
    ctx = load_context()
    ctx.refresh_manifest(file_changed_event.src_path)
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

app.add_middleware(GZipMiddleware, minimum_size=1000)
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
            'demo': bool(demo),
            'cloud_mode': context.state_loader.cloud_mode,
            'file_mode': context.state_loader.state_file is not None,
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


class SelectNodesInput(BaseModel):
    select: Optional[str] = None
    exclude: Optional[str] = None


class SelectNodesOutput(BaseModel):
    nodes: Set[str] = []


@app.post("/api/select", response_model=SelectNodesOutput)
async def select_nodes(input: SelectNodesInput):
    context = default_context()

    if context.adapter_type != 'dbt':
        raise HTTPException(status_code=400, detail='Only dbt adapter is supported')

    try:
        nodes = context.adapter.select_nodes(input.select, input.exclude)
        nodes = [node for node in nodes if not node.startswith('test.')]
        return SelectNodesOutput(nodes=nodes)
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


class SyncStateInput(BaseModel):
    method: Optional[str] = None


@app.post("/api/sync", status_code=202)
async def sync_handler(input: SyncStateInput, response: Response, background_tasks: BackgroundTasks):
    # Sync the state file
    context = default_context()
    state_loader = context.state_loader
    method = input.method

    if not method:
        is_conflict = state_loader.check_conflict()
        if is_conflict:
            raise HTTPException(status_code=409, detail='Conflict detected')
        method = 'overwrite'

    is_syncing = state_loader.state_lock.locked()
    if is_syncing:
        response.status_code = 208
        return {"status": "syncing"}

    def reload_state():
        ctx = default_context()
        ctx.sync_state(method)

    background_tasks.add_task(reload_state)
    response.status_code = 202
    return {"status": "request accepted"}


@app.get("/api/sync", status_code=200)
async def sync_status(response: Response):
    context = default_context()
    if context.state_loader.state_lock.locked():
        response.status_code = 208
        return {"status": "syncing"}

    response.status_code = 200
    return {"status": "idle"}


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
