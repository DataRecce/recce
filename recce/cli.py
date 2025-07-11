import asyncio
import os
from pathlib import Path
from typing import List

import click
import uvicorn
from click import Abort

from recce import event
from recce.artifact import download_dbt_artifacts, upload_dbt_artifacts
from recce.config import RECCE_CONFIG_FILE, RECCE_ERROR_LOG_FILE, RecceConfig
from recce.connect_to_cloud import (
    generate_key_pair,
    prepare_connection_url,
    run_one_time_http_server,
)
from recce.exceptions import RecceConfigException
from recce.git import current_branch, current_default_branch
from recce.run import check_github_ci_env, cli_run
from recce.server import RecceServerMode
from recce.state import RecceCloudStateManager, RecceShareStateManager, RecceStateLoader
from recce.summary import generate_markdown_summary
from recce.util.api_token import prepare_api_token, show_invalid_api_token_message
from recce.util.logger import CustomFormatter
from recce.util.onboarding_state import update_onboarding_state
from recce.util.recce_cloud import (
    RecceCloudException,
)

from .core import RecceContext, set_default_context
from .event.track import TrackCommand

event.init()


def create_state_loader(review_mode, cloud_mode, state_file, cloud_options):
    from rich.console import Console

    console = Console()

    try:
        return RecceStateLoader(
            review_mode=review_mode, cloud_mode=cloud_mode, state_file=state_file, cloud_options=cloud_options
        )
    except RecceCloudException as e:
        console.print("[[red]Error[/red]] Failed to load recce state file")
        console.print(f"Reason: {e.reason}")
        exit(1)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to load recce state file")
        console.print(f"Reason: {e}")
        exit(1)


def handle_debug_flag(**kwargs):
    if kwargs.get("debug"):
        import logging

        ch = logging.StreamHandler()
        ch.setFormatter(CustomFormatter())
        logging.basicConfig(handlers=[ch], level=logging.DEBUG)


def add_options(options):
    def _add_options(func):
        for option in reversed(options):
            func = option(func)
        return func

    return _add_options


dbt_related_options = [
    click.option("--target", "-t", help="Which target to load for the given profile.", type=click.STRING),
    click.option("--profile", help="Which existing profile to load.", type=click.STRING),
    click.option(
        "--project-dir",
        help="Which directory to look in for the dbt_project.yml file.",
        type=click.Path(),
        envvar="DBT_PROJECT_DIR",
    ),
    click.option(
        "--profiles-dir",
        help="Which directory to look in for the profiles.yml file.",
        type=click.Path(),
        envvar="DBT_PROFILES_DIR",
    ),
]

sqlmesh_related_options = [
    click.option("--sqlmesh", is_flag=True, help="Use SQLMesh ", hidden=True),
    click.option("--sqlmesh-envs", is_flag=False, help="SQLMesh envs to compare. SOURCE:TARGET", hidden=True),
    click.option("--sqlmesh-config", is_flag=False, help="SQLMesh config name to use", hidden=True),
]

recce_options = [
    click.option(
        "--config",
        help="Path to the recce config file.",
        type=click.Path(),
        default=RECCE_CONFIG_FILE,
        show_default=True,
    ),
    click.option(
        "--error-log", help="Path to the error log file.", type=click.Path(), default=RECCE_ERROR_LOG_FILE, hidden=True
    ),
    click.option("--debug", is_flag=True, help="Enable debug mode.", hidden=True),
]

recce_cloud_options = [
    click.option("--cloud", is_flag=True, help="Fetch the state file from cloud."),
    click.option(
        "--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN"
    ),
    click.option(
        "--state-file-host",
        help="The host to fetch the state file from.",
        type=click.STRING,
        envvar="RECCE_STATE_FILE_HOST",
        default="",
        hidden=True,
    ),
    click.option(
        "--password",
        "-p",
        help="The password to encrypt the state file in cloud.",
        type=click.STRING,
        envvar="RECCE_STATE_PASSWORD",
    ),
]

recce_dbt_artifact_dir_options = [
    click.option(
        "--target-path",
        help="dbt artifacts directory for your development branch.",
        type=click.STRING,
        default="target",
    ),
    click.option(
        "--target-base-path",
        help="dbt artifacts directory to be used as the base for the comparison.",
        type=click.STRING,
        default="target-base",
    ),
]

