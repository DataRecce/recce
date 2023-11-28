from typing import List

import click

from recce import event
from .dbt import DBTContext
from .event.track import TrackCommand

event.init()


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


@cli.command(cls=TrackCommand)
@click.option('--sql', help='Sql template to query', required=True)
@click.option('--base', is_flag=True, help='Run the query on the base environment')
def query(sql, base: bool = False):
    """
    Run a query on the current or base environment

    Examples:\n

    - run an adhoc query\n
        recce query --sql 'select * from {{ ref("mymodel") }} order by 1'

    - run an adhoc query on base environment\n
        recce query --base --sql 'select * from {{ ref("mymodel") }} order by 1'
    """
    dbt_context = DBTContext.load()
    result = dbt_context.execute_sql(sql, base=base)
    print(result.to_string(na_rep='-', index=False))


def _split_comma_separated(ctx, param, value):
    return value.split(',') if value else None


@cli.command(cls=TrackCommand)
@click.option('--sql', help='Sql template to query.', required=True)
@click.option('--primary-keys', type=click.STRING, help='Comma-separated list of primary key columns.',
              callback=_split_comma_separated)
@click.option('--keep-shape', is_flag=True, help='Keep unchanged columns. Otherwise, unchanged columns are hidden.')
@click.option('--keep-equal', is_flag=True,
              help='Keep values that are equal. Otherwise, equal values are shown as "-".')
def diff(sql, primary_keys: List[str] = None, keep_shape: bool = False, keep_equal: bool = False):
    """
    Run queries on base and current environments and diff the results

    Examples:\n

    - run adhoc queries and diff the results\n
        recce diff --sql 'select * from {{ ref("mymodel") }} order by 1'
    """

    dbt_context = DBTContext.load()
    before = dbt_context.execute_sql(sql, base=True)
    if primary_keys is not None:
        before.set_index(primary_keys, inplace=True)
    after = dbt_context.execute_sql(sql, base=False)
    if primary_keys is not None:
        after.set_index(primary_keys, inplace=True)

    before_aligned, after_aligned = before.align(after)
    diff = before_aligned.compare(after_aligned,
                                  result_names=('base', 'current'),
                                  keep_equal=keep_equal,
                                  keep_shape=keep_shape)
    print(diff.to_string(na_rep='-') if not diff.empty else 'no changes')


@cli.command(cls=TrackCommand)
@click.option('--host', default='0.0.0.0', show_default=True, help='The host to bind to.')
@click.option('--port', default=8000, show_default=True, help='The port to bind to.', type=int)
def server(host, port):
    """
    Launch the recce server
    """

    import uvicorn
    from .server import load_dbt_context, app

    load_dbt_context()
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    cli()
