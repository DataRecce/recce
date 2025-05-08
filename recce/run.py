import os
import sys
import time
from datetime import datetime, timezone
from typing import List

from deepdiff import DeepDiff
from rich import box
from rich.console import Console
from rich.table import Table

from recce.apis.check_func import (
    create_check_from_run,
    create_check_without_run,
    purge_preset_checks,
)
from recce.apis.run_func import submit_run
from recce.config import RecceConfig
from recce.core import default_context
from recce.models.types import RunType
from recce.summary import generate_markdown_summary


def check_github_ci_env(**kwargs):
    """Check if the environment is GitHub CI"""
    if "GITHUB_ACTIONS" not in os.environ:
        return False, None

    # Get the PR number
    github_server_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    github_repository = os.environ.get("GITHUB_REPOSITORY", "")
    github_ref_name = os.environ.get("GITHUB_REF_NAME", "")
    github_pull_request_url = f"{github_server_url}/{github_repository}/pull/{github_ref_name}"

    return True, github_pull_request_url


def load_preset_checks(checks: list):
    console = Console()
    table = Table(title="Recce Preset Checks", box=box.HORIZONTALS, title_style="bold dark_orange3")
    table.add_column("Name")
    table.add_column("Type")
    table.add_column("Description")
    for check in checks:
        is_check = False
        name = check.get("name")
        description = check.get("description", "")
        check_type = check.get("type")
        check_params = check.get("params", {})
        check_options = check.get("view_options", {})

        create_check_without_run(
            name, description, check_type, check_params, check_options, is_preset=True, is_checked=is_check
        )
        table.add_row(name, check_type.replace("_", " ").title(), description.strip())
    console.print(table)


def schema_diff_should_be_approved(check_params: dict) -> bool:
    try:
        context = default_context()

        if "node_id" in check_params:
            # If the node_id is provided, then use it
            if isinstance(check_params["node_id"], str):
                selected_node_ids = [check_params["node_id"]]
            else:
                selected_node_ids = check_params.get("node_id", [])
        else:
            # Otherwise, select the nodes based on the select/exclude/packages/view_mode
            selected_node_ids = context.adapter.select_nodes(
                select=check_params.get("select"),
                exclude=check_params.get("exclude"),
                packages=check_params.get("packages"),
                view_mode=check_params.get("view_mode"),
            )

        selected_node_ids = [node for node in selected_node_ids if not node.startswith("test.")]

        def _get_selected_node_columns_from_lineage(lineage, node_ids: list[str]):
            nodes = {}
            for node_id, node in lineage.get("nodes", {}).items():
                if node_id in node_ids:
                    nodes[node_id] = node.get("columns", {})
            return nodes

        base_nodes = _get_selected_node_columns_from_lineage(context.get_lineage(base=True), selected_node_ids)
        curr_nodes = _get_selected_node_columns_from_lineage(context.get_lineage(base=False), selected_node_ids)
        diff = DeepDiff(base_nodes, curr_nodes, ignore_order=True)

        # If the diff is empty, then the check should be approved
        if bool(diff) is False:
            return True
    except Exception:
        # If there is any error, then the check should not be approved
        pass

    return False


def run_should_be_approved(run):
    if run.type == RunType.ROW_COUNT_DIFF:
        # If the run has an error, then the check should not be approved
        if run.error is not None:
            return False
        # If the row count are exactly the same, then the check should be approved
        for column, row_count_result in run.result.items():
            if row_count_result["base"] != row_count_result["curr"]:
                return False
        return True
    return False


async def execute_preset_checks(preset_checks: list) -> (int, List[dict]):
    """
    Execute the preset checks
    """
    console = Console()
    rc = 0
    failed_checks = []
    table = Table(title="Recce Preset Checks", box=box.HORIZONTALS, title_style="bold dark_orange3")
    table.add_column("Status")
    table.add_column("Name")
    table.add_column("Type")
    table.add_column("Execution Time")
    table.add_column("Failed Reason")

    # Purge the existing preset checks before running the new ones
    purge_preset_checks()

    # Execute the preset checks
    for check in preset_checks:
        run = None
        check_name = check.get("name")
        check_type = check.get("type")
        check_description = check.get("description", "")
        check_params = check.get("params") if check.get("params") else {}
        check_options = check.get("view_options", {})

        try:
            # verify the check
            if check_type not in [e.value for e in RunType]:
                raise ValueError(f"Invalid check type: {check_type}")

            start = time.time()
            if check_type in ["schema_diff", "lineage_diff"]:
                is_check = schema_diff_should_be_approved(check_params) if check_type == "schema_diff" else False
                create_check_without_run(
                    check_name,
                    check_description,
                    check_type,
                    check_params,
                    check_options,
                    is_preset=True,
                    is_checked=is_check,
                )
            else:
                run, future = submit_run(check_type, params=check_params)
                await future
                is_check = run_should_be_approved(run)
                create_check_from_run(
                    run.run_id, check_name, check_description, check_options, is_preset=True, is_checked=is_check
                )

            end = time.time()
            table.add_row(
                "[[green]Success[/green]]",
                check_name,
                check_type.replace("_", " ").title(),
                f"{end - start:.2f} seconds",
                "N/A",
            )
        except Exception as e:
            rc = 1
            if run is None:
                table.add_row("[[red]Error[/red]]", check_name, check_type.replace("_", " ").title(), "N/A", str(e))
                failed_checks.append(
                    {
                        "check_name": check_name,
                        "check_type": check_type,
                        "check_description": check_description,
                        "failed_type": "error",
                        "failed_reason": str(e),
                    }
                )
            else:
                create_check_from_run(run.run_id, check_name, check_description, check_options, is_preset=True)
                table.add_row("[[red]Failed[/red]]", check_name, check_type.replace("_", " ").title(), "N/A", run.error)
                failed_checks.append(
                    {
                        "check_name": check_name,
                        "check_type": check_type,
                        "check_description": "N/A",
                        "failed_type": "failed",
                        "failed_reason": run.error,
                    }
                )

    console.print(table)
    return rc, failed_checks


