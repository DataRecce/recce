import asyncio
import json
import logging
import os
import signal
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Annotated, Any, Literal, Optional, Set

from fastapi import (
    BackgroundTasks,
    FastAPI,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    WebSocket,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from pytz import utc
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.websockets import WebSocketDisconnect

from . import __latest_version__, __version__, event
from .apis.check_api import check_router
from .apis.run_api import run_router
from .config import RecceConfig
from .connect_to_cloud import (
    connect_to_cloud_background_task,
    generate_key_pair,
    get_connection_url,
    is_callback_server_running,
    prepare_connection_url,
)
from .core import RecceContext, default_context, load_context
from .event import get_recce_api_token, log_api_event, log_single_env_event
from .exceptions import RecceException
from .models.types import CllData
from .run import load_preset_checks
from .state import RecceShareStateManager, RecceStateLoader

logger = logging.getLogger("uvicorn")


class RecceServerMode(str, Enum):
    server = "server"
    preview = "preview"
    read_only = "read-only"

    def __str__(self):
        return self.value

    @staticmethod
    def available_members() -> Set[str]:
        return ["server", "preview", "read-only"]


@dataclass
class AppState:
    command: Optional[str] = None
    state_loader: Optional[RecceStateLoader] = None
    kwargs: Optional[dict] = None
    flag: Optional[dict] = None
    auth_options: Optional[dict] = None
    lifetime: Optional[int] = None
    lifetime_expired_at: Optional[datetime] = None
    share_url: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None


def schedule_lifetime_termination(app_state):
    def terminating_server():
        pid = os.getpid()
        logger.info(f"Terminating server process [{pid}] manually")
        os.kill(pid, signal.SIGINT)

    # Terminate the server process after the specified lifetime
    logger.info(f"[Configuration] The lifetime of the server is {app_state.lifetime} seconds")
    app.state.lifetime_expired_at = datetime.now(utc) + timedelta(seconds=app_state.lifetime)
    asyncio.get_running_loop().call_later(app_state.lifetime, terminating_server)


def setup_server(app_state: AppState) -> RecceContext:
    from rich.console import Console

    from .core import load_context

    console = Console()
    state_loader = app_state.state_loader
    kwargs = app_state.kwargs
    ctx = load_context(**kwargs, state_loader=state_loader)
    ctx.start_monitor_artifacts(callback=dbt_artifacts_updated_callback)
    single_env = False
    if app_state.flag.get("single_env_onboarding", False) is True:
        # [Experiment 2] Start with Single Environment
        single_env = True
        ctx.start_monitor_base_env(callback=dbt_env_updated_callback)
        log_single_env_event()

    # Initialize Recce Config
    config = RecceConfig(config_file=kwargs.get("config"))
    if state_loader.state is None:
        preset_checks = config.get("checks", [])
        if preset_checks and len(preset_checks) > 0:
            console.rule("Loading Preset Checks")
            load_preset_checks(preset_checks)

    from recce.event import log_load_state

    log_load_state(command="server", single_env=single_env)

    return ctx


def teardown_server(app_state: AppState, ctx: RecceContext):
    state_loader = app_state.state_loader
    state_loader.export(ctx.export_state())

    ctx.stop_monitor_artifacts()
    if app_state.flag.get("single_env_onboarding", False):
        ctx.stop_monitor_base_env()


def setup_ready_only(app_state: AppState):
    pass


def teardown_ready_only(app_state: AppState):
    pass


def setup_preview(app_state: AppState):
    state_loader = app_state.state_loader
    kwargs = app_state.kwargs
    ctx = load_context(**kwargs, state_loader=state_loader)
    return ctx


def teardown_preview(app_state: AppState, ctx: RecceContext):
    state_loader = app_state.state_loader
    state_loader.export(ctx.export_state())
    pass


@asynccontextmanager
async def lifespan(fastapi: FastAPI):
    ctx = None
    app_state: AppState = app.state

    if app_state.command == "server":
        ctx = setup_server(app_state)
    elif app_state.command == "read-only":
        setup_ready_only(app_state)
    elif app_state.command == "preview":
        ctx = setup_preview(app_state)

    if app_state.lifetime is not None and app_state.lifetime > 0:
        schedule_lifetime_termination(app_state)

    yield

    if app_state.command == "server":
        teardown_server(app_state, ctx)
    elif app_state.command == "read_only":
        teardown_ready_only(app_state)
    elif app_state.command == "preview":
        teardown_preview(app_state, ctx)


app = FastAPI(lifespan=lifespan)


def verify_json_file(file_path: str) -> bool:
    try:
        with open(file_path, "r") as f:
            json.load(f)
    except Exception:
        return False
    return True


def dbt_artifacts_updated_callback(file_changed_event: Any):
    src_path = Path(file_changed_event.src_path)
    target_type = src_path.parent.name
    file_name = src_path.name

    if not verify_json_file(file_changed_event.src_path):
        logger.debug("Skip to refresh the artifacts because the file is not updated completely.")
        return

    logger.info(f"Detect {target_type} file {file_changed_event.event_type}: {file_name}")
    ctx = load_context()
    ctx.refresh_manifest(file_changed_event.src_path)
    broadcast_command = {
        "command": "refresh",
        "event": {"eventType": file_changed_event.event_type, "srcPath": file_changed_event.src_path},
    }
    payload = json.dumps(broadcast_command)
    asyncio.run(broadcast(payload))


def dbt_env_updated_callback():
    logger.info("Detect 'manifest.json' and 'catalog.json' are generated under 'target-base' directory")
    broadcast_command = {
        "command": "relaunch",
    }
    payload = json.dumps(broadcast_command)
    asyncio.run(broadcast(payload))


clients = set()

origins = [
    "http://localhost:3000",
    "http://localhost:3001",
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

    user_id_in_cookie = request.cookies.get("recce_user_id")
    user_id = event.get_user_id()

    if event.is_anonymous_tracking() is False:
        # Disable anonymous tracking
        user_id = None

    if user_id_in_cookie is None or user_id_in_cookie != user_id:
        response.set_cookie(key="recce_user_id", value=user_id)
    return response


@app.middleware("http")
async def disable_cache(request: Request, call_next):
    response = await call_next(request)

    # disable cache for '/' and '/index.html'
    if request.url.path in ["/", "/index.html"]:
        response.headers["Cache-Control"] = "no-store"

    return response


@app.get("/api/health")
async def health_check(request: Request):
    return {"status": "ok"}


class RecceInstanceInfoOut(BaseModel):
    server_mode: RecceServerMode
    read_only: bool
    preview: bool
    single_env: bool
    authed: bool
    lifetime_expired_at: Optional[datetime] = None
    share_url: Optional[str] = None


@app.get("/api/instance-info", response_model=RecceInstanceInfoOut, response_model_exclude_none=True)
async def recce_instance_info():
    app_state: AppState = app.state
    flag = app_state.flag
    read_only = flag.get("read_only", False)
    single_env = flag.get("single_env_onboarding", False)

    api_token = get_recce_api_token()

    return {
        "server_mode": app_state.command,
        "read_only": read_only,
        "preview": flag.get("preview", False),
        "single_env": single_env,
        "authed": True if api_token else False,
        "lifetime_expired_at": app_state.lifetime_expired_at,  # UTC timezone
        "share_url": app_state.share_url,
        # TODO: Add more instance info which won't change during the instance lifecycle
        # review_mode
        # cloud_mode
        # demo
        # single env
    }


@app.get("/api/flag")
async def config_flag():
    app_state: AppState = app.state
    flag = app_state.flag
    return flag


@app.post("/api/relaunch-hint/completed", status_code=204)
async def mark_relaunch_hint_completed():
    app.state.flag["show_relaunch_hint"] = False


@app.get("/api/info")
async def get_info():
    """
    Get the information of the current context.
    """
    context = default_context()
    demo = os.environ.get("DEMO", False)

    if demo:
        state = context.export_demo_state()
    else:
        state = context.export_state()

    support_tasks = context.support_tasks()
    if context.state_loader and context.state_loader.state_file:
        filename = os.path.basename(context.state_loader.state_file)
    else:
        filename = None

    state_metadata = context.state_loader.state.metadata if context.state_loader.state else None
    lineage_diff = context.get_lineage_diff()

    try:
        info = {
            "state_metadata": state_metadata,
            "adapter_type": context.adapter_type,
            "review_mode": context.review_mode,
            "git": state.git.to_dict() if state.git else None,
            "pull_request": state.pull_request.to_dict() if state.pull_request else None,
            "lineage": lineage_diff,
            "demo": bool(demo),
            "cloud_mode": context.state_loader.cloud_mode,
            "file_mode": context.state_loader.state_file is not None,
            "filename": filename,
            "support_tasks": support_tasks,
        }

        if context.adapter_type == "sqlmesh":
            from recce.adapter.sqlmesh_adapter import SqlmeshAdapter

            sqlmesh_adapter: SqlmeshAdapter = context.adapter
            info["sqlmesh"] = {
                "base_env": sqlmesh_adapter.base_env.name,
                "current_env": sqlmesh_adapter.curr_env.name,
            }

        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class CllIn(BaseModel):
    node_id: Optional[str] = None
    column: Optional[str] = None
    change_analysis: Optional[bool] = False
    no_cll: Optional[bool] = False
    no_upstream: Optional[bool] = False
    no_downstream: Optional[bool] = False


class CllOutput(BaseModel):
    current: CllData


@app.post("/api/cll", response_model=CllOutput)
async def column_level_lineage_by_node(cll_input: CllIn):
    from recce.adapter.dbt_adapter import DbtAdapter

    dbt_adapter: DbtAdapter = default_context().adapter
    cll = dbt_adapter.get_cll(
        node_id=cll_input.node_id,
        column=cll_input.column,
        change_analysis=cll_input.change_analysis,
        no_upstream=cll_input.no_upstream,
        no_downstream=cll_input.no_downstream,
        no_cll=cll_input.no_cll,
    )

    return CllOutput(current=cll)


class SelectNodesInput(BaseModel):
    select: Optional[str] = None
    exclude: Optional[str] = None
    packages: Optional[list[str]] = None
    view_mode: Optional[Literal["all", "changed_models"]] = None


class SelectNodesOutput(BaseModel):
    nodes: Set[str] = []


@app.post("/api/select", response_model=SelectNodesOutput)
async def select_nodes(input: SelectNodesInput):
    context = default_context()

    if context.adapter_type != "dbt":
        raise HTTPException(status_code=400, detail="Only dbt adapter is supported")

    try:
        nodes = context.adapter.select_nodes(
            select=input.select,
            exclude=input.exclude,
            packages=input.packages,
            view_mode=input.view_mode,
        )
        nodes = [node for node in nodes if not node.startswith("test.")]
        return SelectNodesOutput(nodes=nodes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/model/{model_id}")
async def get_columns(model_id: str):
    context = default_context()
    try:
        return {
            "model": {
                "base": context.get_model(model_id, base=True),
                "current": context.get_model(model_id, base=False),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/save", response_class=PlainTextResponse, status_code=200)
async def save_handler():
    """
    Save the in-memory state to the state file
    """
    try:
        # Sync the state file
        context = default_context()
        log_api_event("save", dict(state_loader_mode=context.state_loader_mode()))
        state_loader = context.state_loader
        if not state_loader.cloud_mode and state_loader.state_file is None:
            raise RecceException("Not file mode or cloud mode")

        context.sync_state("overwrite")
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)


class SaveAsOrRenameInput(BaseModel):
    # The filename. The filename should not contain directory.
    filename: Optional[str] = None
    # Overwrite the file if it exists
    overwrite: Optional[bool] = False


def saveas_or_rename(input: SaveAsOrRenameInput, rename: bool = False):
    context = default_context()
    state_loader = context.state_loader
    if state_loader.cloud_mode:
        raise RecceException("Cloud mode does not support rename")

    new_filename = input.filename
    if os.path.dirname(new_filename):
        raise RecceException("The new filename should not contain directory")
    if not new_filename.endswith(".json"):
        raise RecceException("The new filename should end with .json")

    old_path = state_loader.state_file
    if old_path:
        old_dir = os.path.dirname(state_loader.state_file)
        old_filename = os.path.basename(state_loader.state_file)
        if old_filename == new_filename:
            raise RecceException("The new filename is the same as the current filename")
        new_path = os.path.join(old_dir, new_filename)
    else:
        new_path = new_filename

    if os.path.exists(new_path):
        if os.path.isdir(new_path):
            raise HTTPException(status_code=400, detail=f"The file {new_path} exists and is a directory")

        if not input.overwrite:
            raise HTTPException(status_code=409, detail=f"The file {new_filename} already exists")

    state_loader.state_file = new_path
    context.sync_state("overwrite")
    if rename and os.path.exists(old_path):
        os.remove(old_path)


@app.post("/api/save-as", response_class=PlainTextResponse, status_code=200)
async def save_as_handler(input: SaveAsOrRenameInput):
    """
    Save the state to a new file
    """
    context = default_context()
    try:
        log_api_event("saveas", dict(state_loader_mode=context.state_loader_mode()))
        saveas_or_rename(input, rename=False)
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)


@app.post("/api/rename", response_class=PlainTextResponse, status_code=200)
async def rename_handler(input: SaveAsOrRenameInput):
    """
    Rename the state to a new file
    """
    context = default_context()
    try:
        log_api_event("rename", dict(state_loader_mode=context.state_loader_mode()))
        saveas_or_rename(input, rename=True)
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)


@app.post("/api/export", response_class=PlainTextResponse, status_code=200)
async def export_handler():
    """
    Export the recce state to the client.
    """
    context = default_context()
    try:
        log_api_event("export", dict(state_loader_mode=context.state_loader_mode()))
        return context.export_state().to_json()
    except RecceException as e:
        raise HTTPException(status_code=400, detail=e.message)


@app.post("/api/import", status_code=200)
async def import_handler(
    file: Annotated[UploadFile, Form()], checks_only: Annotated[bool, Form()], background_tasks: BackgroundTasks
):
    """
    Import the recce state from the client.
    """
    from recce.state import RecceState

    context = default_context()
    try:
        log_api_event("import", dict(state_loader_mode=context.state_loader_mode()))
        content = await file.read()
        state = RecceState.from_json(content)

        if checks_only:
            import_checks = context.import_checks(state)
            background_tasks.add_task(context.sync_state, "overwrite")
            return {"runs": 0, "checks": import_checks}

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
    """
    Sync the state with the external storage. (two-way sync)

    This is used to sync the state with the external (local or cloud) storage. There are three methods:
    - overwrite: Overwrite the external storage with the in-memory state.
    - revert: Revert the in-memory state with the external storage.
    - merge: Merge the state between the in-memory and external storage.
    """
    context = default_context()
    state_loader = context.state_loader
    method = input.method
    log_api_event(
        "sync",
        dict(
            state_loader_mode=context.state_loader_mode(),
            method=method,
        ),
    )

    if not method:
        is_conflict = state_loader.check_conflict()
        if is_conflict:
            raise HTTPException(status_code=409, detail="Conflict detected")
        method = "overwrite"

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
    """
    Get the sync status.
    """
    context = default_context()
    if context.state_loader.state_lock.locked():
        response.status_code = 208
        return {"status": "syncing"}

    response.status_code = 200
    return {"status": "idle"}


class ShareStateOutput(BaseModel):
    status: str
    message: str
    share_url: Optional[str] = None


@app.post("/api/share", response_model=ShareStateOutput)
async def share_state():
    """
    Share the recce state to the external storage. (one-way sync)
    """
    app_state: AppState = app.state
    state_manager = RecceShareStateManager(app_state.auth_options)
    if not state_manager.verify():
        error, hint = state_manager.error_and_hint
        raise HTTPException(status_code=400, detail=f"Failed to share state: {error}. {hint}")

    context = default_context()
    state_loader = context.state_loader

    file_name = "recce_state.json"
    if state_loader.state_file:
        file_name = os.path.basename(state_loader.state_file)

    state = state_loader.state
    if state_loader.state is None:
        state = context.export_state()

    response = state_manager.share_state(file_name, state)

    return ShareStateOutput(**response)


class VersionOut(BaseModel):
    version: str
    latestVersion: str


@app.get("/api/version", response_model=VersionOut)
async def version():
    try:
        return dict(
            version=__version__,
            latestVersion=__latest_version__,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        clients.remove(websocket)


async def broadcast(data: str):
    for client in clients:
        await client.send_text(data)


@app.post("/api/connect")
async def generate_connect_to_cloud_url(background_tasks: BackgroundTasks):
    if is_callback_server_running():
        return {"connection_url": get_connection_url()}

    private_key, public_key = generate_key_pair()
    connection_url, callback_port = prepare_connection_url(public_key)

    background_tasks.add_task(connect_to_cloud_background_task, private_key, callback_port, connection_url)
    return {
        "connection_url": connection_url,
    }


api_prefix = "/api"
app.include_router(check_router, prefix=api_prefix)
app.include_router(run_router, prefix=api_prefix)

static_folder_path = Path(__file__).parent / "data"
app.mount("/", StaticFiles(directory=static_folder_path, html=True), name="static")
