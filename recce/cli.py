import asyncio
import os
import sys
from pathlib import Path
from typing import List

import click
import uvicorn
from click import Abort
import yaml
import shutil

from recce import event
from recce.artifact import download_dbt_artifacts, upload_dbt_artifacts
from recce.config import RECCE_CONFIG_FILE, RECCE_ERROR_LOG_FILE, RecceConfig
from recce.exceptions import RecceConfigException
from recce.git import current_branch, current_default_branch
from recce.run import check_github_ci_env, cli_run
from recce.state import RecceCloudStateManager, RecceShareStateManager, RecceStateLoader
from recce.summary import generate_markdown_summary
from recce.util.api_token import prepare_api_token, show_invalid_api_token_message
from recce.util.logger import CustomFormatter
from recce.util.recce_cloud import (
    RecceCloudException,
    get_recce_cloud_onboarding_state,
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

    # Register init and validate commands
    cli.add_command(init)
    cli.add_command(validate)


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

    target_path = Path(kwargs.get("target_path", "target"))
    target_base_path = Path(kwargs.get("target_base_path", "target-base"))

    curr_dir_is_ready = True
    curr_manifest_is_ready = True
    curr_catalog_is_ready = True
    base_dir_is_ready = True
    base_manifest_is_ready = True
    base_catalog_is_ready = True
    conn_is_ready = True

    console.rule("Development Environment", style="orange3")
    if not target_path.is_dir():
        console.print(f"[[red]MISS[/red]] Directory does not exist: {target_path}")
        curr_dir_is_ready = False
    else:
        console.print(f"[[green]OK[/green]] Directory exists: {target_path}")

        manifest_path = target_path / "manifest.json"
        if not manifest_path.is_file():
            console.print(f"[[red]MISS[/red]] Manifest JSON file does not exist: {manifest_path}")
            curr_manifest_is_ready = False
        else:
            console.print(f"[[green]OK[/green]] Manifest JSON file exists : {manifest_path}")

        catalog_path = target_path / "catalog.json"
        if not catalog_path.is_file():
            console.print(f"[[red]MISS[/red]] Catalog JSON file does not exist: {catalog_path}")
            curr_catalog_is_ready = False
        else:
            console.print(f"[[green]OK[/green]] Catalog JSON file exists: {catalog_path}")

    console.rule("Base Environment", style="orange3")
    if not target_base_path.is_dir():
        console.print(f"[[red]MISS[/red]] Directory does not exist: {target_base_path}")
        base_dir_is_ready = False
    else:
        console.print(f"[[green]OK[/green]] Directory exists: {target_base_path}")

        manifest_path = target_base_path / "manifest.json"
        if not manifest_path.is_file():
            console.print(f"[[red]MISS[/red]] Manifest JSON file does not exist: {manifest_path}")
            base_manifest_is_ready = False
        else:
            console.print(f"[[green]OK[/green]] Manifest JSON file exists : {manifest_path}")

        catalog_path = target_base_path / "catalog.json"
        if not catalog_path.is_file():
            console.print(f"[[red]MISS[/red]] Catalog JSON file does not exist: {catalog_path}")
            base_catalog_is_ready = False
        else:
            console.print(f"[[green]OK[/green]] Catalog JSON file exists: {catalog_path}")

    console.rule("Warehouse Connection", style="orange3")
    try:
        context_kwargs = {**kwargs, "target_base_path": kwargs.get("target_base_path", "target-base")}
        ctx = load_context(**context_kwargs)
        dbt_adapter: DbtAdapter = ctx.adapter
        sql = dbt_adapter.generate_sql("select 1", False)
        dbt_adapter.execute(sql, fetch=True, auto_begin=True)
        console.print("[[green]OK[/green]] Connection test")
    except Exception:
        conn_is_ready = False
        console.print("[[red]FAIL[/red]] Connection test")

    console.rule("Result", style="orange3")
    if (
        curr_manifest_is_ready
        and curr_catalog_is_ready
        and base_manifest_is_ready
        and base_catalog_is_ready
        and conn_is_ready
    ):
        console.print("[[green]OK[/green]] You're ready for [bold]Recce[/bold]! Launch it with `recce server`")
    elif curr_manifest_is_ready and curr_catalog_is_ready and conn_is_ready:
        console.print(
            "[[orange3]OK[/orange3]] You're ready for the [bold]single environment mode[/bold]! Launch Recce with `recce server`"
        )

    if not curr_dir_is_ready:
        console.print(
            "[[orange3]TIP[/orange3]] Run dbt or overwrite the default directory of the development environment with `--target-path`"
        )
    else:
        if not curr_manifest_is_ready:
            console.print(
                "[[orange3]TIP[/orange3]] `dbt run` to generate the manifest JSON file for the development environment"
            )
        if not curr_catalog_is_ready:
            console.print(
                "[[orange3]TIP[/orange3]] `dbt docs generate` to generate the catalog JSON file for the development environment"
            )

    if not base_dir_is_ready:
        console.print(
            "[[orange3]TIP[/orange3]] Run dbt with `--target-path target-base` or overwrite the default directory of the base environment with `--target-base-path`"
        )
    else:
        if not base_manifest_is_ready:
            console.print(
                "[[orange3]TIP[/orange3]] `dbt docs generate --target-path target-base` to generate the manifest JSON file for the base environment"
            )
        if not base_catalog_is_ready:
            console.print(
                "[[orange3]TIP[/orange3]] `dbt docs generate --target-path target-base` to generate the catalog JSON file for the base environment"
            )

    if not conn_is_ready:
        console.print("[[orange3]TIP[/orange3]] Run `dbt debug` to check the connection")


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
@click.option(
    "--api-token", help="The personal token generated by Recce Cloud.", type=click.STRING, envvar="RECCE_API_TOKEN"
)
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_dbt_artifact_dir_options)
@add_options(recce_cloud_options)
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

    from .server import AppState, app

    RecceConfig(config_file=kwargs.get("config"))

    handle_debug_flag(**kwargs)
    is_review = kwargs.get("review", False)
    is_cloud = kwargs.get("cloud", False)
    console = Console()
    cloud_options = None
    flag = {"show_onboarding_guide": True, "single_env_onboarding": False, "show_relaunch_hint": False}
    if is_cloud:
        cloud_options = {
            "host": kwargs.get("state_file_host"),
            "token": kwargs.get("cloud_token"),
            "password": kwargs.get("password"),
        }
        cloud_onboarding_state = get_recce_cloud_onboarding_state(kwargs.get("cloud_token"))
        flag["show_onboarding_guide"] = False if cloud_onboarding_state == "completed" else True

    auth_options = {}
    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)
    auth_options["api_token"] = api_token

    # Check Single Environment Onboarding Mode if the review mode is False
    if not os.path.isdir(kwargs.get("target_base_path")) and is_review is False:
        # Mark as single env onboarding mode if user provides the target-path only
        flag["single_env_onboarding"] = True
        flag["show_relaunch_hint"] = True
        target_path = kwargs.get("target_path")
        target_base_path = kwargs.get("target_base_path")
        # Use the target path as the base path
        kwargs["target_base_path"] = target_path

        # Show warning message
        console.rule("Notice", style="orange3")
        console.print("Recce is launching in single environment mode with limited functionality.")
        console.print(
            "For full functionality, prepare a base set of dbt artifacts to compare against in "
            f"'{target_base_path}'."
        )
        console.print("https://docs.datarecce.io/get-started/#prepare-dbt-artifacts")
        console.print("\n[blue]To use Recce, we need to generate dbt metadata files (called 'artifacts') for both your development and production environments.[/blue]")
        console.print("\n[blue]Step 1: Generate development artifacts[/blue]")
        console.print("To run in your dev branch:")
        console.print("  dbt docs generate --target dev")
        console.print("  # This creates metadata about your current development environment\n")
        console.print("[blue]Step 2: Generate production artifacts[/blue]")
        console.print("To run in your main or production branch:")
        console.print("  dbt docs generate --target prod --target-path target-base\n")
        console.print("[blue]After running these commands, you should see:[/blue]")
        console.print("  - A 'target' folder with manifest.json (development)")
        console.print("  - A 'target-base' folder with manifest.json (production)\n")
        console.print("For more information on setting up Snowflake profiles, visit: https://docs.getdbt.com/docs/core/connect-data-platform/snowflake-setup")
        console.print("See the Recce docs for more details: https://docs.datarecce.io/")
        console.print()

    state_loader = create_state_loader(is_review, is_cloud, state_file, cloud_options)

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    if state_loader.review_mode is True:
        console.rule("Recce Server : Review Mode")
    else:
        console.rule("Recce Server")

    result, message = RecceContext.verify_required_artifacts(**kwargs)
    if not result:
        console.print(f"[[red]Error[/red]] {message}")
        exit(1)

    state = AppState(
        command="server",
        state_loader=state_loader,
        kwargs=kwargs,
        flag=flag,
        auth_options=auth_options,
        lifetime=lifetime,
    )
    app.state = state

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
            "token": kwargs.get("cloud_token"),
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
            "token": kwargs.get("cloud_token"),
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
        "token": kwargs.get("cloud_token"),
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
        "token": kwargs.get("cloud_token"),
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
        "token": kwargs.get("cloud_token"),
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
def read_only(host, port, lifetime, state_file=None, **kwargs):
    from rich.console import Console

    from .server import AppState, app

    console = Console()
    handle_debug_flag(**kwargs)
    is_review = True
    is_cloud = False
    cloud_options = None
    flag = {
        "read_only": True,
    }
    state_loader = create_state_loader(is_review, is_cloud, state_file, cloud_options)

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    result, message = RecceContext.verify_required_artifacts(**kwargs, review=is_review)
    if not result:
        console.print(f"[[red]Error[/red]] {message}")
        exit(1)

    app.state = AppState(
        command="read_only",
        state_loader=state_loader,
        kwargs=kwargs,
        flag=flag,
        lifetime=lifetime,
        share_url=kwargs.get("share_url"),
    )
    set_default_context(RecceContext.load(**kwargs, review=is_review, state_loader=state_loader))

    uvicorn.run(app, host=host, port=port, lifespan="on")


