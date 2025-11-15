from typing import Optional

from pydantic import BaseModel

from recce.models.dataframe import DataFrame


class QueryResult(DataFrame):
    pass


class QueryDiffResult(BaseModel):
    base: Optional[DataFrame] = None
    current: Optional[DataFrame] = None
    diff: Optional[DataFrame] = None


class ProfileResult(BaseModel):
    current: DataFrame


class ProfileDiffResult(BaseModel):
    base: DataFrame
    current: DataFrame


class ValueDiffResult(BaseModel):
    class Summary(BaseModel):
        total: int
        added: int
        removed: int

    summary: Summary
    data: DataFrame


class ValueDiffDetailResult(DataFrame):
    pass