recce_hidden_options = [
    click.option(
        "--mode",
        envvar="RECCE_SERVER_MODE",
        type=click.Choice(RecceServerMode.available_members(), case_sensitive=False),
        hidden=True,
    ),
    click.option(
        "--share-url",
        help="The share URL triggers this instance.",
        type=click.STRING,
        envvar="RECCE_SHARE_URL",
        hidden=True,
    ),
]


def _execute_sql(context, sql_template, base=False):
    try:
        import pandas as pd
    except ImportError:
        print("'pandas' package not found. You can install it using the command: 'pip install pandas'.")
        exit(1)

    from recce.adapter.dbt_adapter import DbtAdapter

    dbt_adapter: DbtAdapter = context.adapter
    with dbt_adapter.connection_named("recce"):
        sql = dbt_adapter.generate_sql(sql_template, base)
        response, result = dbt_adapter.execute(sql, fetch=True, auto_begin=True)
        table = result
        df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)
        return df


@click.group()
@click.pass_context
def cli(ctx, **kwargs):
    """Recce: Data validation toolkit for comprehensive PR review"""
    from rich.console import Console

    from recce import __is_recce_outdated__, __latest_version__

    if __is_recce_outdated__ is True:
        error_console = Console(stderr=True, style="bold")
        error_console.print(
            f"[[yellow]Update Available[/yellow]] A new version of Recce {__latest_version__} is available.",
        )
        error_console.print("Please update using the command: 'pip install --upgrade recce'.", end="\n\n")


@cli.command(cls=TrackCommand)
def version():
    """
    Show version information
    """
    from recce import __version__

    print(__version__)


@cli.command(cls=TrackCommand)
@add_options(dbt_related_options)
@add_options(recce_dbt_artifact_dir_options)
def debug(**kwargs):
    """
    Diagnose and verify Recce setup for the development and the base environments
    """

    from rich.console import Console

    from recce.adapter.dbt_adapter import DbtAdapter
    from recce.core import load_context

    console = Console()

    def check_artifacts(env_name, target_path):
        console.rule(f"{env_name} Environment", style="orange3")
        if not target_path.is_dir():
            console.print(f"[[red]MISS[/red]] Directory not found: {target_path}")
            return [False, False, False]

        console.print(f"[[green]OK[/green]] Directory exists: {target_path}")

        manifest_path = target_path / "manifest.json"
        manifest_is_ready = manifest_path.is_file()
        if manifest_is_ready:
            console.print(f"[[green]OK[/green]] Manifest JSON file exists : {manifest_path}")
        else:
            console.print(f"[[red]MISS[/red]] Manifest JSON file not found: {manifest_path}")

        catalog_path = target_path / "catalog.json"
        catalog_is_ready = catalog_path.is_file()
        if catalog_is_ready:
            console.print(f"[[green]OK[/green]] Catalog JSON file exists: {catalog_path}")
        else:
            console.print(f"[[red]MISS[/red]] Catalog JSON file not found: {catalog_path}")

        return [True, manifest_is_ready, catalog_is_ready]

    project_dir_path = Path(kwargs.get("project_dir") or "./")
    target_path = project_dir_path.joinpath(Path(kwargs.get("target_path", "target")))
    target_base_path = project_dir_path.joinpath(Path(kwargs.get("target_base_path", "target-base")))

    curr_is_ready = check_artifacts("Development", target_path)
    base_is_ready = check_artifacts("Base", target_base_path)

    console.rule("Warehouse Connection", style="orange3")
    conn_is_ready = True
    try:
        context_kwargs = {**kwargs, "target_base_path": kwargs.get("target_path")}
        ctx = load_context(**context_kwargs)
        dbt_adapter: DbtAdapter = ctx.adapter
        sql = dbt_adapter.generate_sql("select 1", False)
        dbt_adapter.execute(sql, fetch=True, auto_begin=True)
        console.print("[[green]OK[/green]] Connection test")
    except Exception:
        conn_is_ready = False
        console.print("[[red]FAIL[/red]] Connection test")

    console.rule("Result", style="orange3")
    if all(curr_is_ready) and all(base_is_ready) and conn_is_ready:
        console.print("[[green]OK[/green]] Ready to launch! Type 'recce server'.")
    elif all(curr_is_ready) and conn_is_ready:
        console.print("[[orange3]OK[/orange3]] Ready to launch with [i]limited features[/i]. Type 'recce server'.")

    if not curr_is_ready[0]:
        console.print(
            "[[orange3]TIP[/orange3]] Run dbt or overwrite the default directory of the development environment with '--target-path'."
        )
    else:
        if not curr_is_ready[1]:
            console.print(
                "[[orange3]TIP[/orange3]] 'dbt run' to generate the manifest JSON file for the development environment."
            )
        if not curr_is_ready[2]:
            console.print(
                "[[orange3]TIP[/orange3]] 'dbt docs generate' to generate the catalog JSON file for the development environment."
            )

    if not base_is_ready[0]:
        console.print(
            "[[orange3]TIP[/orange3]] Run dbt with '--target-path target-base' or overwrite the default directory of the base environment with '--target-base-path'."
        )
    else:
        if not base_is_ready[1]:
            console.print(
                "[[orange3]TIP[/orange3]] 'dbt run --target-path target-base' to generate the manifest JSON file for the base environment."
            )
        if not base_is_ready[2]:
            console.print(
                "[[orange3]TIP[/orange3]] 'dbt docs generate --target-path target-base' to generate the catalog JSON file for the base environment."
            )

    if not conn_is_ready:
        console.print("[[orange3]TIP[/orange3]] Run 'dbt debug' to check the connection.")