def validate_profiles_config(profiles_config, database_type):
    """Validate the generated profiles configuration."""
    from rich.console import Console
    console = Console()
    
    required_fields = {
        'snowflake': ['account', 'user', 'password', 'warehouse', 'role'],
        'bigquery': ['method', 'project', 'dataset', 'location'],
        'postgres': ['host', 'port', 'user', 'password', 'dbname'],
        'duckdb': ['path', 'threads']
    }
    
    # Check if project name is still the default
    if 'your_project_name' in profiles_config:
        console.print("[yellow]⚠️  Warning: Using default project name 'your_project_name'. Please update it in profiles.yml[/yellow]")
    
    # Validate each environment
    for env in ['dev', 'prod']:
        if env not in profiles_config.get('your_project_name', {}).get('outputs', {}):
            console.print(f"[red]❌ Error: Missing {env} environment configuration[/red]")
            return False
            
        config = profiles_config['your_project_name']['outputs'][env]
        
        # Check required fields
        missing_fields = [field for field in required_fields[database_type] 
                         if field not in config or config[field] == f'your_{field}']
        
        if missing_fields:
            console.print(f"[red]❌ Error: Missing or using default values for required fields in {env} environment:[/red]")
            for field in missing_fields:
                console.print(f"  - {field}")
            return False
            
        # Type-specific validations
        if database_type == 'postgres':
            try:
                port = int(config['port'])
                if not (1 <= port <= 65535):
                    console.print(f"[red]❌ Error: Invalid port number in {env} environment[/red]")
                    return False
            except ValueError:
                console.print(f"[red]❌ Error: Port must be a number in {env} environment[/red]")
                return False
                
        elif database_type == 'duckdb':
            if not config['path'].endswith('.duckdb'):
                console.print(f"[yellow]⚠️  Warning: DuckDB path should end with .duckdb in {env} environment[/yellow]")
    
    return True

