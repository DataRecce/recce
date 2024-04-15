import os
import time

from rich import box
from rich.console import Console
from rich.table import Table

from recce.apis.check_func import create_check_from_run, create_check_without_run
from recce.apis.run_func import submit_run
from recce.config import RecceConfig
from recce.dbt import DBTContext
from recce.models.types import RunType
from recce.state import RecceState, PullRequestInfo


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


def load_preset_checks(checks: list):
    console = Console()
    table = Table(title='Recce Preset Checks', box=box.HORIZONTALS, title_style='bold dark_orange3')
    table.add_column('Name')
    table.add_column('Type')
    table.add_column('Description')
    for check in checks:
        name = check.get('name')
        description = check.get('description', '')
        check_type = check.get('type')
        check_params = check.get('params', {})
        check_options = check.get('view_options', {})
        create_check_without_run(name, description, check_type, check_params, check_options, is_preset=True)
        table.add_row(name, check_type.replace('_', ' ').title(), description.strip())
    console.print(table)


async def execute_preset_checks(context: DBTContext, checks: list):
    """
    Execute the preset checks
    """
    console = Console()
    table = Table(title='Recce Preset Checks', box=box.HORIZONTALS, title_style='bold dark_orange3')
    table.add_column('Status')
    table.add_column('Name')
    table.add_column('Type')
    table.add_column('Execution Time')
    table.add_column('Failed Reason')
    for check in checks:
        try:
            check_name = check.get('name')
            check_type = check.get('type')
            check_description = check.get('description')
            check_params = check.get('params', {})
            check_options = check.get('view_options', {})

            # verify the check
            if check_type not in [e.value for e in RunType]:
                raise ValueError(f"Invalid check type: {check_type}")

            start = time.time()
            if check_type in ['schema_diff']:
                create_check_without_run(check_name, check_description, check_type, check_params, check_options,
                                         is_preset=True)
            else:
                run, future = submit_run(check_type, params=check_params)
                await future
                create_check_from_run(run.run_id, check_name, check_description, check_options, is_preset=True)

            end = time.time()
            table.add_row('[[green]Success[/green]]', check_name, check_type.replace('_', ' ').title(),
                          f'{end - start:.2f} seconds', 'N/A')
        except Exception as e:
            check_name = check.get('name')
            check_type = check.get('type')
            table.add_row('[[red]Failed[/red]]', check_name, check_type.replace('_', ' ').title(), 'N/A', str(e))
    console.print(table)
    pass


async def cli_run(output_state_file: str, **kwargs):
    """The main function of 'recce run' command. It will execute the default runs and store the state."""
    console = Console()

    from recce.dbt import load_dbt_context
    ctx = load_dbt_context(**kwargs)
    is_skip_query = kwargs.get('skip_query', False)

    # Prepare the artifact by collecting the lineage
    console.rule("DBT Artifacts")
    print("Base:")
    print(f"    Manifest: {ctx.base_manifest.metadata.generated_at}")
    print(f"    Catalog:  {ctx.base_catalog.metadata.generated_at if ctx.base_catalog else 'N/A'}")

    print("Current:")
    print(f"    Manifest: {ctx.curr_manifest.metadata.generated_at}")
    print(f"    Catalog:  {ctx.curr_catalog.metadata.generated_at if ctx.curr_catalog else 'N/A'}")

    # Execute the default runs
    console.rule("Default queries")
    if not is_skip_query:
        await execute_default_runs(ctx)
    else:
        print("Skip querying row counts")

    # Execute the preset checks
    preset_checks = RecceConfig().get('checks')
    if is_skip_query or preset_checks is None or len(preset_checks) == 0:
        # Skip the preset checks
        pass
    else:
        console.rule("Preset checks")
        await execute_preset_checks(ctx, preset_checks)

    # Export the state
    state: RecceState = ctx.export_state()
    if 'github_pull_request_url' in kwargs:
        state.pull_request = PullRequestInfo(
            url=kwargs.get('github_pull_request_url')
        )

    state.to_state_file(output_state_file)
    print(f'The state file is stored at [{output_state_file}]')
    pass
