import click
import requests
import yaml

from piti.dbt import DBTContext
from piti.diff import diff_text, diff_dataframe
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

@cli.command()
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

@cli.command()
def lineagediff():
    """
    Show the lineage diff in the piperider cloud.
    """

    files = [
        ('files', ('base.json', open('target-base/manifest.json', 'rb'))),
        ('files', ('current.json', open('target/manifest.json', 'rb'))),
    ]

    print("uploading...")
    response = requests.post("https://cloud.piperider.io/api/v2/manifest/upload", files=files)
    result = response.json()
    url = f"https://cloud.piperider.io/quick-look/comparisons/{result.get('comparison_id')}?utm_source=piti#/?g_v=1"
    print("report url: ", url)
    import webbrowser
    webbrowser.open(url)


@cli.command()
def server():
    import uvicorn
    import webbrowser
    import threading
    import time
    from .server import app

    DBTContext.load()

    def run_browser():
        time.sleep(2)
        url = 'http://localhost:8000'
        webbrowser.open(url)

    # Start the server in a new thread
    thread = threading.Thread(target=run_browser)
    thread.start()

    uvicorn.run(app, host="0.0.0.0", port=8000)




if __name__ == "__main__":
    cli()