@cli.command(hidden=True, cls=TrackCommand)
@click.option("--sql", help="Sql template to query", required=True)
@click.option("--base", is_flag=True, help="Run the query on the base environment")
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
    print(result.to_string(na_rep="-", index=False))


def _split_comma_separated(ctx, param, value):
    return value.split(",") if value else None


@cli.command(hidden=True, cls=TrackCommand)
@click.option("--sql", help="Sql template to query.", required=True)
@click.option(
    "--primary-keys",
    type=click.STRING,
    help="Comma-separated list of primary key columns.",
    callback=_split_comma_separated,
)
@click.option("--keep-shape", is_flag=True, help="Keep unchanged columns. Otherwise, unchanged columns are hidden.")
@click.option(
    "--keep-equal", is_flag=True, help='Keep values that are equal. Otherwise, equal values are shown as "-".'
)
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
    diff = before_aligned.compare(
        after_aligned, result_names=("base", "current"), keep_equal=keep_equal, keep_shape=keep_shape
    )
    print(diff.to_string(na_rep="-") if not diff.empty else "no changes")


@cli.command(cls=TrackCommand)
@click.argument("state_file", required=False)
@click.option("--host", default="localhost", show_default=True, help="The host to bind to.")
@click.option("--port", default=8000, show_default=True, help="The port to bind to.", type=int)
@click.option("--lifetime", default=0, show_default=True, help="The lifetime of the server in seconds.", type=int)
@click.option("--review", is_flag=True, help="Open the state file in the review mode.")
@click.option("--single-env", is_flag=True, help="Launch in single environment mode directly.")
@click.option(
    "--api-token", help="The personal token generated by Recce Cloud.", type=click.STRING, envvar="RECCE_API_TOKEN"
)
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_dbt_artifact_dir_options)
@add_options(recce_cloud_options)
@add_options(recce_hidden_options)
def server(host, port, lifetime, state_file=None, **kwargs):
    """
    Launch the recce server

    STATE_FILE is the path to the recce state file. Defaults=None, which will be no persistent state.

    Examples:\n

    \b
    # Launch the recce server
    recce server

    \b
    # Launch the recce server with a state file
    recce server recce_state.json

    \b
    # Launch the server in the review mode
    recce server --review recce_state.json

    \b
    # Launch the server and synchronize the state with the cloud
    recce server --cloud
    recce server --review --cloud

    """

    from rich.console import Console
    from rich.prompt import Confirm

    from .server import AppState, app

    RecceConfig(config_file=kwargs.get("config"))

    handle_debug_flag(**kwargs)
    server_mode = kwargs.get("mode") if kwargs.get("mode") else RecceServerMode.server
    is_review = kwargs.get("review", False)
    is_cloud = kwargs.get("cloud", False)
    flag = {}
    console = Console()
    cloud_options = None

    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)
    auth_options = {
        "api_token": api_token,
    }

    if server_mode == RecceServerMode.server:
        flag = {"single_env_onboarding": False, "show_relaunch_hint": False}
        if is_cloud:
            cloud_options = {
                "host": kwargs.get("state_file_host"),
                "github_token": kwargs.get("cloud_token"),
                "password": kwargs.get("password"),
            }

        # Check Single Environment Onboarding Mode if the review mode is False
        project_dir_path = Path(kwargs.get("project_dir") or "./")
        target_base_path = project_dir_path.joinpath(Path(kwargs.get("target_base_path", "target-base")))
        if not target_base_path.is_dir() and not is_review:
            # Mark as single env onboarding mode if user provides the target-path only
            flag["single_env_onboarding"] = True
            flag["show_relaunch_hint"] = True
            # Use the target path as the base path
            kwargs["target_base_path"] = kwargs.get("target_path")
    elif server_mode == RecceServerMode.preview:
        if is_cloud:
            share_url = kwargs.get("share_url")
            share_id = share_url.split("/")[-1] if share_url else None
            cloud_options = {
                "host": kwargs.get("state_file_host"),
                "api_token": api_token,
                "share_id": share_id,
            }
        flag = {
            "preview": True,
        }
    elif server_mode == RecceServerMode.read_only:
        is_review = kwargs["review"] = True
        is_cloud = kwargs["cloud"] = False
        cloud_options = None
        flag = {
            "read_only": True,
        }
        if state_file is None:
            console.print("[[red]Error[/red]] The state_file is required in 'Read-Only' mode.")
            console.print("Please provide recce_state json file exported by Recce OSS.")
            exit(1)

    # Onboarding State logic update here
    update_onboarding_state(api_token, flag.get("single_env_onboarding"))

    state_loader = create_state_loader(is_review, is_cloud, state_file, cloud_options)

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    try:
        result, message = RecceContext.verify_required_artifacts(**kwargs)
    except Exception as e:
        result = False
        error_type = type(e).__name__
        error_message = str(e)
        message = f"{error_type}: {error_message}"
    if not result:
        console.rule("Notice", style="orange3")
        console.print(f"[[red]Error[/red]] {message}")
        exit(1)

    if state_loader.review_mode:
        console.rule("Recce Server : Review Mode")
    elif flag.get("single_env_onboarding"):
        # Show warning message
        console.rule("Notice", style="orange3")
        console.print(
            "Recce will launch with limited features (no environment comparison).\n"
            "\n"
            "For full functionality, set up a base environment first.\n"
            "Setup help: 'recce debug' or https://docs.datarecce.io/configure-diff/\n"
        )

        single_env_flag = kwargs.get("single_env", False)
        if not single_env_flag:
            lanch_in_single_env = Confirm.ask("Continue to launch Recce?")
            if not lanch_in_single_env:
                exit(0)

        console.rule("Recce Server : Limited Features")
    else:
        console.rule("Recce Server")

    state = AppState(
        command=server_mode,
        state_loader=state_loader,
        kwargs=kwargs,
        flag=flag,
        auth_options=auth_options,
        lifetime=lifetime,
        share_url=kwargs.get("share_url"),
    )
    app.state = state

    if server_mode == RecceServerMode.read_only:
        set_default_context(RecceContext.load(**kwargs, state_loader=state_loader))

    uvicorn.run(app, host=host, port=port, lifespan="on")


