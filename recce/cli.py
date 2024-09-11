import asyncio
import os
from pathlib import Path
from typing import List

import click
import uvicorn

from recce import event
from recce.config import RecceConfig, RECCE_CONFIG_FILE, RECCE_ERROR_LOG_FILE
from recce.run import cli_run, check_github_ci_env
from recce.state import RecceStateLoader, RecceCloudStateManager
from recce.summary import generate_markdown_summary
from recce.util.logger import CustomFormatter
from recce.util.recce_cloud import RecceCloudException
from .core import RecceContext
from .event.track import TrackCommand

event.init()


def create_state_loader(review_mode, cloud_mode, state_file, cloud_options):
    from rich.console import Console
    console = Console()

    try:
        return RecceStateLoader(review_mode=review_mode, cloud_mode=cloud_mode,
                                state_file=state_file, cloud_options=cloud_options)
    except RecceCloudException as e:
        console.print("[[red]Error[/red]] Failed to load recce state file")
        console.print(f"Reason: {e.reason}")
        exit(1)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to load recce state file")
        console.print(f"Reason: {e}")
        exit(1)


def handle_debug_flag(**kwargs):
    if kwargs.get('debug'):
        import logging
        ch = logging.StreamHandler()
        ch.setFormatter(CustomFormatter())
        logging.basicConfig(handlers=[ch], level=logging.DEBUG)


def add_options(options):
    def _add_options(func):
        for option in reversed(options):
            func = option(func)
        return func

    return _add_options


dbt_related_options = [
    click.option('--target', '-t', help='Which target to load for the given profile.', type=click.STRING),
    click.option('--profile', help='Which existing profile to load.', type=click.STRING),
    click.option('--project-dir', help='Which directory to look in for the dbt_project.yml file.', type=click.Path(),
                 envvar="DBT_PROJECT_DIR"),
    click.option('--profiles-dir', help='Which directory to look in for the profiles.yml file.', type=click.Path(),
                 envvar="DBT_PROFILES_DIR"),
]

sqlmesh_related_options = [
    click.option('--sqlmesh', is_flag=True, help='Use SQLMesh ', hidden=True),
    click.option('--sqlmesh-envs', is_flag=False, help='SQLMesh envs to compare. SOURCE:TARGET', hidden=True),
    click.option('--sqlmesh-config', is_flag=False, help='SQLMesh config name to use', hidden=True),
]

recce_options = [
    click.option('--config', help='Path to the recce config file.', type=click.Path(), default=RECCE_CONFIG_FILE,
                 show_default=True),
    click.option('--error-log', help='Path to the error log file.', type=click.Path(), default=RECCE_ERROR_LOG_FILE,
                 hidden=True),
    click.option('--debug', is_flag=True, help='Enable debug mode.', hidden=True),
]

recce_cloud_options = [
    click.option('--cloud', is_flag=True, help='Fetch the state file from cloud.'),
    click.option('--cloud-token', help='The token used by Recce Cloud.', type=click.STRING,
                 envvar='GITHUB_TOKEN'),
    click.option('--state-file-host', help='The host to fetch the state file from.', type=click.STRING,
                 envvar='RECCE_STATE_FILE_HOST', default='', hidden=True),
    click.option('--password', '-p', help='The password to encrypt the state file in cloud.', type=click.STRING,
                 envvar='RECCE_STATE_PASSWORD'),
]


def _execute_sql(context, sql_template, base=False):
    try:
        import pandas as pd
    except ImportError:
        print("'pandas' package not found. You can install it using the command: 'pip install pandas'.")
        exit(1)

    from recce.adapter.dbt_adapter import DbtAdapter
    dbt_adapter: DbtAdapter = context.adapter
    with dbt_adapter.connection_named('recce'):
        sql = dbt_adapter.generate_sql(sql_template, base)
        response, result = dbt_adapter.execute(sql, fetch=True, auto_begin=True)
        table = result
        df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)
        return df


@click.group()
@click.pass_context
def cli(ctx, **kwargs):
    """Recce: Data validation toolkit for comprehensive PR review"""


@cli.command(cls=TrackCommand)
def version():
    """
    Show version information
    """
    from recce import __version__
    print(__version__)


@cli.command(hidden=True, cls=TrackCommand)
@click.option('--sql', help='Sql template to query', required=True)
@click.option('--base', is_flag=True, help='Run the query on the base environment')
@add_options(dbt_related_options)
def query(sql, base: bool = False, **kwargs):
    """
    Run a query on the current or base environment

    Examples:\n

    - run an adhoc query\n
        recce query --sql 'select * from {{ ref("mymodel") }} order by 1'

    - run an adhoc query on base environment\n
        recce query --base --sql 'select * from {{ ref("mymodel") }} order by 1'
    """
    context = RecceContext.load(**kwargs)
    result = _execute_sql(context, sql, base=base)
    print(result.to_string(na_rep='-', index=False))