async def execute_state_checks(checks: list) -> (int, List[dict]):
    """
    Execute the checks from loaded state
    """
    console = Console()
    rc = 0
    failed_checks = []
    table = Table(title="Recce Checks", box=box.HORIZONTALS, title_style="bold dark_orange3")
    table.add_column("Status")
    table.add_column("Name")
    table.add_column("Type")
    table.add_column("Execution Time")
    table.add_column("Failed Reason")

    # Execute loaded checks
    for check in checks:
        run = None
        check_id = check.check_id
        check_name = check.name
        check_type = check.type.value
        check_description = check.description
        check_params = check.params if check.params else {}
        if check.is_checked:
            check.is_checked = False
            check.updated_at = datetime.now(tz=timezone.utc).replace(microsecond=0)

        try:
            # verify the check
            if check_type not in [e.value for e in RunType]:
                raise ValueError(f"Invalid check type: {check_type}")

            start = time.time()
            if check_type not in ["schema_diff"]:
                run, future = submit_run(check_type, params=check_params, check_id=check_id)
                await future

            end = time.time()
            table.add_row(
                "[[green]Success[/green]]",
                check_name,
                check_type.replace("_", " ").title(),
                f"{end - start:.2f} seconds",
                "N/A",
            )
        except Exception as e:
            rc = 1
            if run is None:
                table.add_row("[[red]Error[/red]]", check_name, check_type.replace("_", " ").title(), "N/A", str(e))
                failed_checks.append(
                    {
                        "check_name": check_name,
                        "check_type": check_type,
                        "check_description": check_description,
                        "failed_type": "error",
                        "failed_reason": str(e),
                    }
                )
            else:
                table.add_row("[[red]Failed[/red]]", check_name, check_type.replace("_", " ").title(), "N/A", run.error)
                failed_checks.append(
                    {
                        "check_name": check_name,
                        "check_type": check_type,
                        "check_description": "N/A",
                        "failed_type": "failed",
                        "failed_reason": run.error,
                    }
                )

    console.print(table)
    return rc, failed_checks


def process_failed_checks(failed_checks: List[dict], error_log=None):
    from py_markdown_table.markdown_table import markdown_table

    failed_check_table = []
    for check in failed_checks:
        name = check.get("check_name")
        check_type = check.get("check_type")
        failed_type = check.get("failed_type")
        failed_reason = check.get("failed_reason")
        failed_check_table.append(
            {
                "Name": name,
                "Type": check_type,
                "Kind of Failed": failed_type,
                "Failed Reason": failed_reason.replace("\n", " "),
            }
        )

    content = "# Recce Runc Failed Checks\n"
    content += markdown_table(failed_check_table).set_params(quote=False, row_sep="markdown").get_markdown()

    if error_log:
        with open(error_log, "w") as f:
            f.write(content)
        print(f"The failed checks are stored at '{error_log}'")
    else:
        print(content, file=sys.stderr)


async def cli_run(output_state_file: str, **kwargs):
    """The main function of 'recce run' command. It will execute the default runs and store the state."""
    console = Console()
    error_log = kwargs.get("error_log")
    if kwargs.get("sqlmesh", False):
        console.print("[[red]Error[/red]] SQLMesh adapter is not supported.")
        sys.exit(1)

    from recce.core import load_context

    ctx = load_context(**kwargs)

    is_skip_query = kwargs.get("skip_query", False)

    # Prepare the artifact by collecting the lineage
    console.rule("DBT Artifacts")
    from recce.adapter.dbt_adapter import DbtAdapter

    dbt_adaptor: DbtAdapter = ctx.adapter
    dbt_adaptor.print_lineage_info()

    # Execute the preset checks
    rc = 0
    if ctx.state_loader.state is None:
        preset_checks = RecceConfig().get("checks")
        if is_skip_query or preset_checks is None or len(preset_checks) == 0:
            # Skip the preset checks
            pass
        else:
            console.rule("Preset checks")
            _, failed_checks = await execute_preset_checks(preset_checks)
            if failed_checks:
                console.print("[[yellow]Warning[/yellow]] Preset checks failed. Please see the failed reason.")
                process_failed_checks(failed_checks, error_log)
    else:
        state_checks = ctx.state_loader.state.checks
        if is_skip_query or state_checks is None or len(state_checks) == 0:
            # Skip the checks in the state
            pass
        else:
            console.rule("Checks")
            _, failed_checks = await execute_state_checks(state_checks)
            if failed_checks:
                console.print("[[yellow]Warning[/yellow]] Checks failed. Please see the failed reason.")
                process_failed_checks(failed_checks, error_log)

    from recce.event import log_load_state

    log_load_state(command="run")

    # Export the state
    console.rule("Export state")
    ctx.state_loader.state_file = output_state_file
    msg = ctx.state_loader.export(ctx.export_state())
    console.print(msg)

    summary_path = kwargs.get("summary")
    if summary_path:
        dirs = os.path.dirname(summary_path)
        if dirs:
            os.makedirs(dirs, exist_ok=True)
        with open(summary_path, "w") as f:
            f.write(generate_markdown_summary(ctx))
        console.print(f"The summary is stored at '{summary_path}'")

    return rc