DEFAULT_RECCE_STATE_FILE = "recce_state.json"


@cli.command(cls=TrackCommand)
@click.option(
    "-o",
    "--output",
    help="Path of the output state file.",
    type=click.Path(),
    default=DEFAULT_RECCE_STATE_FILE,
    show_default=True,
)
@click.option("--state-file", help="Path of the import state file.", type=click.Path())
@click.option("--summary", help="Path of the summary markdown file.", type=click.Path())
@click.option("--skip-query", is_flag=True, help="Skip running the queries for the checks.")
@click.option(
    "--git-current-branch",
    help="The git branch of the current environment.",
    type=click.STRING,
    envvar="GITHUB_HEAD_REF",
)
@click.option(
    "--git-base-branch", help="The git branch of the base environment.", type=click.STRING, envvar="GITHUB_BASE_REF"
)
@click.option(
    "--github-pull-request-url", help="The github pull request url to use for the lineage.", type=click.STRING
)
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_dbt_artifact_dir_options)
@add_options(recce_cloud_options)
def run(output, **kwargs):
    """
    Run recce and output the state file

    Examples:\n

    \b
    # Run recce and output to the default path [recce_state.json]
    recce run

    \b
    # Run recce and output to the specified path
    recce run -o my_recce_state.json

    \b
    # Run recce and output to the specified path
    recce run --cloud --cloud-token <token> --password <password>

    """
    from rich.console import Console

    handle_debug_flag(**kwargs)
    console = Console()
    is_github_action, pr_url = check_github_ci_env(**kwargs)
    if is_github_action is True and pr_url is not None:
        kwargs["github_pull_request_url"] = pr_url

    # Initialize Recce Config
    RecceConfig(config_file=kwargs.get("config"))

    cloud_mode = kwargs.get("cloud", False)
    state_file = kwargs.get("state_file")
    cloud_options = (
        {
            "host": kwargs.get("state_file_host"),
            "github_token": kwargs.get("cloud_token"),
            "password": kwargs.get("password"),
        }
        if cloud_mode
        else None
    )

    state_loader = create_state_loader(
        review_mode=False, cloud_mode=cloud_mode, state_file=state_file, cloud_options=cloud_options
    )

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    result, message = RecceContext.verify_required_artifacts(**kwargs)
    if not result:
        console.print(f"[[red]Error[/red]] {message}")
        exit(1)

    # Verify the output state file path
    try:
        if os.path.isdir(output) or output.endswith("/"):

            output_dir = Path(output)
            # Create the directory if not exists
            output_dir.mkdir(parents=True, exist_ok=True)
            output = os.path.join(output, DEFAULT_RECCE_STATE_FILE)
            console.print(
                f"[[yellow]Warning[/yellow]] The path '{output_dir}' is a directory. "
                f"The state file will be saved as '{output}'."
            )
        else:
            # Create the parent directory if not exists
            output_dir = Path(output).parent
            output_dir.mkdir(parents=True, exist_ok=True)
    except FileExistsError as e:
        console.print(f"[[red]Error[/red]] Failed to access file path '{output}'.")
        console.print(f"Reason: {e}")
        exit(1)

    return asyncio.run(cli_run(output, state_loader=state_loader, **kwargs))


