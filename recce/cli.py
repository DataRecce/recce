import click

from recce import event
from .dbt import DBTContext
from .diff import diff_text, diff_dataframe
from .event.track import TrackCommand
from .impact import inspect_sql, get_inspector

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
@click.argument('resource_name', required=False)
@click.argument('method', default='summary')
@click.option('--sql', help='Sql to query', required=False)
def inspect(resource_name, method, sql, **kwargs):
    """
    Inspect a resource or run a query
    """
    dbt_context = DBTContext.load()
    if sql is not None:
        print(inspect_sql(dbt_context, sql).to_string(index=False))
        return

    resource = dbt_context.find_resource_by_name(resource_name)
    if resource is None:
        print(f"resource not found: {resource_name}")
        return 0

    resource = dbt_context.find_resource_by_name(resource_name)
    inspector = get_inspector(resource.resource_type, method)
    output = inspector(dbt_context, resource)
    print(output)


@cli.command(cls=TrackCommand)
@click.argument('resource_name', required=False)
@click.argument('method', default='summary')
@click.option('--sql', help='Sql to query', required=False)
def diff(resource_name, method, sql, **kwargs):
    """
    Diff a resource or run a query between two states.
    """

    dbt_context = DBTContext.load()

    if sql is not None:
        before = inspect_sql(dbt_context, sql, base=True)
        after = inspect_sql(dbt_context, sql, base=False)
        diff_dataframe(before, after)
    else:

        node = dbt_context.find_resource_by_name(resource_name)
        base_node = dbt_context.find_resource_by_name(resource_name, base=True)
        inspector = get_inspector(node.resource_type, method)

        before = inspector(dbt_context, base_node) if base_node is not None else ''
        after = inspector(dbt_context, node) if node is not None else ''
        diff_text(before, after)


@cli.command(cls=TrackCommand)
def server():
    """
    Launch the local server
    """

    import uvicorn
    from .server import load_dbt_context, app

    load_dbt_context()
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    cli()
