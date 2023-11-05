from typing import Optional

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from piti.dbt import DBTContext
from piti.diff import diff_dataframe
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


class QueryDiffInput(BaseModel):
    sql_template: str

class QueryInput(BaseModel):
    base: Optional[bool] = False
    sql_template: str

@app.post("/api/querydiff")
async def query_diff(input: QueryDiffInput):
    # sql = 'select * from {{ref("mymodel")}} order by 1 desc limit 20'
    sql = input.sql_template
    dbtContext = DBTContext.load()
    before = inspect_sql(dbtContext, sql, base=True)
    after = inspect_sql(dbtContext, sql, base=False)
    before.set_index(before.columns[0], inplace=True)
    after.set_index(after.columns[0], inplace=True)
    before_aligned, after_aligned = before.align(after)
    diff = before_aligned.compare(after_aligned, result_names=('base', 'current'), keep_equal=True, keep_shape=True)
    diff_json = diff.to_json(orient='split', date_format='iso')

    import json
    return json.loads(diff_json)

@app.post("/api/query")
async def query(input: QueryInput):
    sql = input.sql_template
    dbtContext = DBTContext.load()
    result = inspect_sql(dbtContext, sql, base=input.base)
    result_json = result.to_json(orient='table')

    import json
    return json.loads(result_json)

static_folder_path = Path(__file__).parent / 'data'
app.mount("/", StaticFiles(directory=static_folder_path), name="static")
