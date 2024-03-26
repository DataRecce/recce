import os

from rich.console import Console

from recce.apis.run_func import submit_run
from recce.models.lineage import LineageDAO
from recce.models.state import default_recce_state
from recce.models.types import Lineage, RunType


def check_github_ci_env(**kwargs):
    github_pull_request_url = None
    """Check if the environment is GitHub CI"""
    if 'GITHUB_ACTIONS' not in os.environ:
        return False, None

    # Get the PR number
    github_server_url = os.environ.get('GITHUB_SERVER_URL', 'https://github.com')
    github_repository = os.environ.get('GITHUB_REPOSITORY', '')
    github_ref_name = os.environ.get('GITHUB_REF_NAME', '')
    github_pull_request_url = f"{github_server_url}/{github_repository}/pull/{github_ref_name}"

    return True, github_pull_request_url


async def archive_artifacts(state_file: str, **kwargs):
    console = Console()
    """Archive the artifacts"""
    from recce.dbt import load_dbt_context
    ctx = load_dbt_context()
    is_skip_query = kwargs.get('skip_query', False)

    # Prepare the artifact by collecting the lineage
    console.rule("Collecting the lineage")
    base = ctx.get_lineage(base=True)
    current = ctx.get_lineage(base=False)
    # patch the metadata
    if 'git_current_branch' in kwargs:
        current['metadata']['git_branch'] = kwargs.get('git_current_branch')
    if 'git_base_branch' in kwargs:
        base['metadata']['git_branch'] = kwargs.get('git_base_branch')
    if 'github_pull_request_url' in kwargs:
        current['metadata']['pr_url'] = kwargs.get('github_pull_request_url')

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

    # Patch metadata
    default_recce_state().store(state_file, **kwargs)
    print(f'State is stored as {state_file}')
    pass