@cli.command(cls=TrackCommand)
@click.argument("state_file", required=False)
@click.option(
    "--format",
    "-f",
    help="Output format. Currently only markdown is supported.",
    type=click.Choice(["markdown", "mermaid", "check"], case_sensitive=False),
    default="markdown",
    show_default=True,
    hidden=True,
)
@add_options(dbt_related_options)
@add_options(recce_options)
@add_options(recce_cloud_options)
def summary(state_file, **kwargs):
    """
    Generate a summary of the recce state file
    """
    from rich.console import Console

    from .core import load_context

    handle_debug_flag(**kwargs)
    console = Console()
    cloud_mode = kwargs.get("cloud", False)
    cloud_options = (
        {
            "host": kwargs.get("state_file_host"),
            "github_token": kwargs.get("cloud_token"),
            "password": kwargs.get("password"),
        }
        if cloud_mode
        else None
    )

    state_loader = create_state_loader(
        review_mode=True, cloud_mode=cloud_mode, state_file=state_file, cloud_options=cloud_options
    )

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)
    try:
        # Load context in review mode, won't need to check dbt_project.yml file.
        ctx = load_context(**kwargs, state_loader=state_loader, review=True)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to generate summary")
        console.print(f"{e}")
        exit(1)

    output = generate_markdown_summary(ctx, summary_format=kwargs.get("format"))
    print(output)


@cli.command(cls=TrackCommand)
def connect_to_cloud():
    """
    Connect OSS to Cloud
    """
    import webbrowser

    from rich.console import Console

    console = Console()

    # Prepare RSA keys for connecting to cloud
    private_key, public_key = generate_key_pair()

    connect_url, callback_port = prepare_connection_url(public_key)
    console.rule("Connecting to Recce Cloud")
    console.print("Attempting to automatically open the Recce Cloud authorization page in your default browser.")
    console.print("If the browser does not open, please open the following URL:")
    console.print(connect_url)
    webbrowser.open(connect_url)

    # Launch a callback HTTP server for fetching the api-token
    run_one_time_http_server(private_key, port=callback_port)


