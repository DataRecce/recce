from fastapi import HTTPException

from recce.dbt import default_dbt_context


def validate_schema_diff_check(params):
    node_id = params.get('node_id')
    if node_id is None:
        raise HTTPException(status_code=400, detail='node_id is required for schema diff')
    manifests = default_dbt_context().get_manifests_by_id(node_id)
    if manifests is None:
        raise HTTPException(status_code=400, detail=f"node_id '{node_id}' not found in dbt manifest")


def get_node_by_id(node_id):
    manifests = default_dbt_context().get_manifests_by_id(node_id)
    if manifests is None:
        raise HTTPException(status_code=400, detail=f"node_id '{node_id}' not found in dbt manifest")
    return manifests['current'] or manifests['base']
