from recce.apis.types import RunParams
from recce.server import dbt_context


def exec_run(params: RunParams, base=False):
    from jinja2.exceptions import TemplateSyntaxError

    try:
        sql = params.get('sql_template')
        result = dbt_context.execute_sql(sql, base=base)
        result_json = result.to_json(orient='table')

        import json
        return json.loads(result_json), None
    except TemplateSyntaxError as e:
        return None, f"Jinja template error: line {e.lineno}: {str(e)}"
    except Exception as e:
        return None, str(e)
