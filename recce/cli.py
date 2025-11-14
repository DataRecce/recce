import asyncio
import os
from pathlib import Path
from typing import List

import click
import uvicorn
from click import Abort

from recce import event
from recce.artifact import (
    delete_dbt_artifacts,
    download_dbt_artifacts,
    upload_artifacts_to_session,
    upload_dbt_artifacts,
)
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
from recce.state import (
    CloudStateLoader,
    FileStateLoader,
    RecceCloudStateManager,
    RecceShareStateManager,
)
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
        state_loader = (
            CloudStateLoader(review_mode=review_mode, cloud_options=cloud_options)
            if cloud_mode
            else FileStateLoader(review_mode=review_mode, state_file=state_file)
        )
        state_loader.load()
        return state_loader
    except RecceCloudException as e:
        console.print("[[red]Error[/red]] Failed to load recce state file")
        console.print(f"Reason: {e.reason}")
        exit(1)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to load recce state file")
        console.print(f"Reason: {e}")
        exit(1)


def patch_derived_args(args):
    """
    Patch derived args based on other args.
    """
    if args.get("session_id") or args.get("share_url"):
        args["cloud"] = True
        args["review"] = True


def create_state_loader_by_args(state_file=None, **kwargs):
    """
    Create a state loader based on CLI arguments.

    This function handles the cloud options logic that is shared between
    server and mcp-server commands.

    Args:
        state_file: Optional path to state file
        **kwargs: CLI arguments including api_token, cloud, review, session_id, share_url, etc.

    Returns:
        state_loader: The created state loader instance
    """
    from rich.console import Console

    console = Console()

    api_token = kwargs.get("api_token")
    is_review = kwargs.get("review", False)
    is_cloud = kwargs.get("cloud", False)
    cloud_options = None

    # Handle share_url and session_id
    share_url = kwargs.get("share_url")
    session_id = kwargs.get("session_id")

    if share_url:
        share_id = share_url.split("/")[-1]
        if not share_id:
            console.print("[[red]Error[/red]] Invalid share URL format.")
            exit(1)

    if is_cloud:
        # Cloud mode
        if share_url:
            cloud_options = {
                "host": kwargs.get("state_file_host"),
                "api_token": api_token,
                "share_id": share_id,
            }
        elif session_id:
            cloud_options = {
                "host": kwargs.get("state_file_host"),
                "api_token": api_token,
                "session_id": session_id,
            }
        else:
            cloud_options = {
                "host": kwargs.get("state_file_host"),
                "github_token": kwargs.get("cloud_token"),
                "password": kwargs.get("password"),
            }

    # Create state loader
    state_loader = create_state_loader(is_review, is_cloud, state_file, cloud_options)

    return state_loader


def handle_debug_flag(**kwargs):
    if kwargs.get("debug"):
        import logging

        ch = logging.StreamHandler()
        ch.setFormatter(CustomFormatter())
        logging.basicConfig(handlers=[ch], level=logging.DEBUG)

        # Explicitly set uvicorn logger to DEBUG level
        uvicorn_logger = logging.getLogger("uvicorn")
        uvicorn_logger.setLevel(logging.DEBUG)

        # Set all child loggers to DEBUG as well
        for handler in uvicorn_logger.handlers:
            handler.setLevel(logging.DEBUG)


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

