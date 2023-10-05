import difflib
import os

import click
import sqlalchemy as sa

from piti.dbt import load_dbt_manifest, test_connection
from piti.impact import inspect_model_summary


@click.group()
def cli():
    """The impact analysis tool for DBT"""


@cli.command()
@click.argument('resource_name')
def inspect(resource_name):
    """Inspect the resource.

    Examples:

        piti inspect <resource>

        piti inspect <resource> <method>

    """

    conn_str = os.environ['CONNECTION_STRING']
    if not os.environ['CONNECTION_STRING']:
        print("no connection string")
        return 0

    manifest = load_dbt_manifest('target/manifest.json')

    selected_node = manifest.find_model_by_name(resource_name)
    if selected_node is None:
        print(f"resource not found: {resource_name}")
        return 0

    engine = sa.create_engine(conn_str)
    with engine.connect() as conn:
        print(inspect_model_summary(conn, selected_node))

@cli.command()
@click.argument('resource_name')
def diff(resource_name):
    """
    A simple CLI tool that says hello.
    """

    conn_str = os.environ['CONNECTION_STRING']
    if not os.environ['CONNECTION_STRING']:
        print("no connection string")
        return 0

    base_node = load_dbt_manifest('target-base/manifest.json').find_model_by_name(resource_name)
    target_node = load_dbt_manifest('target/manifest.json').find_model_by_name(resource_name)

    engine = sa.create_engine(conn_str)
    with engine.connect() as conn:
        base_output = inspect_model_summary(conn, base_node)
        target_output = inspect_model_summary(conn, target_node)

    diff_output = difflib.unified_diff(
        base_output.splitlines(),
        target_output.splitlines(),
        "base",
        "target",
        n=999,
        lineterm=""
    )
    for line in diff_output:
        print(line)


@cli.command()
def analyze():
    """Analyze the impact between before and after."""
    test_connection()


if __name__ == "__main__":
    cli()
