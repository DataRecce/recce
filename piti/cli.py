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
    dbtContext = DBTContext.load()
    if sql is not None:
        print(inspect_sql(dbtContext, sql).to_string(index=False))
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
        before = inspect_sql(dbtContext, sql, base=True)
        after = inspect_sql(dbtContext, sql, base=False)
        diff_dataframe(before, after)
    else:

        node = dbtContext.find_resource_by_name(resource_name)
        base_node = dbtContext.find_resource_by_name(resource_name, base=True)
        inspector = get_inspector(node.resource_type, method)

        before = inspector(dbtContext, base_node) if base_node is not None else ''
        after = inspector(dbtContext, node) if node is not None else ''
        diff_text(before, after)


@cli.command()
@click.pass_context
@click.option('--impact-file', '-f', default='impact.yml', help='The impact configuration file. Default: impact.yml')
def analyze(ctx, **kwargs):
    """Analyze the impact between two states."""
    dbtContext = DBTContext.load()

    with open('impacts.yml', 'r') as yaml_file:
        parsed_data = yaml.safe_load(yaml_file)

    impacts = parsed_data.get("impacts", [])
    for impact in impacts:
        name = impact.get("name")
        resource_name = impact.get("resource_name")
        method = impact.get("method", "summary")

        node = dbtContext.find_resource_by_name(resource_name)
        base_node = dbtContext.find_resource_by_name(resource_name, base=True)
        inspector = get_inspector(node.resource_type, method)

        before = inspector(dbtContext, base_node) if base_node is not None else None
        after = inspector(dbtContext, node) if node is not None else None

        if before is None and after is None:
            print(f'? {name}')
        elif before is None:
            print(f'+ {name}')
        elif after is None:
            print(f'- {name}')
        elif before == after:
            print(f'= {name}')
        else:
            print(f'! {name}')


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
    from piti.server import app
    def run_browser():
        time.sleep(2)
        url = 'http://localhost:8000/index.html'
        webbrowser.open(url)

    # Start the server in a new thread
    thread = threading.Thread(target=run_browser)
    thread.start()

    uvicorn.run(app, host="0.0.0.0", port=8000)




if __name__ == "__main__":
    cli()
