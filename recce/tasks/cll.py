from typing import Optional, Dict

from pydantic import BaseModel

from recce.tasks.core import Task
from recce.core import default_context


class CllParams(BaseModel):
    node_id: str
    columns: Optional[str] = None


class CllResult(BaseModel):
    current: Dict


class CllTask(Task):

    def __init__(self, params):
        super().__init__()
        self.params = CllParams(**params)

    def execute(self):
        from recce.adapter.dbt_adapter import DbtAdapter
        dbt_adapter: DbtAdapter = default_context().adapter

        # TODO: Add support for by the node and column
        result = dbt_adapter.get_cll_by_node_id(self.params.node_id)

        return CllResult(current=result)
