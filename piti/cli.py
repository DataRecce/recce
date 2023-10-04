import difflib
import json
import os

import click
import sqlalchemy as sa

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

    with open('target/manifest.json', 'r') as file:
        data = json.load(file)
    selected_node = find_model_by_name(data, resource_name)
    if selected_node is None:
        print(f"resource not found: {resource_name}")
        return 0

    engine = sa.create_engine(conn_str)
    with engine.connect() as conn:
        print(inspect_model_summary(conn, selected_node))


def find_model_by_name(data, resource_name):
    for key, node in data.get("nodes", {}).items():
        if node.get("name") == resource_name and node.get("resource_type") == "model":
            selected_node = {
                "name": node.get("name"),
                "schema": node.get("schema"),
            }
            break
    return selected_node

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

    with open('target/manifest.json', 'r') as file:
        target = json.load(file)
    target_node = find_model_by_name(target, resource_name)

    with open('target-base/manifest.json', 'r') as file:
        base = json.load(file)
    base_node = find_model_by_name(base, resource_name)

    engine = sa.create_engine(conn_str)
    with engine.connect() as conn:
        base_output = inspect_model_summary(conn, base_node)
        target_output = inspect_model_summary(conn, target_node)

    diff_output = difflib.unified_diff(base_output.splitlines(), target_output.splitlines(), "base", "target", n=999,
                                       lineterm="")
    for line in diff_output:
        print(line)


@cli.command()
def analyze():
    """Analyze the impact between before and after."""
    click.echo("Hello, World!")


if __name__ == "__main__":
    cli()