def test_database_connection(profiles_config, database_type, env='dev'):
    """Test the database connection using the provided configuration."""
    from rich.console import Console
    from dbt.cli.main import dbtRunner, dbtRunnerResult
    import tempfile
    import os
    
    console = Console()
    
    # Create a temporary dbt project for testing
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a minimal dbt_project.yml
        project_yml = """
name: 'connection_test'
version: '1.0.0'
config-version: 2
profile: 'your_project_name'
        """
        with open(os.path.join(temp_dir, 'dbt_project.yml'), 'w') as f:
            f.write(project_yml)
            
        # Create a minimal model
        os.makedirs(os.path.join(temp_dir, 'models'), exist_ok=True)
        model_sql = """
select 1 as test
        """
        with open(os.path.join(temp_dir, 'models', 'test.sql'), 'w') as f:
            f.write(model_sql)
            
        # Write the profiles configuration
        os.makedirs(os.path.expanduser('~/.dbt'), exist_ok=True)
        with open(os.path.expanduser('~/.dbt/profiles.yml'), 'w') as f:
            yaml.dump(profiles_config, f, default_flow_style=False)
            
        # Test the connection
        console.print(f"\n[blue]Testing {env} environment connection...[/blue]")
        dbt = dbtRunner()
        res: dbtRunnerResult = dbt.invoke(['debug', '--project-dir', temp_dir, '--target', env])
        
        if res.success:
            console.print(f"[green]✅ Successfully connected to {env} environment[/green]")
            return True
        else:
            console.print(f"[red]❌ Failed to connect to {env} environment[/red]")
            console.print(f"Error: {res.exception}")
            return False