def _split_comma_separated(ctx, param, value):
    return value.split(',') if value else None


@cli.command(hidden=True, cls=TrackCommand)
@click.option('--sql', help='Sql template to query.', required=True)
@click.option('--primary-keys', type=click.STRING, help='Comma-separated list of primary key columns.',
              callback=_split_comma_separated)
@click.option('--keep-shape', is_flag=True, help='Keep unchanged columns. Otherwise, unchanged columns are hidden.')
@click.option('--keep-equal', is_flag=True,
              help='Keep values that are equal. Otherwise, equal values are shown as "-".')
@add_options(dbt_related_options)
def diff(sql, primary_keys: List[str] = None, keep_shape: bool = False, keep_equal: bool = False, **kwargs):
    """
    Run queries on base and current environments and diff the results

    Examples:\n

    - run adhoc queries and diff the results\n
        recce diff --sql 'select * from {{ ref("mymodel") }} order by 1'
    """

    context = RecceContext.load(**kwargs)
    before = _execute_sql(context, sql, base=True)
    if primary_keys is not None:
        before.set_index(primary_keys, inplace=True)
    after = _execute_sql(context, sql, base=False)
    if primary_keys is not None:
        after.set_index(primary_keys, inplace=True)

    before_aligned, after_aligned = before.align(after)
    diff = before_aligned.compare(after_aligned,
                                  result_names=('base', 'current'),
                                  keep_equal=keep_equal,
                                  keep_shape=keep_shape)
    print(diff.to_string(na_rep='-') if not diff.empty else 'no changes')


@cli.command(cls=TrackCommand)
@click.argument('state_file', required=False)
@click.option('--host', default='localhost', show_default=True, help='The host to bind to.')
@click.option('--port', default=8000, show_default=True, help='The port to bind to.', type=int)
@click.option('--review', is_flag=True, help='Open the state file in the review mode.')
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_cloud_options)
def server(host, port, state_file=None, **kwargs):
    """
    Launch the recce server

    STATE_FILE is the path to the recce state file. Defaults=None, which will be no persistent state.

    Examples:\n

    \b
    # Launch the recce server
    recce server

    \b
    # Launch the recce server with a state file
    recce server recce_state.json

    \b
    # Launch the server in the review mode
    recce server --review recce_state.json

    \b
    # Launch the server and synchronize the state with the cloud
    recce server --cloud
    recce server --review --cloud

    """

    from .server import app, AppState
    from rich.console import Console

    handle_debug_flag(**kwargs)
    is_review = kwargs.get('review', False)
    is_cloud = kwargs.get('cloud', False)
    console = Console()
    cloud_options = None
    if is_cloud:
        cloud_options = {
            'host': kwargs.get('state_file_host'),
            'token': kwargs.get('cloud_token'),
            'password': kwargs.get('password'),
        }

    state_loader = create_state_loader(is_review, is_cloud, state_file, cloud_options)

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    if state_loader.review_mode is True:
        console.rule("Recce Server : Review Mode")
    else:
        console.rule("Recce Server")

    state = AppState(state_loader=state_loader, kwargs=kwargs)
    app.state = state

    uvicorn.run(app, host=host, port=port, lifespan='on')


DEFAULT_RECCE_STATE_FILE = 'recce_state.json'


@cli.command(cls=TrackCommand)
@click.option('-o', '--output', help='Path of the output state file.', type=click.Path(),
              default=DEFAULT_RECCE_STATE_FILE, show_default=True)
@click.option('--state-file', help='Path of the import state file.', type=click.Path())
@click.option('--summary', help='Path of the summary markdown file.', type=click.Path())
@click.option('--skip-query', is_flag=True, help='Skip running the queries for the checks.')
@click.option('--git-current-branch', help='The git branch of the current environment.', type=click.STRING,
              envvar='GITHUB_HEAD_REF')
@click.option('--git-base-branch', help='The git branch of the base environment.', type=click.STRING,
              envvar='GITHUB_BASE_REF')
