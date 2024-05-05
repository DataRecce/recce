from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from recce.core import default_context
from recce.models import RunDAO, RunType, Check, CheckDAO


def validate_schema_diff_check(params):
    node_id = params.get('node_id')
    if node_id is None:
        raise HTTPException(status_code=400, detail='node_id is required for schema diff')
    node_name = default_context().get_node_name_by_id(node_id)
    if node_name is None:
        raise HTTPException(status_code=400, detail=f"node_id '{node_id}' not found in dbt manifest")


def get_node_name_by_id(node_id):
    node_name = default_context().get_node_name_by_id(node_id)
    if node_name is None:
        raise HTTPException(status_code=400, detail=f"node_id '{node_id}' not found in dbt manifest")
    return node_name


def _validate_check(check_type, params):
    if check_type == RunType.SCHEMA_DIFF:
        validate_schema_diff_check(params)
    pass


def _get_ref_model(sql_template: str) -> Optional[str]:
    import re

    pattern = r'\bref\(["\']?(\w+)["\']?\)\s*}}'
    matches = re.findall(pattern, sql_template)
    if len(matches) == 1:
        ref = matches[0]
        return ref

    return None


def _generate_default_name(check_type, params, view_options):
    now = datetime.utcnow().strftime("%d %b %Y")
    if check_type == RunType.QUERY:
        ref = _get_ref_model(params.get('sql_template'))
        if ref:
            return f"query of {ref}".capitalize()
        return f"{'query'.capitalize()} - {now}"
    elif check_type == RunType.QUERY_DIFF:
        ref = _get_ref_model(params.get('sql_template'))
        if ref:
            return f"query diff of {ref}".capitalize()
        return f"{'query diff'.capitalize()} - {now}"
    elif check_type == RunType.VALUE_DIFF or check_type == RunType.VALUE_DIFF_DETAIL:
        model = params.get('model')
        return f"value diff of {model}".capitalize()
    elif check_type == RunType.SCHEMA_DIFF:
        node_name = get_node_name_by_id(params.get('node_id'))
        return f"schema diff of {node_name}".capitalize()
    elif check_type == RunType.PROFILE_DIFF:
        model = params.get('model')
        return f"profile diff of {model}".capitalize()
    elif check_type == RunType.ROW_COUNT_DIFF:
        nodes = params.get('node_names')
        if len(nodes) == 1:
            node = nodes[0]
            return f"row count of {node}".capitalize()
        return f"{'row count'.capitalize()} - {now}"
    elif check_type == RunType.LINEAGE_DIFF:
        nodes = view_options.get('node_ids') if view_options else params.get('node_ids')
        return f"lineage diff of {len(nodes)} nodes".capitalize()
    elif check_type == RunType.TOP_K_DIFF:
        model = params.get('model')
        column = params.get('column_name')
        return f"top-k diff of {model}.{column} ".capitalize()
    elif check_type == RunType.HISTOGRAM_DIFF:
        model = params.get('model')
        column = params.get('column_name')
        return f"histogram diff of {model}.{column} ".capitalize()
    else:
        return f"{'check'.capitalize()} - {now}"


def create_check_from_run(run_id, check_name=None, check_description='', check_view_options=None, is_preset=False):
    if run_id is None:
        raise ValueError('run_id is required')

    run = RunDAO().find_run_by_id(run_id)
    if run is None:
        raise NameError(f"Run '{run_id}' not found")

    run_type = run.type
    run_params = run.params

    _validate_check(run_type, run_params)
    name = check_name if check_name is not None else _generate_default_name(run_type, run_params, check_view_options)
    check = Check(name=name,
                  description=check_description,
                  type=run_type,
                  params=run_params,
                  view_options=check_view_options,
                  is_preset=is_preset)
    CheckDAO().create(check)
    run.check_id = check.check_id

    return check


def create_check_without_run(check_name, check_description, check_type, params, check_view_options, is_preset=False):
    name = check_name if check_name is not None else _generate_default_name(check_type, params, check_view_options)
    check = Check(name=name,
                  description=check_description,
                  type=check_type,
                  params=params,
                  view_options=check_view_options,
                  is_preset=is_preset)
    CheckDAO().create(check)
    return check
