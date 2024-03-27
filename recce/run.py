import os
import time

from rich.console import Console

from recce.apis.run_func import submit_run
from recce.dbt import DBTContext
from recce.models.lineage import LineageDAO
from recce.models.state import default_recce_state
from recce.models.types import Lineage, RunType


def check_github_ci_env(**kwargs):
    """Check if the environment is GitHub CI"""
    if 'GITHUB_ACTIONS' not in os.environ:
        return False, None

    # Get the PR number
    github_server_url = os.environ.get('GITHUB_SERVER_URL', 'https://github.com')
    github_repository = os.environ.get('GITHUB_REPOSITORY', '')
    github_ref_name = os.environ.get('GITHUB_REF_NAME', '')
    github_pull_request_url = f"{github_server_url}/{github_repository}/pull/{github_ref_name}"

    return True, github_pull_request_url


async def execute_default_runs(context: DBTContext):
    """
    Execute the default runs. It includes

    1. Run 'row_count_diff' for all the modified table models
    """

    try:
        # Query the row count of all the nodes in the lineage
        node_ids = []

        for node in context.curr_manifest.nodes.values():
            if node.resource_type != 'model':
                continue

            materialized = node.config.materialized
            if materialized != 'table' and materialized != 'incremental':
                continue

            base_node = context.base_manifest.nodes.get(node.unique_id)
            if not base_node:
                continue

            if not node.checksum or not base_node.checksum or node.checksum.checksum == base_node.checksum.checksum:
                continue

            node_ids.append(node.unique_id)

        print(f"Querying row count diff for the modified table models. [{len(node_ids)} node(s)]")
        if len(node_ids) == 0:
            print("Skipped")
            return

        start = time.time()
        run, future = submit_run(RunType.ROW_COUNT_DIFF, params={
            'node_ids': node_ids
        })
        await future
        end = time.time()
        print(f"Completed in {end - start:.2f} seconds")
    except Exception as e:
        print("Failed to run queries")
        raise e


async def archive_artifacts(state_file: str, **kwargs):
    """Archive the artifacts"""
    console = Console()

    from recce.dbt import load_dbt_context
    ctx = load_dbt_context()
    is_skip_query = kwargs.get('skip_query', False)

    # Prepare the artifact by collecting the lineage
    console.rule("DBT Artifacts")
    print("Base:")
    print(f"    Manifest: {ctx.base_manifest.metadata.generated_at}")
    print(f"    Catalog:  {ctx.base_catalog.metadata.generated_at if ctx.base_catalog else 'N/A'}")

    print("Current:")
    print(f"    Manifest: {ctx.curr_manifest.metadata.generated_at}")
    print(f"    Catalog:  {ctx.curr_catalog.metadata.generated_at if ctx.curr_catalog else 'N/A'}")
    base = ctx.get_lineage(base=True)
    current = ctx.get_lineage(base=False)
    lineage = Lineage(
        base=base,
        current=current,
    )
    LineageDAO().set(lineage)

    # patch the metadata
    if 'git_current_branch' in kwargs:
        current['metadata']['git_branch'] = kwargs.get('git_current_branch')
    if 'git_base_branch' in kwargs:
        base['metadata']['git_branch'] = kwargs.get('git_base_branch')
    if 'github_pull_request_url' in kwargs:
        current['metadata']['pr_url'] = kwargs.get('github_pull_request_url')

    # Execute the default runs
    console.rule("Default queries")
    if not is_skip_query:
        await execute_default_runs(ctx)
    else:
        print("Skip querying row counts")

    # Store the state
    console.rule("Output the state file")
    default_recce_state().store(state_file, **kwargs)
    print(f'The state file is stored at [{state_file}]')
    pass