@click.option('--github-pull-request-url', help='The github pull request url to use for the lineage.',
              type=click.STRING)
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_cloud_options)
def run(output, **kwargs):
    """
    Run recce and output the state file

    Examples:\n

    \b
    # Run recce and output to the default path [recce_state.json]
    recce run

    \b
    # Run recce and output to the specified path
    recce run -o my_recce_state.json

    \b
    # Run recce and output to the specified path
    recce run --cloud --cloud-token <token> --password <password>

    """
    from rich.console import Console
    handle_debug_flag(**kwargs)
    console = Console()
    is_github_action, pr_url = check_github_ci_env(**kwargs)
    if is_github_action is True and pr_url is not None:
        kwargs['github_pull_request_url'] = pr_url

    # Initialize Recce Config
    RecceConfig(config_file=kwargs.get('config'))

    cloud_mode = kwargs.get('cloud', False)
    state_file = kwargs.get('state_file')
    cloud_options = {
        'host': kwargs.get('state_file_host'),
        'token': kwargs.get('cloud_token'),
        'password': kwargs.get('password'),
    } if cloud_mode else None

    state_loader = create_state_loader(review_mode=False, cloud_mode=cloud_mode, state_file=state_file,
                                       cloud_options=cloud_options)

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    # Verify the output state file path
    try:
        if os.path.isdir(output) or output.endswith('/'):

            output_dir = Path(output)
            # Create the directory if not exists
            output_dir.mkdir(parents=True, exist_ok=True)
            output = os.path.join(output, DEFAULT_RECCE_STATE_FILE)
            console.print(
                f"[[yellow]Warning[/yellow]] The path '{output_dir}' is a directory. "
                f"The state file will be saved as '{output}'.")
        else:
            # Create the parent directory if not exists
            output_dir = Path(output).parent
            output_dir.mkdir(parents=True, exist_ok=True)
    except FileExistsError as e:
        console.print(f"[[red]Error[/red]] Failed to access file path '{output}'.")
        console.print(f"Reason: {e}")
        exit(1)

    return asyncio.run(cli_run(output, state_loader=state_loader, **kwargs))


@cli.command(cls=TrackCommand)
@click.argument('state_file', required=False)
@click.option('--format', '-f', help='Output format. Currently only markdown is supported.',
              type=click.Choice(['markdown', 'mermaid', 'check'], case_sensitive=False),
              default='markdown', show_default=True, hidden=True)
@add_options(dbt_related_options)
@add_options(recce_options)
@add_options(recce_cloud_options)
def summary(state_file, **kwargs):
    """
        Generate a summary of the recce state file
    """
    from rich.console import Console
    from .core import load_context
    handle_debug_flag(**kwargs)
    console = Console()
    cloud_mode = kwargs.get('cloud', False)
    cloud_options = {
        'host': kwargs.get('state_file_host'),
        'token': kwargs.get('cloud_token'),
        'password': kwargs.get('password'),
    } if cloud_mode else None

    state_loader = create_state_loader(review_mode=True, cloud_mode=cloud_mode, state_file=state_file,
                                       cloud_options=cloud_options)

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)
    try:
        # Load context in review mode, won't need to check dbt_project.yml file.
        ctx = load_context(**kwargs, state_loader=state_loader, review=True)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to generate summary")
        console.print(f"{e}")
        exit(1)

    output = generate_markdown_summary(ctx, summary_format=kwargs.get('format'))
    print(output)


@cli.group('cloud', short_help='Manage Recce Cloud state file.')
def cloud(**kwargs):
    # Manage Recce Cloud.
    pass


@cloud.command(cls=TrackCommand)
@click.option('--cloud-token', help='The token used by Recce Cloud.', type=click.STRING,
              envvar='GITHUB_TOKEN')
@click.option('--state-file-host', help='The host to fetch the state file from.', type=click.STRING,
              envvar='RECCE_STATE_FILE_HOST', default='', hidden=True)
@click.option('--force', '-f', help='Bypasses the confirmation prompt. Purge the state file directly.', is_flag=True)
@add_options(recce_options)
def purge(**kwargs):
    """
        Purge the state file from cloud
    """
    from rich.console import Console
    handle_debug_flag(**kwargs)
    console = Console()
    recce_state = None
    cloud_options = {
        'host': kwargs.get('state_file_host'),
        'token': kwargs.get('cloud_token'),
    }
    force_to_purge = kwargs.get('force', False)

    try:
        console.rule('Check Recce State from Cloud')
        recce_state = RecceStateLoader(review_mode=False, cloud_mode=True,
                                       state_file=None, cloud_options=cloud_options)
    except Exception:
        console.print("[[yellow]Skip[/yellow]] Cannot access existing state file from cloud. Purge it directly.")

    if recce_state is None:
        try:
            if force_to_purge is True or click.confirm('\nDo you want to purge the state file?'):
                rc, err_msg = RecceCloudStateManager(cloud_options).purge_cloud_state()
                if rc is True:
                    console.rule('Purged Successfully')
                else:
                    console.rule('Failed to Purge', style='red')
                    console.print(f'Reason: {err_msg}')

        except click.exceptions.Abort:
            pass
        return 0

    info = recce_state.info()
    if info is None:
        console.print("[[yellow]Skip[/yellow]] No state file found in cloud.")
        return 0

    pr_info = info.get('pull_request')
    console.print('[green]State File hosted by[/green]', info.get('source'))
    console.print('[green]GitHub Repository[/green]', info.get('pull_request').repository)
    console.print(f'[green]GitHub Pull Request[/green]\n{pr_info.title} #{pr_info.id}')
    console.print(f'Branch merged into [blue]{pr_info.base_branch}[/blue] from [blue]{pr_info.branch}[/blue]')
    console.print(pr_info.url)

    try:
        if force_to_purge is True or click.confirm('\nDo you want to purge the state file?'):
            response = recce_state.purge()
            if response is True:
                console.rule('Purged Successfully')
            else:
                console.rule('Failed to Purge', style='red')
                console.print(f'Reason: {recce_state.error_message}')
    except click.exceptions.Abort:
        pass

    return 0


