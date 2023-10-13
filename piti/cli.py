import difflib

import click

from piti.dbt import DBTContext
from piti.impact import inspect_sql, get_inspector


@click.group()
@click.pass_context
def cli(ctx, **kwargs):
    """The impact analysis tool for DBT"""


@cli.command()
@click.argument('resource_name', required=False)
@click.argument('method', default='summary')
@click.option('--sql', help='Sql to query', required=False)
def inspect(resource_name, method, sql, **kwargs):
    """
    Inspect a resource or run a query
    """
    dbtContext = DBTContext.load()
    if sql is not None:
        print(inspect_sql(dbtContext, sql))
        return

    resource = dbtContext.find_resource_by_name(resource_name)
    if resource is None:
        print(f"resource not found: {resource_name}")
        return 0

    resource = dbtContext.find_resource_by_name(resource_name)
    inspector = get_inspector(resource.resource_type, method)
    output = inspector(dbtContext, resource)
    print(output)

@cli.command()
@click.argument('resource_name', required=False)
@click.argument('method', default='summary')
@click.option('--sql', help='Sql to query', required=False)
def diff(resource_name, method, sql, **kwargs):
    """
    Diff a resource or run a query between two states.
    """

    dbtContext = DBTContext.load()


    if sql is not None:
        before = inspect_sql(dbtContext, sql, base=False)
        after = inspect_sql(dbtContext, sql, base=True)
    else:

        node = dbtContext.find_resource_by_name(resource_name)
        if node is None:
            print(f"resource not found: {resource_name}")
            return

        base_node = dbtContext.find_resource_by_name(resource_name, base=True)
        inspector = get_inspector(node.resource_type, method)

        before = inspector(dbtContext, base_node) if base_node is not None else ''
        after = inspector(dbtContext, node) if node is not None else ''

    if before == after:
        print('no changes')
        return
    else:
        diff_output = difflib.unified_diff(
            before.splitlines(),
            after.splitlines(),
            "base",
            "current",
            lineterm=""
        )
        for line in diff_output:
            print(line)


@cli.command()
@click.pass_context
@click.option('--impact-file', '-f', default='impact.yml', help='The impact configuration file. Default: impact.yml')
def analyze(ctx, **kwargs):
    """Analyze the impact between two states."""
    print("Not implemented yet.")


if __name__ == "__main__":
    cli()