@cli.group("cloud", short_help="Manage Recce Cloud state file.")
def cloud(**kwargs):
    # Manage Recce Cloud.
    pass


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--state-file-host",
    help="The host to fetch the state file from.",
    type=click.STRING,
    envvar="RECCE_STATE_FILE_HOST",
    default="",
    hidden=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to encrypt the state file in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
)
@click.option("--force", "-f", help="Bypasses the confirmation prompt. Purge the state file directly.", is_flag=True)
@add_options(recce_options)
def purge(**kwargs):
    """
    Purge the state file from cloud
    """
    from rich.console import Console

    handle_debug_flag(**kwargs)
    console = Console()
    state_loader = None
    cloud_options = {
        "host": kwargs.get("state_file_host"),
        "github_token": kwargs.get("cloud_token"),
        "password": kwargs.get("password"),
    }
    force_to_purge = kwargs.get("force", False)

    try:
        console.rule("Check Recce State from Cloud")
        state_loader = RecceStateLoader(
            review_mode=False, cloud_mode=True, state_file=None, cloud_options=cloud_options
        )
    except Exception:
        console.print("[[yellow]Skip[/yellow]] Cannot access existing state file from cloud. Purge it directly.")

    if state_loader is None:
        try:
            if force_to_purge is True or click.confirm("\nDo you want to purge the state file?"):
                rc, err_msg = RecceCloudStateManager(cloud_options).purge_cloud_state()
                if rc is True:
                    console.rule("Purged Successfully")
                else:
                    console.rule("Failed to Purge", style="red")
                    console.print(f"Reason: {err_msg}")

        except click.exceptions.Abort:
            pass
        return 0

    info = state_loader.info()
    if info is None:
        console.print("[[yellow]Skip[/yellow]] No state file found in cloud.")
        return 0

    pr_info = info.get("pull_request")
    console.print("[green]State File hosted by[/green]", info.get("source"))
    console.print("[green]GitHub Repository[/green]", info.get("pull_request").repository)
    console.print(f"[green]GitHub Pull Request[/green]\n{pr_info.title} #{pr_info.id}")
    console.print(f"Branch merged into [blue]{pr_info.base_branch}[/blue] from [blue]{pr_info.branch}[/blue]")
    console.print(pr_info.url)

    try:
        if force_to_purge is True or click.confirm("\nDo you want to purge the state file?"):
            response = state_loader.purge()
            if response is True:
                console.rule("Purged Successfully")
            else:
                console.rule("Failed to Purge", style="red")
                console.print(f"Reason: {state_loader.error_message}")
    except click.exceptions.Abort:
        pass

    return 0


@cloud.command(cls=TrackCommand)
@click.argument("state_file", type=click.Path(exists=True))
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--state-file-host",
    help="The host to fetch the state file from.",
    type=click.STRING,
    envvar="RECCE_STATE_FILE_HOST",
    default="",
    hidden=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to encrypt the state file in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
)
@add_options(recce_options)
def upload(state_file, **kwargs):
    """
    Upload the state file to cloud
    """
    from rich.console import Console

    handle_debug_flag(**kwargs)
    cloud_options = {
        "host": kwargs.get("state_file_host"),
        "github_token": kwargs.get("cloud_token"),
        "password": kwargs.get("password"),
    }

    console = Console()

    # load local state
    state_loader = create_state_loader(
        review_mode=False, cloud_mode=False, state_file=state_file, cloud_options=cloud_options
    )

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    # check if state exists in cloud
    state_manager = RecceCloudStateManager(cloud_options)
    if not state_manager.verify():
        error, hint = state_manager.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    cloud_state_file_exists = state_manager.check_cloud_state_exists()

    if cloud_state_file_exists and not click.confirm("\nDo you want to overwrite the existing state file?"):
        return 0

    console.print(state_manager.upload_state_to_cloud(state_loader.state))


