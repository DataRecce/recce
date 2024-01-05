from typing import TypedDict

from dbt.adapters.sql import SQLAdapter

from recce.dbt import default_dbt_context
from .core import Task


class ProfileParams(TypedDict):
    model: str


class ProfileDiffTask(Task):

    def __init__(self, params: ProfileParams):
        super().__init__()
        self.params = params
        self.connection = None

    def execute(self):
        result = {}

        from dbt.adapters.sql import SQLAdapter
        adapter: SQLAdapter = default_dbt_context().adapter

        with adapter.connection_named("profile"):
            self.connection = adapter.connections.get_thread_connection()

            result['base'], result['base_error'] = self.execute_profile(base=True)
            self.check_cancel()

            result['current'], result['current_error'] = self.execute_profile(base=False)
            self.check_cancel()

        return result

    def execute_profile(self, base: bool = False):
        from jinja2.exceptions import TemplateSyntaxError

        try:
            model = self.params.get('model')
            result = default_dbt_context().model_profile(model, base=base)
            result_json = result.to_json(orient='table')

            import json
            return json.loads(result_json), None
        except TemplateSyntaxError as e:
            return None, f"Jinja template error: line {e.lineno}: {str(e)}"
        except Exception as e:
            return None, str(e)

    def cancel(self):
        super().cancel()
        if self.connection:
            self.close_connection()

    def close_connection(self):
        adapter: SQLAdapter = default_dbt_context().adapter
        with adapter.connection_named("cancel profile"):
            adapter.connections.cancel(self.connection)
