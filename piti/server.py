from typing import Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from piti.dbt import DBTContext
from piti.impact import inspect_sql
from pydantic import BaseModel

app = FastAPI()

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
        dbt_context = DBTContext.load()
        result = inspect_sql(dbt_context, sql, base=input.base)
        result_json = result.to_json(orient='table')

        import json
        return json.loads(result_json)
    except TemplateSyntaxError as e:
        raise HTTPException(status_code=400, detail=f'Jinja template error: line {e.lineno}: {str(e)}')
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


static_folder_path = Path(__file__).parent / 'data'
app.mount("/", StaticFiles(directory=static_folder_path, html=True), name="static")
