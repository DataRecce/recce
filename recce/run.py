from recce.apis.run_func import submit_run
from recce.models.lineage import LineageDAO
from recce.models.state import default_recce_state
from recce.models.types import Lineage, RunType


async def archive_artifacts(state_file: str, **kwargs):
    """Archive the artifacts"""
    from recce.dbt import load_dbt_context
    ctx = load_dbt_context()
    is_skip_query = kwargs.get('skip_query', False)

    # Prepare the artifact by collecting the lineage
    base = ctx.get_lineage(base=True)
    current = ctx.get_lineage(base=False)
    lineage = Lineage(
        base=base,
        current=current,
    )
    LineageDAO().set(lineage)

    if is_skip_query:
        print("Skip querying row count for nodes in the lineage")
    else:
        try:
            # Query the row count of all the nodes in the lineage
            print("Querying row count for nodes in the lineage")
            base_nodes = list(base.get('nodes', []).keys())
            current_nodes = list(current.get('nodes', []).keys())
            node_ids = list(set(base_nodes + current_nodes))
            print(f"Total nodes: {len(node_ids)}")

            run, future = submit_run(RunType.ROW_COUNT_DIFF, params={
                'node_ids': node_ids
            })
            print(f"Run is submitted: {run.run_id}")
            await future
        except Exception as e:
            print(f"Failed to submit run: {e}")

    default_recce_state().store(state_file)
    print(f'State is stored as {state_file}')
    pass
