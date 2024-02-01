from typing import List

import click

from recce import event
from .dbt import DBTContext
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


def _execute_sql(dbt_context, sql_template, base=False):
    try:
        import pandas as pd
    except ImportError:
        print("'pandas' package not found. You can install it using the command: 'pip install pandas'.")
        exit(1)

    adapter = dbt_context.adapter
    with adapter.connection_named('recce'):
        sql = dbt_context.generate_sql(sql_template, base)
        response, result = adapter.execute(sql, fetch=True, auto_begin=True)
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
    dbt_context = DBTContext.load(**kwargs)
    result = _execute_sql(dbt_context, sql, base=base)
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

    dbt_context = DBTContext.load(**kwargs)
    before = _execute_sql(dbt_context, sql, base=True)
    if primary_keys is not None:
        before.set_index(primary_keys, inplace=True)
    after = _execute_sql(dbt_context, sql, base=False)
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
@add_options(dbt_related_options)
def server(host, port, state_file=None, **kwargs):
    """
    Launch the recce server

    Arguments:\n

    STATE_FILE: The path to the recce state file. Defaults=None, which will be no persistent state.

    """
    import uvicorn
    from .server import app, AppState
    from .dbt import load_dbt_context

    load_dbt_context(**kwargs)

    state = AppState(state_file=state_file)
    app.state = state

    uvicorn.run(app, host=host, port=port, lifespan='on')


if __name__ == "__main__":
    cli()
