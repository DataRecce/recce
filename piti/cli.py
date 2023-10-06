import difflib

import click

from piti.dbt import DBTContext
from piti.impact import inspect_model_summary, inspect_sql


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

    selected_node = dbtContext.find_model_by_name(resource_name)
    if selected_node is None:
        print(f"resource not found: {resource_name}")
        return 0
    selected_node = dbtContext.find_model_by_name(resource_name)
    print(inspect_model_summary(dbtContext, selected_node))

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

        node = dbtContext.find_model_by_name(resource_name)
        if node is None:
            print(f"resource not found: {resource_name}")
            return

        base_node = dbtContext.find_model_by_name(resource_name, base=True)

        before = inspect_model_summary(dbtContext, base_node)
        after = inspect_model_summary(dbtContext, node)

    if before == after:
        print(before)
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