@cloud.command(cls=TrackCommand)
@click.option(
    "-o",
    "--output",
    help="Path of the downloaded state file.",
    type=click.STRING,
    default=DEFAULT_RECCE_STATE_FILE,
    show_default=True,
)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--state-file-host",
    help="The host to fetch the state file from.",
    type=click.STRING,
    envvar="RECCE_STATE_FILE_HOST",
    default="",
    hidden=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to encrypt the state file in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
)
@add_options(recce_options)
def download(**kwargs):
    """
    Download the state file to cloud
    """
    from rich.console import Console

    handle_debug_flag(**kwargs)
    filepath = kwargs.get("output")
    cloud_options = {
        "host": kwargs.get("state_file_host"),
        "github_token": kwargs.get("cloud_token"),
        "password": kwargs.get("password"),
    }

    console = Console()

    # check if state exists in cloud
    state_manager = RecceCloudStateManager(cloud_options)
    if not state_manager.verify():
        error, hint = state_manager.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    cloud_state_file_exists = state_manager.check_cloud_state_exists()

    if not cloud_state_file_exists:
        console.print("[yellow]Skip[/yellow] No state file found in cloud.")
        return 0

    state_manager.download_state_from_cloud(filepath)
    console.print(f'Downloaded state file to "{filepath}"')


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--branch",
    "-b",
    help="The branch of the provided artifacts.",
    type=click.STRING,
    envvar="GITHUB_HEAD_REF",
    default=current_branch(),
    show_default=True,
)
@click.option(
    "--target-path",
    help="dbt artifacts directory for your artifacts.",
    type=click.STRING,
    default="target",
    show_default=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to encrypt the dbt artifacts in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
    required=True,
)
@add_options(recce_options)
def upload_artifacts(**kwargs):
    """
    Upload the dbt artifacts to cloud

    Upload the dbt artifacts (metadata.json, catalog.json) to Recce Cloud for the given branch.
    The password is used to encrypt the dbt artifacts in the cloud. You will need the password to download the dbt artifacts.

    By default, the artifacts are uploaded to the current branch. You can specify the branch using the --branch option.
    The target path is set to 'target' by default. You can specify the target path using the --target-path option.
    """
    from rich.console import Console

    console = Console()
    cloud_token = kwargs.get("cloud_token")
    password = kwargs.get("password")
    target_path = kwargs.get("target_path")
    branch = kwargs.get("branch")

    try:
        rc = upload_dbt_artifacts(
            target_path, branch=branch, token=cloud_token, password=password, debug=kwargs.get("debug", False)
        )
        console.rule("Uploaded Successfully")
        console.print(
            f'Uploaded dbt artifacts to Recce Cloud for branch "{branch}" from "{os.path.abspath(target_path)}"'
        )
    except Exception as e:
        console.rule("Failed to Upload", style="red")
        console.print("[[red]Error[/red]] Failed to upload the dbt artifacts to cloud.")
        console.print(f"Reason: {e}")
        rc = 1
    return rc


def _download_artifacts(branch, cloud_token, console, kwargs, password, target_path):
    try:
        rc = download_dbt_artifacts(
            target_path,
            branch=branch,
            token=cloud_token,
            password=password,
            force=kwargs.get("force", False),
            debug=kwargs.get("debug", False),
        )
        console.rule("Downloaded Successfully")
        console.print(
            f'Downloaded dbt artifacts from Recce Cloud for branch "{branch}" to "{os.path.abspath(target_path)}"'
        )
    except Exception as e:
        console.rule("Failed to Download", style="red")
        console.print("[[red]Error[/red]] Failed to download the dbt artifacts from cloud.")
        reason = str(e)

        if (
            "Requests specifying Server Side Encryption with Customer provided keys must provide the correct secret key"
            in reason
        ):
            console.print("Reason: Decryption failed due to incorrect password.")
            console.print(
                "Please provide the correct password to decrypt the dbt artifacts. Or re-upload the dbt artifacts with a new password."
            )
        elif "The specified key does not exist" in reason:
            console.print("Reason: The dbt artifacts is not found in the cloud.")
            console.print("Please upload the dbt artifacts to the cloud before downloading it.")
        else:
            console.print(f"Reason: {reason}")
        rc = 1
    return rc


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--branch",
    "-b",
    help="The branch of the selected artifacts.",
    type=click.STRING,
    envvar="GITHUB_BASE_REF",
    default=current_branch(),
    show_default=True,
)
@click.option(
    "--target-path",
    help="The dbt artifacts directory for your artifacts.",
    type=click.STRING,
    default="target",
    show_default=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to decrypt the dbt artifacts in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
    required=True,
)
@click.option("--force", "-f", help="Bypasses the confirmation prompt. Download the artifacts directly.", is_flag=True)
@add_options(recce_options)
def download_artifacts(**kwargs):
    """
    Download the dbt artifacts from cloud

    Download the dbt artifacts (metadata.json, catalog.json) from Recce Cloud for the given branch.
    The password is used to decrypt the dbt artifacts in the cloud.

    By default, the artifacts are downloaded from the current branch. You can specify the branch using the --branch option.
    The target path is set to 'target' by default. You can specify the target path using the --target-path option.
    """
    from rich.console import Console

    console = Console()
    cloud_token = kwargs.get("cloud_token")
    password = kwargs.get("password")
    target_path = kwargs.get("target_path")
    branch = kwargs.get("branch")
    return _download_artifacts(branch, cloud_token, console, kwargs, password, target_path)


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--branch",
    "-b",
    help="The branch of the selected artifacts.",
    type=click.STRING,
    envvar="GITHUB_BASE_REF",
    default=current_default_branch(),
    show_default=True,
)
@click.option(
    "--target-path",
    help="The dbt artifacts directory for your artifacts.",
    type=click.STRING,
    default="target-base",
    show_default=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to decrypt the dbt artifacts in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
    required=True,
)
@click.option("--force", "-f", help="Bypasses the confirmation prompt. Download the artifacts directly.", is_flag=True)
@add_options(recce_options)
def download_base_artifacts(**kwargs):
    """
    Download the base dbt artifacts from cloud

    Download the base dbt artifacts (metadata.json, catalog.json) from Recce Cloud.
    This is useful when you start to set up the base dbt artifacts for the first time.

    Please make sure you have uploaded the dbt artifacts before downloading them.
    """
    from rich.console import Console

    console = Console()
    cloud_token = kwargs.get("cloud_token")
    password = kwargs.get("password")
    target_path = kwargs.get("target_path")
    branch = kwargs.get("branch")
    return _download_artifacts(branch, cloud_token, console, kwargs, password, target_path)


