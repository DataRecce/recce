import os
import sys
import time
from typing import List

from rich import box
from rich.console import Console
from rich.table import Table

from recce.apis.check_func import create_check_from_run, create_check_without_run
from recce.apis.run_func import submit_run
from recce.config import RecceConfig
from recce.core import RecceContext
from recce.models.types import RunType
from recce.pull_request import fetch_pr_metadata_from_event_path
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


def fetch_pr_metadata(**kwargs):
    pr_info = PullRequestInfo()

    # fetch from github action event path
    metadata = fetch_pr_metadata_from_event_path()
    if metadata is not None:
        pr_info.id = metadata.get('github_pr_id')
        pr_info.url = metadata.get('github_pr_url')
        pr_info.title = metadata.get('github_pr_title')

    # fetch from cli arguments
    if pr_info.url is None and 'github_pull_request_url' in kwargs:
        pr_info.url = kwargs.get('github_pull_request_url')

    pr_info.branch = kwargs.get('git_current_branch')
    pr_info.base_branch = kwargs.get('git_base_branch')

    # fetch from env
    if pr_info.url is None:
        pr_info.url = os.getenv("RECCE_PR_URL")

    return pr_info


async def execute_default_runs(context: RecceContext):
    """
    Execute the default runs. It includes

    1. Run 'row_count_diff' for all the modified table models
    """
    curr_lineage = context.get_lineage(base=False)
    base_lineage = context.get_lineage(base=True)

    try:
        # Query the row count of all the nodes in the lineage
        node_ids = []

        for id, node in curr_lineage['nodes'].items():
            if node.get('resource_type') != 'model':
                continue

            materialized = node.get('config', {}).get('materialized')
            if materialized != 'table' and materialized != 'incremental':
                continue

            base_node = base_lineage['nodes'].get(id)
            if base_node is None:
                continue

            base_checksum = node.get('checksum', {}).get('checksum')
            curr_checksum = base_node.get('checksum', {}).get('checksum')

            if base_checksum is None or curr_checksum is None or base_checksum == curr_checksum:
                continue

            node_ids.append(id)

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


async def execute_preset_checks(checks: list) -> (int, List[dict]):
    """
    Execute the preset checks
    """
    console = Console()
    rc = 0
    failed_checks = []
    table = Table(title='Recce Preset Checks', box=box.HORIZONTALS, title_style='bold dark_orange3')
    table.add_column('Status')
    table.add_column('Name')
    table.add_column('Type')
    table.add_column('Execution Time')
    table.add_column('Failed Reason')
    for check in checks:
        run = None
        check_name = check.get('name')
        check_type = check.get('type')
        check_description = check.get('description', '')
        check_params = check.get('params', {})
        check_options = check.get('view_options', {})

        try:
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
            rc = 1
            if run is None:
                table.add_row('[[red]Error[/red]]', check_name, check_type.replace('_', ' ').title(), 'N/A', str(e))
                failed_checks.append({
                    'check_name': check_name,
                    'check_type': check_type,
                    'check_description': check_description,
                    'failed_type': 'error',
                    'failed_reason': str(e)
                })
            else:
                create_check_from_run(run.run_id, check_name, check_description, check_options, is_preset=True)
                table.add_row('[[red]Failed[/red]]', check_name, check_type.replace('_', ' ').title(), 'N/A', run.error)
                failed_checks.append({
                    'check_name': check_name,
                    'check_type': check_type,
                    'check_description': 'N/A',
                    'failed_type': 'failed',
                    'failed_reason': run.error
                })

    console.print(table)
    return rc, failed_checks


def process_failed_checks(failed_checks: List[dict], error_log=None):
    from py_markdown_table.markdown_table import markdown_table
    failed_check_table = []
    for check in failed_checks:
        name = check.get('check_name')
        check_type = check.get('check_type')
        failed_type = check.get('failed_type')
        failed_reason = check.get('failed_reason')
        failed_check_table.append({
            'Name': name,
            'Type': check_type,
            'Kind of Failed': failed_type,
            'Failed Reason': failed_reason.replace('\n', ' ')
        })

    content = '# Recce Runc Failed Checks\n'
    content += markdown_table(failed_check_table).set_params(quote=False, row_sep='markdown').get_markdown()

    if error_log:
        with open(error_log, 'w') as f:
            f.write(content)
        print('The failed checks are stored at [{}]'.format(error_log))
    else:
        print(content, file=sys.stderr)


async def cli_run(output_state_file: str, **kwargs):
    """The main function of 'recce run' command. It will execute the default runs and store the state."""
    console = Console()
    error_log = kwargs.get('error_log')
    if kwargs.get('sqlmesh', False):
        console.print("[[red]Error[/red]] SQLMesh adapter is not supported.")
        sys.exit(1)

    from recce.core import load_context
    ctx = load_context(**kwargs)

    is_skip_query = kwargs.get('skip_query', False)

    # Prepare the artifact by collecting the lineage
    console.rule("DBT Artifacts")
    from recce.adapter.dbt_adapter import DbtAdapter
    dbt_adaptor: DbtAdapter = ctx.adapter
    dbt_adaptor.print_lineage_info()

    # Execute the default runs
    console.rule("Default queries")
    if not is_skip_query:
        await execute_default_runs(ctx)
    else:
        print("Skip querying row counts")

    # Execute the preset checks
    rc = 0
    preset_checks = RecceConfig().get('checks')
    if is_skip_query or preset_checks is None or len(preset_checks) == 0:
        # Skip the preset checks
        pass
    else:
        console.rule("Preset checks")
        rc, failed_checks = await execute_preset_checks(preset_checks)
        if rc != 0 and failed_checks:
            process_failed_checks(failed_checks, error_log)

    # Export the state
    state: RecceState = ctx.export_state()
    state.pull_request = fetch_pr_metadata(**kwargs)

    state.to_state_file(output_state_file)
    print(f'The state file is stored at [{output_state_file}]')
    return rc