@cli.command(cls=TrackCommand)
@click.option('--target', type=click.Choice(['dev', 'prod']), default='dev', help='Target environment to generate docs for')
@click.option('--target-path', type=str, default='target', help='Path to store the generated docs')
@add_options(dbt_related_options)
def generate_docs(target, target_path, **kwargs):
    """
    Automatically generate dbt docs for the specified target environment.
    """
    from rich.console import Console
    import subprocess
    import os

    console = Console()

    # Construct the command
    command = ['dbt', 'docs', 'generate', '--target', target]
    if target == 'prod':
        command.extend(['--target-path', target_path])

    # Execute the command
    console.print(f"[blue]Generating dbt docs for {target} environment...[/blue]")
    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode == 0:
        console.print(f"[green]✅ Successfully generated dbt docs for {target} environment[/green]")
    else:
        console.print(f"[red]❌ Failed to generate dbt docs: {result.stderr}[/red]")


@cli.command(cls=TrackCommand)
@click.option('--database-type', type=click.Choice(['snowflake', 'bigquery', 'postgres', 'duckdb']), prompt='What type of database are you using?')
@click.option('--dev-schema', prompt='What schema name would you like to use for development?', default='dev')
@click.option('--prod-schema', prompt='What schema name would you like to use for production?', default='prod')
@click.option('--validate', is_flag=True, help='Validate the configuration and test database connections')
@click.option('--explain', is_flag=True, help='Show detailed explanation of the initialization process')
@add_options(dbt_related_options)
def init(database_type, dev_schema, prod_schema, validate, explain, **kwargs):
    """Initialize a new dbt project configuration."""
    from rich.console import Console
    console = Console()

    # If --explain flag is used, show only the explanation and return
    if explain:
        console.print("\n[blue]To use Recce, we need to generate dbt metadata files (called 'artifacts') for both your development and production environments.[/blue]")
        console.print("\n[blue]Step 1: Generate development artifacts[/blue]")
        console.print("To run in your dev branch:")
        console.print("  dbt docs generate --target dev")
        console.print("  # This creates metadata about your current development environment\n")
        console.print("[blue]Step 2: Generate production artifacts[/blue]")
        console.print("To run in your main or production branch:")
        console.print("  dbt docs generate --target prod --target-path target-base\n")
        console.print("[blue]After running these commands, you should see:[/blue]")
        console.print("  - A 'target' folder with manifest.json (development)")
        console.print("  - A 'target-base' folder with manifest.json (production)\n")
        console.print("For more information on setting up Snowflake profiles, visit: https://docs.getdbt.com/docs/core/connect-data-platform/snowflake-setup")
        console.print("See the Recce docs for more details: https://docs.datarecce.io/")
        return

    # Only prompt for database type if not using --explain
    if not database_type:
        database_type = click.prompt('What type of database are you using?', type=click.Choice(['snowflake', 'bigquery', 'postgres', 'duckdb']))
    if not dev_schema:
        dev_schema = click.prompt('What schema name would you like to use for development?', default='dev')
    if not prod_schema:
        prod_schema = click.prompt('What schema name would you like to use for production?', default='prod')

    # Use the simpler approach for setting directories
    project_dir = os.path.abspath(kwargs.get('project_dir') or os.getcwd())
    profiles_dir = os.path.abspath(kwargs.get('profiles_dir') or project_dir)

    # Create profiles directory if it doesn't exist
    if not os.path.exists(profiles_dir):
        os.makedirs(profiles_dir)

    # Create profiles.yml
    profiles_path = os.path.join(profiles_dir, 'profiles.yml')
    
    # Get project name from dbt_project.yml if available
    project_name = 'jaffle_shop'  # Default project name
    try:
        with open(os.path.join(project_dir, 'dbt_project.yml'), 'r') as f:
            project_config = yaml.safe_load(f)
            project_name = project_config.get('name', project_name)
    except:
        pass
    
    # Generate configuration based on database type
    config = {
        project_name: {
            'target': 'dev',  # Set default target
            'outputs': {
                'dev': {
                    'type': database_type,
                    'schema': dev_schema,
                },
                'prod': {
                    'type': database_type,
                    'schema': prod_schema,
                }
            }
        }
    }

    # Add database-specific configuration
    if database_type == 'duckdb':
        config[project_name]['outputs']['dev'].update({
            'path': 'jaffle_shop.duckdb',
            'threads': 24
        })
        config[project_name]['outputs']['prod'].update({
            'path': 'jaffle_shop.duckdb',
            'threads': 24
        })
    elif database_type == 'snowflake':
        config[project_name]['outputs']['dev'].update({
            'account': 'your_account',
            'user': 'your_username',
            'password': 'your_password',
            'warehouse': 'your_warehouse',
            'role': 'your_role'
        })
        config[project_name]['outputs']['prod'].update({
            'account': 'your_account',
            'user': 'your_username',
            'password': 'your_password',
            'warehouse': 'your_warehouse',
            'role': 'your_role'
        })
    # Add other database types as needed

    # Handle existing profiles.yml
    if os.path.exists(profiles_path):
        console.print(f"[yellow]profiles.yml already exists at {profiles_path}.[/yellow]")
        choice = input("What would you like to do? [s]kip/[b]ackup/[o]verwrite/[a]bort: ").strip().lower()
        if choice == 's' or choice == '':
            console.print("Skipping creation of profiles.yml.\n")
        elif choice == 'b':
            backup_path = profiles_path + ".bak"
            shutil.copy2(profiles_path, backup_path)
            console.print(f"Backed up existing profiles.yml to {backup_path}")
            with open(profiles_path, 'w') as f:
                yaml.dump(config, f, default_flow_style=False)
            console.print(f"\n✅ Created new profiles.yml at {profiles_path}")
        elif choice == 'o':
            console.print("Overwriting existing profiles.yml.")
            with open(profiles_path, 'w') as f:
                yaml.dump(config, f, default_flow_style=False)
            console.print(f"\n✅ Overwrote profiles.yml at {profiles_path}")
        else:
            console.print("Aborted by user.")
            return
    else:
        with open(profiles_path, 'w') as f:
            yaml.dump(config, f, default_flow_style=False)
        console.print(f"\n✅ Created profiles.yml at {profiles_path}")

    # Validate if requested
    if validate:
        try:
            validate_profiles_config(config, database_type)
            if test_database_connection(config, database_type):
                console.print("\n✅ Configuration validation complete")
            else:
                console.print("\n⚠️ Configuration validation failed. Please check your database connection settings.")
        except Exception as e:
            console.print(f"\n❌ Error during validation: {str(e)}")
            console.print("\n⚠️ Please fix the configuration issues in profiles.yml before proceeding")

    # Check for artifacts
    dev_manifest = os.path.join(project_dir, 'target', 'manifest.json')
    prod_manifest = os.path.join(project_dir, 'target-base', 'manifest.json')
    missing = []
    if not os.path.exists(dev_manifest):
        missing.append('target/manifest.json (dev artifacts)')
    if not os.path.exists(prod_manifest):
        missing.append('target-base/manifest.json (prod/base artifacts)')
    if missing:
        console.print("\n[yellow]Some required dbt artifacts are missing:[/yellow]")
        for m in missing:
            console.print(f"  - {m}")
        console.print("\nTo generate them, you'll need:")
        console.print("To run in your dev branch:")
        console.print("  dbt docs generate --target dev")
        console.print("  # This creates metadata about your current development environment")
        console.print("To run in your main or production branch:")
        console.print("  dbt docs generate --target prod --target-path target-base")
        console.print("  # This creates metadata about your production environment")
        console.print("For a detailed explanation of this process, run: recce explain-setup")
        console.print("See the Recce docs for more details: https://docs.datarecce.io/")
    else:
        console.print("\n[green]All required dbt artifacts are present! You're ready to use Recce.[/green]")