recce_cloud_auth_options = [
    click.option(
        "--api-token",
        help="The personal token generated by Recce Cloud.",
        type=click.STRING,
        envvar="RECCE_API_TOKEN",
    )
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
    click.option(
        "--session-id",
        help="The session ID triggers this instance.",
        type=click.STRING,
        envvar=["RECCE_SESSION_ID", "RECCE_SNAPSHOT_ID"],  # Backward compatibility with RECCE_SNAPSHOT_ID
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
@click.option(
    "--idle-timeout",
    default=0,
    show_default=True,
    help="The idle timeout in seconds. If 0, idle timeout is disabled. Maximum value is capped by lifetime.",
    type=int,
)
@click.option("--review", is_flag=True, help="Open the state file in the review mode.")
@click.option("--single-env", is_flag=True, help="Launch in single environment mode directly.")
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_dbt_artifact_dir_options)
@add_options(recce_cloud_options)
@add_options(recce_cloud_auth_options)
@add_options(recce_hidden_options)
def server(host, port, lifetime, idle_timeout=0, state_file=None, **kwargs):
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
    # Launch the server using the state from the PR of your current branch. (Requires GitHub token)
    export GITHUB_TOKEN=<your-github-token>
    recce server --cloud
    recce server --review --cloud

    """

    from rich.console import Console
    from rich.prompt import Confirm

    from .server import AppState, app

    RecceConfig(config_file=kwargs.get("config"))

    handle_debug_flag(**kwargs)
    patch_derived_args(kwargs)

    server_mode = kwargs.get("mode") if kwargs.get("mode") else RecceServerMode.server
    is_review = kwargs.get("review", False)
    is_cloud = kwargs.get("cloud", False)
    flag = {
        "single_env_onboarding": False,
        "show_relaunch_hint": False,
        "preview": False,
        "read_only": False,
    }
    console = Console()

    # Prepare API token
    try:
        api_token = prepare_api_token(**kwargs)
        kwargs["api_token"] = api_token
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)
    auth_options = {
        "api_token": api_token,
    }

    # Check Single Environment Onboarding Mode if not in cloud mode and not in review mode
    if not is_cloud and not is_review:
        project_dir_path = Path(kwargs.get("project_dir") or "./")
        target_base_path = project_dir_path.joinpath(Path(kwargs.get("target_base_path", "target-base")))
        if not target_base_path.is_dir():
            # Mark as single env onboarding mode if user provides the target-path only
            flag["single_env_onboarding"] = True
            flag["show_relaunch_hint"] = True
            # Use the target path as the base path
            kwargs["target_base_path"] = kwargs.get("target_path")

    # Server mode:
    #
    # It's used to determine the features disabled in the Web UI. Only used in the cloud-managed recce instances.
    #
    # Read-Only: No run query, no checklist
    # Preview (Metadata-Only): No run query
    if server_mode == RecceServerMode.preview:
        flag["preview"] = True
    elif server_mode == RecceServerMode.read_only:
        flag["read_only"] = True

    # Onboarding State logic update here
    update_onboarding_state(api_token, flag.get("single_env_onboarding"))

    # Create state loader using shared function
    state_loader = create_state_loader_by_args(state_file, **kwargs)

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

    # Validate idle_timeout: cap at lifetime if it exceeds lifetime
    if idle_timeout > 0:
        # If lifetime is set (> 0) and idle_timeout exceeds it, cap to lifetime
        if lifetime > 0 and idle_timeout > lifetime:
            effective_idle_timeout = lifetime
            console.print(
                f"[[yellow]Warning[/yellow]] idle_timeout ({idle_timeout}s) exceeds lifetime ({lifetime}s). "
                f"Capping idle_timeout to {effective_idle_timeout}s."
            )
        else:
            # Use idle_timeout as-is (either lifetime is 0, or idle_timeout <= lifetime)
            effective_idle_timeout = idle_timeout
    else:
        # idle_timeout is 0 or negative, disable idle timeout
        effective_idle_timeout = 0

    state = AppState(
        command=server_mode,
        state_loader=state_loader,
        kwargs=kwargs,
        flag=flag,
        auth_options=auth_options,
        lifetime=lifetime,
        idle_timeout=effective_idle_timeout,
        share_url=kwargs.get("share_url"),
        organization_name=os.environ.get("RECCE_SESSION_ORGANIZATION_NAME"),
        web_url=os.environ.get("RECCE_CLOUD_WEB_URL"),
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
@click.option("--skip-check", is_flag=True, help="Skip running the checks.")
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
        state_loader = create_state_loader(
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
    # If recce can't infer default branch from "GITHUB_BASE_REF" and current_default_branch()
    if branch is None:
        console.print(
            "[[red]Error[/red]] Please provide your base branch name with '--branch' to download the base " "artifacts."
        )
        exit(1)

    return _download_artifacts(branch, cloud_token, console, kwargs, password, target_path)


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--branch",
    "-b",
    help="The branch to delete artifacts from.",
    type=click.STRING,
    envvar="GITHUB_HEAD_REF",
    default=current_branch(),
    show_default=True,
)
@click.option("--force", "-f", help="Bypasses the confirmation prompt. Delete the artifacts directly.", is_flag=True)
@add_options(recce_options)
def delete_artifacts(**kwargs):
    """
    Delete the dbt artifacts from cloud

    Delete the dbt artifacts (metadata.json, catalog.json) from Recce Cloud for the given branch.
    This will permanently remove the artifacts from the cloud storage.

    By default, the artifacts are deleted from the current branch. You can specify the branch using the --branch option.
    """
    from rich.console import Console

    console = Console()
    cloud_token = kwargs.get("cloud_token")
    branch = kwargs.get("branch")
    force = kwargs.get("force", False)

    if not force:
        if not click.confirm(f'Do you want to delete artifacts from branch "{branch}"?'):
            console.print("Deletion cancelled.")
            return 0

    try:
        delete_dbt_artifacts(branch=branch, token=cloud_token, debug=kwargs.get("debug", False))
        console.print(f"[[green]Success[/green]] Artifacts deleted from branch: {branch}")
        return 0
    except click.exceptions.Abort:
        pass
    except RecceCloudException as e:
        console.print("[[red]Error[/red]] Failed to delete the dbt artifacts from cloud.")
        console.print(f"Reason: {e.reason}")
        exit(1)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to delete the dbt artifacts from cloud.")
        console.print(f"Reason: {e}")
        exit(1)


@cloud.command(cls=TrackCommand, name="list-organizations")
@click.option("--api-token", help="The Recce Cloud API token.", type=click.STRING, envvar="RECCE_API_TOKEN")
@add_options(recce_options)
def list_organizations(**kwargs):
    """
    List organizations from Recce Cloud

    Lists all organizations that the authenticated user has access to.
    """
    from rich.console import Console
    from rich.table import Table

    console = Console()
    handle_debug_flag(**kwargs)

    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    try:
        from recce.util.recce_cloud import RecceCloud

        cloud = RecceCloud(api_token)
        organizations = cloud.list_organizations()

        if not organizations:
            console.print("No organizations found.")
            return

        table = Table(title="Organizations")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")
        table.add_column("Display Name", style="yellow")

        for org in organizations:
            table.add_row(str(org.get("id", "")), org.get("name", ""), org.get("display_name", ""))

        console.print(table)

    except RecceCloudException as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)
    except Exception as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)


@cloud.command(cls=TrackCommand, name="list-projects")
@click.option(
    "--organization",
    "-o",
    help="Organization ID (can also be set via RECCE_ORGANIZATION_ID environment variable)",
    type=click.STRING,
    envvar="RECCE_ORGANIZATION_ID",
)
@click.option("--api-token", help="The Recce Cloud API token.", type=click.STRING, envvar="RECCE_API_TOKEN")
@add_options(recce_options)
def list_projects(**kwargs):
    """
    List projects from Recce Cloud

    Lists all projects in the specified organization that the authenticated user has access to.

    Examples:

        # Using environment variable
        export RECCE_ORGANIZATION_ID=8
        recce cloud list-projects

        # Using command line argument
        recce cloud list-projects --organization 8

        # Override environment variable
        export RECCE_ORGANIZATION_ID=8
        recce cloud list-projects --organization 10
    """
    from rich.console import Console
    from rich.table import Table

    console = Console()
    handle_debug_flag(**kwargs)

    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    organization = kwargs.get("organization")
    if not organization:
        console.print("[[red]Error[/red]] Organization ID is required. Please provide it via:")
        console.print("  --organization <id> or set RECCE_ORGANIZATION_ID environment variable")
        exit(1)

    try:
        from recce.util.recce_cloud import RecceCloud

        cloud = RecceCloud(api_token)
        projects = cloud.list_projects(organization)

        if not projects:
            console.print(f"No projects found in organization {organization}.")
            return

        table = Table(title=f"Projects in Organization {organization}")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")
        table.add_column("Display Name", style="yellow")

        for project in projects:
            table.add_row(str(project.get("id", "")), project.get("name", ""), project.get("display_name", ""))

        console.print(table)

    except RecceCloudException as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)
    except Exception as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)


@cloud.command(cls=TrackCommand, name="list-sessions")
@click.option(
    "--organization",
    "-o",
    help="Organization ID (can also be set via RECCE_ORGANIZATION_ID environment variable)",
    type=click.STRING,
    envvar="RECCE_ORGANIZATION_ID",
)
@click.option(
    "--project",
    "-p",
    help="Project ID (can also be set via RECCE_PROJECT_ID environment variable)",
    type=click.STRING,
    envvar="RECCE_PROJECT_ID",
)
@click.option("--api-token", help="The Recce Cloud API token.", type=click.STRING, envvar="RECCE_API_TOKEN")
@add_options(recce_options)
def list_sessions(**kwargs):
    """
    List sessions from Recce Cloud

    Lists all sessions in the specified project that the authenticated user has access to.

    Examples:

        # Using environment variables
        export RECCE_ORGANIZATION_ID=8
        export RECCE_PROJECT_ID=7
        recce cloud list-sessions

        # Using command line arguments
        recce cloud list-sessions --organization 8 --project 7

        # Mixed usage (env + CLI override)
        export RECCE_ORGANIZATION_ID=8
        recce cloud list-sessions --project 7

        # Override environment variables
        export RECCE_ORGANIZATION_ID=8
        export RECCE_PROJECT_ID=7
        recce cloud list-sessions --organization 10 --project 9
    """
    from rich.console import Console
    from rich.table import Table

    console = Console()
    handle_debug_flag(**kwargs)

    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    organization = kwargs.get("organization")
    project = kwargs.get("project")

    # Validate required parameters
    if not organization:
        console.print("[[red]Error[/red]] Organization ID is required. Please provide it via:")
        console.print("  --organization <id> or set RECCE_ORGANIZATION_ID environment variable")
        exit(1)

    if not project:
        console.print("[[red]Error[/red]] Project ID is required. Please provide it via:")
        console.print("  --project <id> or set RECCE_PROJECT_ID environment variable")
        exit(1)

    try:
        from recce.util.recce_cloud import RecceCloud

        cloud = RecceCloud(api_token)
        sessions = cloud.list_sessions(organization, project)

        if not sessions:
            console.print(f"No sessions found in project {project}.")
            return

        table = Table(title=f"Sessions in Project {project}")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")
        table.add_column("Is Base", style="yellow")

        for session in sessions:
            is_base = "✓" if session.get("is_base", False) else ""
            table.add_row(session.get("id", ""), session.get("name", ""), is_base)

        console.print(table)

    except RecceCloudException as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)
    except Exception as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)


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
    "--api-token",
    help="The personal token generated by Recce Cloud.",
    type=click.STRING,
    envvar="RECCE_API_TOKEN",
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


snapshot_id_option = click.option(
    "--snapshot-id",
    help="The snapshot ID to upload artifacts to cloud.",
    type=click.STRING,
    envvar=["RECCE_SNAPSHOT_ID", "RECCE_SESSION_ID"],
    required=True,
)

session_id_option = click.option(
    "--session-id",
    help="The session ID to upload artifacts to cloud.",
    type=click.STRING,
    envvar=["RECCE_SESSION_ID", "RECCE_SNAPSHOT_ID"],
    required=True,
)

target_path_option = click.option(
    "--target-path",
    help="dbt artifacts directory for your artifacts.",
    type=click.STRING,
    default="target",
    show_default=True,
)


@cli.command(cls=TrackCommand, hidden=True)
@add_options([session_id_option, target_path_option])
@add_options(recce_cloud_auth_options)
@add_options(recce_options)
def upload_session(**kwargs):
    """
    Upload target/manifest.json and target/catalog.json to the specific session ID

    Upload the dbt artifacts (manifest.json, catalog.json) to Recce Cloud for the given session ID.
    This allows you to associate artifacts with a specific session for later use.

    Examples:\n

    \b
    # Upload artifacts to a session ID
    recce upload-session --session-id <session-id>

    \b
    # Upload artifacts from custom target path to a session ID
    recce upload-session --session-id <session-id> --target-path my-target
    """
    from rich.console import Console

    console = Console()
    handle_debug_flag(**kwargs)

    # Initialize Recce Config
    RecceConfig(config_file=kwargs.get("config"))

    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    session_id = kwargs.get("session_id")
    target_path = kwargs.get("target_path")

    try:
        rc = upload_artifacts_to_session(
            target_path, session_id=session_id, token=api_token, debug=kwargs.get("debug", False)
        )
        console.rule("Uploaded Successfully")
        console.print(
            f'Uploaded dbt artifacts to Recce Cloud for session ID "{session_id}" from "{os.path.abspath(target_path)}"'
        )
    except Exception as e:
        console.rule("Failed to Upload Session", style="red")
        console.print(f"[[red]Error[/red]] Failed to upload the dbt artifacts to the session {session_id}.")
        console.print(f"Reason: {e}")
        rc = 1
    return rc


# Backward compatibility for `recce snapshot` command
@cli.command(
    cls=TrackCommand,
    hidden=True,
    deprecated=True,
    help="Upload target/manifest.json and target/catalog.json to the specific snapshot ID",
)
@add_options([snapshot_id_option, target_path_option])
@add_options(recce_cloud_auth_options)
@add_options(recce_options)
def snapshot(**kwargs):
    kwargs["session_id"] = kwargs.get("snapshot_id")
    return upload_session(**kwargs)


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


@cli.command(cls=TrackCommand)
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_dbt_artifact_dir_options)
@add_options(recce_cloud_options)
@add_options(recce_cloud_auth_options)
@add_options(recce_hidden_options)
def mcp_server(**kwargs):
    """
    [Experiment] Start the Recce MCP (Model Context Protocol) server

    The MCP server provides a stdio-based interface for AI assistants and tools
    to interact with Recce's data validation capabilities.

    Available tools:
    - get_lineage_diff: Get lineage differences between environments
    - row_count_diff: Compare row counts between environments
    - query: Execute SQL queries with dbt templating
    - query_diff: Compare query results between environments
    - profile_diff: Generate statistical profiles and compare

    Examples:\n

    \b
    # Start the MCP server
    recce mcp-server

    \b
    # Start with custom dbt configuration
    recce mcp-server --target prod --project-dir ./my_project
    """
    from rich.console import Console

    console = Console()
    try:
        # Import here to avoid import errors if mcp is not installed
        from recce.mcp_server import run_mcp_server
    except ImportError as e:
        console.print(f"[[red]Error[/red]] Failed to import MCP server: {e}")
        console.print(r"Please install the MCP package: pip install 'recce\[mcp]'")
        exit(1)

    # Initialize Recce Config
    RecceConfig(config_file=kwargs.get("config"))

    handle_debug_flag(**kwargs)
    patch_derived_args(kwargs)

    # Prepare API token
    try:
        api_token = prepare_api_token(**kwargs)
        kwargs["api_token"] = api_token
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    # Create state loader using shared function (if cloud mode is enabled)
    is_cloud = kwargs.get("cloud", False)
    if is_cloud:
        state_loader = create_state_loader_by_args(None, **kwargs)
        kwargs["state_loader"] = state_loader

    try:
        console.print("Starting Recce MCP Server...")
        console.print("Available tools: get_lineage_diff, row_count_diff, query, query_diff, profile_diff")

        # Run the async server
        asyncio.run(run_mcp_server(**kwargs))
    except Exception as e:
        console.print(f"[[red]Error[/red]] Failed to start MCP server: {e}")
        if kwargs.get("debug"):
            import traceback

            traceback.print_exc()
        exit(1)


if __name__ == "__main__":
    cli()
