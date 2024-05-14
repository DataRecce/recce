import asyncio
from typing import List

import click

from recce import event
from recce.config import RecceConfig, RECCE_CONFIG_FILE, RECCE_ERROR_LOG_FILE
from recce.run import cli_run, check_github_ci_env
from recce.summary import generate_markdown_summary
from .core import RecceContext
from .event.track import TrackCommand

event.init()


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
    """Environment diff tool for DBT"""


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
@click.option('--review', is_flag=True, help='Open the state file in review mode.')
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
def server(host, port, state_file=None, **kwargs):
    """
    Launch the recce server

    Arguments:\n

    STATE_FILE: The path to the recce state file. Defaults=None, which will be no persistent state.

    """
    import uvicorn
    from .server import app, AppState
    from rich.console import Console

    is_review = kwargs.get('review', False)
    console = Console()
    if not state_file and is_review is True:
        console.print("[[red]Error[/red]] Cannot launch server in review mode without a state file.")
        console.print("Please provide a state file in the command argument.")
        exit(1)

    if is_review:
        console.rule("Recce Server : Review Mode")
    else:
        console.rule("Recce Server")

    state = AppState(state_file=state_file, kwargs=kwargs)
    app.state = state

    uvicorn.run(app, host=host, port=port, lifespan='on')


@cli.command(cls=TrackCommand)
@click.option('-o', '--output', help='Path of the output state file.', type=click.Path(), default='recce_state.json',
              show_default=True)
@click.option('--state-file', help='Path of the import state file.', type=click.Path())
@click.option('--skip-query', is_flag=True, help='Skip querying row count for nodes in the lineage.')
@click.option('--git-current-branch', help='The git branch of the current environment.', type=click.STRING,
              envvar='GITHUB_HEAD_REF')
@click.option('--git-base-branch', help='The git branch of the base environment.', type=click.STRING,
              envvar='GITHUB_BASE_REF')
@click.option('--github-pull-request-url', help='The github pull request url to use for the lineage.',
              type=click.STRING)
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
def run(output, **kwargs):
    is_github_action, pr_url = check_github_ci_env(**kwargs)
    if is_github_action is True and pr_url is not None:
        kwargs['github_pull_request_url'] = pr_url

    # Initialize Recce Config
    RecceConfig(config_file=kwargs.get('config'))

    return asyncio.run(cli_run(output, **kwargs))


@cli.command(cls=TrackCommand)
@click.argument('state_file', required=True)
@click.option('--format', '-f', help='Output format. Currently only markdown is supported.',
              type=click.Choice(['markdown', 'mermaid', 'check'], case_sensitive=False),
              default='markdown', show_default=True, hidden=True)
def summary(state_file, **kwargs):
    from rich.console import Console
    from .core import load_context
    console = Console()
    try:
        # Load context in review mode, won't need to check dbt_project.yml file.
        ctx = load_context(**kwargs, state_file=state_file, review=True)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to generate summary:")
        console.print(f"{e}")
        exit(1)

    output = generate_markdown_summary(ctx, summary_format=kwargs.get('format'))
    console.print(output)


if __name__ == "__main__":
    cli()