@cli.group("github", short_help="GitHub related commands", hidden=True)
def github(**kwargs):
    pass


@github.command(
    cls=TrackCommand, short_help="Download the artifacts from the GitHub repository based on the current Pull Request."
)
@click.option(
    "--github-token",
    help="The github token to use for accessing GitHub repo.",
    type=click.STRING,
    envvar="GITHUB_TOKEN",
)
@click.option(
    "--github-repo",
    help="The github repo to use for accessing GitHub repo.",
    type=click.STRING,
    envvar="GITHUB_REPOSITORY",
)
def artifact(**kwargs):
    from recce.github import recce_ci_artifact

    return recce_ci_artifact(**kwargs)


@cli.command(cls=TrackCommand)
@click.argument("state_file", type=click.Path(exists=True))
@click.option(
    "--api-token", help="The personal token generated by Recce Cloud.", type=click.STRING, envvar="RECCE_API_TOKEN"
)
def share(state_file, **kwargs):
    """
    Share the state file
    """
    from rich.console import Console

    console = Console()
    handle_debug_flag(**kwargs)
    cloud_options = None

    # read or input the api token
    try:
        api_token = prepare_api_token(interaction=True, **kwargs)
    except Abort:
        console.print("[yellow]Abort[/yellow]")
        exit(0)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    auth_options = {"api_token": api_token}

    # load local state
    state_loader = create_state_loader(
        review_mode=True, cloud_mode=False, state_file=state_file, cloud_options=cloud_options
    )

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    # check if state exists in cloud
    state_manager = RecceShareStateManager(auth_options)
    if not state_manager.verify():
        error, hint = state_manager.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    # check if state exists in cloud
    state_file_name = os.path.basename(state_file)

    try:
        response = state_manager.share_state(state_file_name, state_loader.state)
        if response.get("status") == "error":
            console.print("[[red]Error[/red]] Failed to share the state.\n" f"Reason: {response.get('message')}")
        else:
            console.print(f"Shared Link: {response.get('share_url')}")
    except RecceCloudException as e:
        console.print(f"[[red]Error[/red]] {e}")
        console.print(f"Reason: {e.reason}")
        exit(1)


@cli.command(hidden=True, cls=TrackCommand)
@click.argument("state_file", required=True)
@click.option("--host", default="localhost", show_default=True, help="The host to bind to.")
@click.option("--port", default=8000, show_default=True, help="The port to bind to.", type=int)
@click.option("--lifetime", default=0, show_default=True, help="The lifetime of the server in seconds.", type=int)
@click.option("--share-url", help="The share URL triggers this instance.", type=click.STRING, envvar="RECCE_SHARE_URL")
@click.pass_context
def read_only(ctx, state_file=None, **kwargs):
    # Invoke `recce server --mode read-only <state_file> ...
    kwargs["mode"] = RecceServerMode.read_only
    ctx.invoke(server, state_file=state_file, **kwargs)


if __name__ == "__main__":
    cli()
