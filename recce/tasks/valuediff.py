from typing import TypedDict, Optional, List

from recce.dbt import default_dbt_context
from .core import Task


class ValueDiffParams(TypedDict):
    primary_key: str
    model: str
    exclude_columns: Optional[List[str]]


class ValueDiffTask(Task):

    def __init__(self, params: ValueDiffParams):
        super().__init__()
        self.params = params

    def execute(self):
        return default_dbt_context().columns_value_mismatched_summary(self.params['primary_key'], self.params['model'])
