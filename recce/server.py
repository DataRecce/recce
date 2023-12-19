import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, Any

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware
from starlette.websockets import WebSocketDisconnect

from . import __version__, event
from .apis.check_api import check_router
from .apis.run_api import run_router
from .dbt import DBTContext

logger = logging.getLogger('uvicorn')
dbt_context: Optional[DBTContext] = None


def load_dbt_context(**kwargs) -> DBTContext:
    global dbt_context
    if dbt_context is None:
        dbt_context = DBTContext.load(**kwargs)
    return dbt_context


@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    ctx = load_dbt_context()
    ctx.start_monitor_artifacts(callback=dbt_artifacts_updated_callback)
    yield
    ctx.stop_monitor_artifacts()


def dbt_artifacts_updated_callback(file_changed_event: Any):
    target_type, file_name = file_changed_event.src_path.split("/")[-2:]
    logger.info(
        f'Detect {target_type} file {file_changed_event.event_type}: {file_name}')
    ctx = load_dbt_context()
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


app = FastAPI(lifespan=lifespan)
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


@app.get("/api/health")
async def health_check(request: Request):
    return {"status": "ok"}


class QueryInput(BaseModel):
    base: Optional[bool] = False
    sql_template: str


@app.post("/api/query")
async def query(input: QueryInput):
    from jinja2.exceptions import TemplateSyntaxError

    try:
        sql = input.sql_template
        result = dbt_context.execute_sql(sql, base=input.base)
        result_json = result.to_json(orient='table')

        import json
        return json.loads(result_json)
    except TemplateSyntaxError as e:
        raise HTTPException(status_code=400, detail=f'Jinja template error: line {e.lineno}: {str(e)}')
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/lineage")
async def get_lineage(base: Optional[bool] = False):
    try:
        return dbt_context.get_lineage(base)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/models/{model_name}/row_count")
async def get_row_count(model_name: str):
    try:
        return dbt_context.get_row_count(model_name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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