@cloud.command(cls=TrackCommand)
@click.argument('state_file', type=click.Path(exists=True))
@click.option('--cloud-token', help='The token used by Recce Cloud.', type=click.STRING,
              envvar='GITHUB_TOKEN')
@click.option('--state-file-host', help='The host to fetch the state file from.', type=click.STRING,
              envvar='RECCE_STATE_FILE_HOST', default='', hidden=True)
@click.option('--password', '-p', help='The password to encrypt the state file in cloud.', type=click.STRING,
              envvar='RECCE_STATE_PASSWORD')
@add_options(recce_options)
def upload(state_file, **kwargs):
    """
        Upload the state file to cloud
    """
    from rich.console import Console

    handle_debug_flag(**kwargs)
    cloud_options = {
        'host': kwargs.get('state_file_host'),
        'token': kwargs.get('cloud_token'),
        'password': kwargs.get('password'),
    }

    console = Console()

    # load local state
    recce_state = create_state_loader(review_mode=False, cloud_mode=False, state_file=state_file,
                                      cloud_options=cloud_options)

    if not recce_state.verify():
        error, hint = recce_state.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    # check if state exists in cloud
    state_manager = RecceCloudStateManager(cloud_options)
    cloud_state_file_exists = state_manager.check_cloud_state_exists()

    if cloud_state_file_exists and not click.confirm('\nDo you want to overwrite the existing state file?'):
        return 0

    console.print(state_manager.upload_state_to_cloud(recce_state.state))


@cloud.command(cls=TrackCommand)
@click.option('-o', '--output', help='Path of the downloaded state file.', type=click.STRING,
              default=DEFAULT_RECCE_STATE_FILE, show_default=True)
@click.option('--cloud-token', help='The token used by Recce Cloud.', type=click.STRING,
              envvar='GITHUB_TOKEN')
@click.option('--state-file-host', help='The host to fetch the state file from.', type=click.STRING,
              envvar='RECCE_STATE_FILE_HOST', default='', hidden=True)
@click.option('--password', '-p', help='The password to encrypt the state file in cloud.', type=click.STRING,
              envvar='RECCE_STATE_PASSWORD')
@add_options(recce_options)
def download(**kwargs):
    """
        Download the state file to cloud
    """
    from rich.console import Console

    handle_debug_flag(**kwargs)
    filepath = kwargs.get('output')
    cloud_options = {
        'host': kwargs.get('state_file_host'),
        'token': kwargs.get('cloud_token'),
        'password': kwargs.get('password'),
    }

    console = Console()

    # check if state exists in cloud
    state_manager = RecceCloudStateManager(cloud_options)
    cloud_state_file_exists = state_manager.check_cloud_state_exists()

    if not cloud_state_file_exists:
        console.print('[yellow]Skip[/yellow] No state file found in cloud.')
        return 0

    state_manager.download_state_from_cloud(filepath)
    console.print(f'Downloaded state file to "{filepath}"')


@cli.group('github', short_help='GitHub related commands', hidden=True)
def github(**kwargs):
    pass


@github.command(cls=TrackCommand,
                short_help='Download the artifacts from the GitHub repository based on the current Pull Request.')
@click.option('--github-token', help='The github token to use for accessing GitHub repo.', type=click.STRING,
              envvar='GITHUB_TOKEN')
@click.option('--github-repo', help='The github repo to use for accessing GitHub repo.', type=click.STRING,
              envvar='GITHUB_REPOSITORY')
def artifact(**kwargs):
    from recce.github import recce_ci_artifact
    return recce_ci_artifact(**kwargs)


if __name__ == "__main__":
    cli()
