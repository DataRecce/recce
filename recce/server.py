import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from . import __version__, event
from .dbt import DBTContext

dbt_context: DBTContext = None


def load_dbt_context(**kwargs):
    global dbt_context
    if dbt_context is None:
        dbt_context = DBTContext.load(**kwargs)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_dbt_context()
    yield


app = FastAPI(lifespan=lifespan)

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


@app.get("/api/version")
async def version():
    try:
        return __version__
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


static_folder_path = Path(__file__).parent / 'data'
app.mount("/", StaticFiles(directory=static_folder_path, html=True), name="static")