@cli.command(cls=TrackCommand)
@click.option('--database-type', type=click.Choice(['snowflake', 'bigquery', 'postgres', 'duckdb']), help='Specify database type for validation')
@click.option('--test-connection', is_flag=True, help='Test database connections')
@add_options(dbt_related_options)
def validate(database_type, test_connection, **kwargs):
    """
    Validate your existing Recce and dbt configuration.
    This command checks your profiles.yml and tests database connections without making any changes.
    """
    from rich.console import Console
    import yaml
    import os

    console = Console()
    
    # Get profiles directory
    profiles_dir = kwargs.get('profiles_dir', os.path.expanduser('~/.dbt'))
    profiles_path = os.path.join(profiles_dir, 'profiles.yml')
    
    if not os.path.exists(profiles_path):
        console.print(f"[red]❌ Error: profiles.yml not found at {profiles_path}[/red]")
        console.print("\nTo create a new configuration, run: recce init")
        return
    
    # Load and validate profiles.yml
    try:
        with open(profiles_path, 'r') as f:
            profiles_config = yaml.safe_load(f)
    except Exception as e:
        console.print(f"[red]❌ Error: Failed to load profiles.yml: {str(e)}[/red]")
        return
    
    if not profiles_config:
        console.print("[red]❌ Error: profiles.yml is empty[/red]")
        return
    
    # If database type not specified, try to detect it
    if not database_type:
        # Get the first project's configuration
        first_project = next(iter(profiles_config.values()))
        if isinstance(first_project, dict) and 'outputs' in first_project:
            first_env = next(iter(first_project['outputs'].values()))
            if isinstance(first_env, dict) and 'type' in first_env:
                database_type = first_env['type']
                console.print(f"[blue]Detected database type: {database_type}[/blue]")
    
    if not database_type:
        console.print("[red]❌ Error: Could not detect database type. Please specify --database-type[/red]")
        return
    
    # Validate configuration
    console.print("\n[blue]Validating configuration...[/blue]")
    if not validate_profiles_config(profiles_config, database_type):
        console.print("\n[yellow]⚠️  Configuration validation failed. Please fix the issues in profiles.yml[/yellow]")
        return
    
    # Test connections if requested
    if test_connection:
        console.print("\n[blue]Testing database connections...[/blue]")
        
        # Get project name from dbt_project.yml if available
        project_dir = kwargs.get('project_dir', os.getcwd())
        project_name = None
        try:
            with open(os.path.join(project_dir, 'dbt_project.yml'), 'r') as f:
                project_config = yaml.safe_load(f)
                project_name = project_config.get('name')
        except:
            pass
        
        if not project_name:
            # Use the first project name from profiles.yml
            project_name = next(iter(profiles_config.keys()))
        
        # Test each environment
        for env in ['dev', 'prod']:
            if env not in profiles_config.get(project_name, {}).get('outputs', {}):
                console.print(f"[yellow]⚠️  Warning: {env} environment not found in profiles.yml[/yellow]")
                continue
                
            if not test_database_connection(profiles_config, database_type, env):
                console.print(f"[red]❌ Failed to connect to {env} environment[/red]")
            else:
                console.print(f"[green]✅ Successfully connected to {env} environment[/green]")
    
    console.print("\n[green]✅ Configuration validation complete![/green]")
    console.print("\nIf you need to make changes:")
    console.print("1. Edit profiles.yml with your database credentials")
    console.print("2. Run 'recce validate' again to check your changes")
    console.print("3. Run 'recce server' to start Recce")


@cli.command()
def explain_setup():
    """Show a detailed explanation of the Recce onboarding and artifact setup process."""
    from rich.console import Console
    console = Console()
    console.print("\n[blue]To use Recce, we need to generate dbt metadata files (called 'artifacts') for both your development and production environments.[/blue]")
    console.print("\n[blue]Step 1: Generate development artifacts[/blue]")
    console.print("To run in your dev branch:")
    console.print("  dbt docs generate --target dev")
    console.print("  # This creates metadata about your current development environment")
    console.print("\n[blue]Step 2: Generate production artifacts[/blue]")
    console.print("To run in your main or production branch:")
    console.print("  dbt docs generate --target prod --target-path target-base")
    console.print("  # This creates metadata about your production environment")
    console.print("\n[blue]After running these commands, you should see:[/blue]")
    console.print("  - A 'target' folder with manifest.json (development)")
    console.print("  - A 'target-base' folder with manifest.json (production)\n")
    console.print("For more information on setting up Snowflake profiles, visit: https://docs.getdbt.com/docs/core/connect-data-platform/snowflake-setup")
    console.print("See the Recce docs for more details: https://docs.datarecce.io/")


if __name__ == "__main__":
    cli()
