#!/usr/bin/env python
"""
Recce Cloud CLI - Lightweight command for managing Recce Cloud operations.
"""

import logging
import os
import subprocess
import sys

import click
from rich.console import Console
from rich.logging import RichHandler

from recce_cloud import __version__
from recce_cloud.artifact import get_adapter_type, verify_artifacts_path
from recce_cloud.ci_providers import CIDetector
from recce_cloud.delete import (
    delete_existing_session,
    delete_with_platform_apis,
)
from recce_cloud.download import (
    download_from_existing_session,
    download_with_platform_apis,
)
from recce_cloud.report import fetch_and_generate_report
from recce_cloud.upload import upload_to_existing_session, upload_with_platform_apis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[RichHandler(console=Console(stderr=True), show_time=False, show_path=False)],
)
logger = logging.getLogger(__name__)

# Suppress CI detector logs since we display formatted output in the CLI
logging.getLogger("recce_cloud.ci_providers.detector").setLevel(logging.WARNING)


@click.group()
def cloud_cli():
    """
    Recce Cloud CLI - Manage Recce Cloud sessions and state files.

    A lightweight tool for CI/CD environments to interact with Recce Cloud
    without the heavy dependencies of the full recce package.
    """
    pass


@cloud_cli.command()
def version():
    """Show the version of recce-cloud."""
    click.echo(__version__)


@cloud_cli.command()
@click.option(
    "--token",
    default=None,
    help="API token for authentication (for headless/CI environments)",
)
@click.option(
    "--status",
    is_flag=True,
    help="Check current login status without modifying credentials",
)
def login(token, status):
    """
    Authenticate with Recce Cloud.

    By default, opens a browser for OAuth authentication. The browser flow
    securely exchanges credentials using RSA encryption.

    \b
    Examples:
      # Browser-based OAuth login (recommended)
      recce-cloud login

      # Check if already logged in
      recce-cloud login --status

      # Direct token authentication (for headless/CI environments)
      recce-cloud login --token <your-api-token>
    """
    from recce_cloud.auth.login import (
        check_login_status,
        get_api_token,
        login_with_browser,
        login_with_token,
    )

    console = Console()

    # Status check mode
    if status:
        is_logged_in, email = check_login_status()
        if is_logged_in:
            console.print(f"[green]✓[/green] Logged in as [cyan]{email or 'Unknown'}[/cyan]")
            token_value = get_api_token()
            if token_value:
                masked = f"{token_value[:8]}...{token_value[-4:]}" if len(token_value) > 12 else "***"
                console.print(f"  Token: {masked} (valid)")
        else:
            console.print("[yellow]Not logged in[/yellow]")
            console.print("Run 'recce-cloud login' to authenticate")
        sys.exit(0 if is_logged_in else 1)

    # Check if already logged in
    is_logged_in, email = check_login_status()
    if is_logged_in:
        console.print(f"[green]✓[/green] Already logged in as [cyan]{email or 'Unknown'}[/cyan]")
        if not click.confirm("Do you want to re-authenticate?", default=False):
            sys.exit(0)

    # Direct token authentication mode
    if token:
        if login_with_token(token):
            sys.exit(0)
        else:
            sys.exit(1)

    # Browser OAuth flow
    if login_with_browser():
        sys.exit(0)
    else:
        console.print()
        console.print("[yellow]Tip:[/yellow] For headless environments, use 'recce-cloud login --token <token>'")
        sys.exit(1)


@cloud_cli.command()
def logout():
    """
    Remove stored Recce Cloud credentials.

    Clears the API token from ~/.recce/profile.yml.
    """
    from recce_cloud.auth.login import logout as do_logout
    from recce_cloud.auth.profile import get_profile_path

    console = Console()

    do_logout()
    console.print("[green]✓[/green] Logged out successfully")
    console.print(f"  Credentials removed from {get_profile_path()}")


@cloud_cli.command()
@click.option(
    "--org",
    help="Organization name or slug to bind to",
)
@click.option(
    "--project",
    help="Project name or slug to bind to",
)
@click.option(
    "--status",
    is_flag=True,
    help="Show current project binding without modifying",
)
@click.option(
    "--clear",
    is_flag=True,
    help="Remove current project binding",
)
def init(org, project, status, clear):
    """
    Bind current directory to a Recce Cloud project.

    Creates a .recce/config file that stores the org/project binding.
    Subsequent commands will auto-detect this binding.

    \b
    Examples:
      # Interactive mode: Select org and project
      recce-cloud init

      # Explicit mode: Direct binding (for scripts/CI)
      recce-cloud init --org myorg --project my-dbt-project

      # Check current binding
      recce-cloud init --status

      # Remove binding
      recce-cloud init --clear
    """
    from recce_cloud.api.client import RecceCloudClient
    from recce_cloud.api.exceptions import RecceCloudException
    from recce_cloud.auth.login import get_user_info
    from recce_cloud.auth.profile import get_api_token
    from recce_cloud.config.project_config import (
        add_to_gitignore,
        clear_project_binding,
        get_config_path,
        get_project_binding,
        save_project_binding,
    )

    console = Console()

    # Check authentication first
    token = get_api_token()
    if not token:
        console.print("[red]Error:[/red] Not logged in")
        console.print("Run 'recce-cloud login' first")
        sys.exit(1)

    # Status check mode
    if status:
        binding = get_project_binding()
        if binding:
            console.print(f"[green]✓[/green] Bound to [cyan]{binding['org']}/{binding['project']}[/cyan]")
            if binding.get("bound_at"):
                console.print(f"  Bound at: {binding['bound_at']}")
            if binding.get("bound_by"):
                console.print(f"  Bound by: {binding['bound_by']}")
            console.print(f"  Config file: {get_config_path()}")
        else:
            console.print("[yellow]Not bound to any project[/yellow]")
            console.print("Run 'recce-cloud init' to bind this directory")
        sys.exit(0 if binding else 1)

    # Clear mode
    if clear:
        if clear_project_binding():
            console.print("[green]✓[/green] Project binding removed")
        else:
            console.print("[yellow]No project binding to remove[/yellow]")
        sys.exit(0)

    # Validate flag combinations
    if (org and not project) or (project and not org):
        console.print("[red]Error:[/red] Both --org and --project must be provided together")
        sys.exit(1)

    # Get user email for binding metadata
    user_info = get_user_info(token)
    user_email = user_info.get("email") if user_info else None

    # Explicit mode: Direct binding
    if org and project:
        # Validate org/project exist
        try:
            api = RecceCloudClient(token)
            org_obj = api.get_organization(org)
            if not org_obj:
                console.print(f"[red]Error:[/red] Organization '{org}' not found")
                sys.exit(1)

            # Use org ID for project lookup (API requires ID)
            project_obj = api.get_project(org_obj.get("id"), project)
            if not project_obj:
                console.print(f"[red]Error:[/red] Project '{project}' not found in organization '{org}'")
                sys.exit(1)

            # Use slug for storage (more stable than name)
            org_slug = org_obj.get("slug", org)
            project_slug = project_obj.get("slug", project)

            save_project_binding(org_slug, project_slug, user_email)
            console.print(f"[green]✓[/green] Bound to [cyan]{org_slug}/{project_slug}[/cyan]")
            console.print(f"  Config saved to {get_config_path()}")

            # Offer to add to .gitignore
            if click.confirm("Add .recce/ to .gitignore?", default=True):
                if add_to_gitignore():
                    console.print("[green]✓[/green] Added .recce/ to .gitignore")
                else:
                    console.print("  .recce/ already in .gitignore")

            sys.exit(0)

        except RecceCloudException as e:
            console.print(f"[red]Error:[/red] {e}")
            sys.exit(1)

    # Interactive mode: Select org → project
    try:
        api = RecceCloudClient(token)

        # List organizations
        console.print("Fetching organizations...")
        orgs = api.list_organizations()

        if not orgs:
            console.print("[yellow]No organizations found[/yellow]")
            console.print("Please create an organization at https://cloud.datarecce.io first")
            sys.exit(1)

        # Build org choices: (id for API, name for config, display_name for UI)
        org_choices = []
        for o in orgs:
            org_id = o.get("id")
            org_name = o.get("name") or o.get("slug") or str(org_id)
            display_name = o.get("display_name") or org_name
            org_choices.append((org_id, org_name, display_name))

        # Select organization
        console.print()
        console.print("[cyan]Select organization:[/cyan]")
        for i, (_, _, display_name) in enumerate(org_choices, 1):
            console.print(f"  {i}. {display_name}")

        org_idx = click.prompt("Enter number", type=click.IntRange(1, len(org_choices)))
        selected_org_id, selected_org_name, selected_org_display = org_choices[org_idx - 1]

        # List projects (use org_id for API call)
        console.print()
        console.print(f"Fetching projects for {selected_org_display}...")
        projects = api.list_projects(selected_org_id)

        if not projects:
            console.print(f"[yellow]No projects found in {selected_org_display}[/yellow]")
            console.print("Please create a project at https://cloud.datarecce.io first")
            sys.exit(1)

        # Build project choices: (name for config, display_name for UI)
        # Filter out archived projects
        project_choices = []
        for p in projects:
            # Skip archived projects (check status field and archived flags)
            if p.get("status") == "archived" or p.get("archived") or p.get("is_archived"):
                continue
            project_name = p.get("name") or p.get("slug") or str(p.get("id"))
            display_name = p.get("display_name") or project_name
            project_choices.append((project_name, display_name))

        if not project_choices:
            console.print(f"[yellow]No active projects found in {selected_org_display}[/yellow]")
            console.print("Please create a project at https://cloud.datarecce.io first")
            sys.exit(1)

        # Select project
        console.print()
        console.print("[cyan]Select project:[/cyan]")
        for i, (_, display_name) in enumerate(project_choices, 1):
            console.print(f"  {i}. {display_name}")

        project_idx = click.prompt("Enter number", type=click.IntRange(1, len(project_choices)))
        selected_project_name, selected_project_display = project_choices[project_idx - 1]

        # Save binding (use names for config, not IDs)
        save_project_binding(selected_org_name, selected_project_name, user_email)
        console.print()
        console.print(f"[green]✓[/green] Bound to [cyan]{selected_org_name}/{selected_project_name}[/cyan]")
        console.print(f"  Config saved to {get_config_path()}")

        # Offer to add to .gitignore
        if click.confirm("Add .recce/ to .gitignore?", default=True):
            if add_to_gitignore():
                console.print("[green]✓[/green] Added .recce/ to .gitignore")
            else:
                console.print("  .recce/ already in .gitignore")

    except RecceCloudException as e:
        console.print(f"[red]Error:[/red] Failed to fetch data from Recce Cloud: {e}")
        sys.exit(1)
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@cloud_cli.command()
@click.option(
    "--target-path",
    type=click.Path(exists=True),
    default="target",
    help="Path to dbt target directory containing manifest.json and catalog.json",
)
@click.option(
    "--session-id",
    envvar="RECCE_SESSION_ID",
    help="Recce Cloud session ID to upload artifacts to (or use RECCE_SESSION_ID env var). "
    "If not provided, session will be created automatically using platform-specific APIs (GitHub/GitLab).",
)
@click.option(
    "--session-name",
    help="Session name to look up or create. If a session with this name exists, "
    "uploads to it; otherwise prompts to create a new session (use --yes to skip prompt).",
)
@click.option(
    "--yes",
    "-y",
    "skip_confirmation",
    is_flag=True,
    help="Skip confirmation prompts (auto-create session if not found).",
)
@click.option(
    "--cr",
    type=int,
    help="Change request number (PR/MR) (overrides auto-detection)",
)
@click.option(
    "--type",
    "session_type",
    type=click.Choice(["cr", "prod", "dev"]),
    help="Session type (overrides auto-detection)",
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Show what would be uploaded without actually uploading",
)
def upload(target_path, session_id, session_name, skip_confirmation, cr, session_type, dry_run):
    """
    Upload dbt artifacts (manifest.json, catalog.json) to Recce Cloud.

    \b
    Authentication (auto-detected):
    - RECCE_API_TOKEN env var or 'recce-cloud login' profile (for --session-id/--session-name workflow)
    - GITHUB_TOKEN (GitHub Actions)
    - CI_JOB_TOKEN (GitLab CI)

    \b
    Common Examples:
      # Auto-create session in PR/MR
      recce-cloud upload

      # Upload production metadata from main branch
      recce-cloud upload --type prod

      # Upload to specific session by ID
      recce-cloud upload --session-id abc123

      # Upload by session name (creates if not exists)
      recce-cloud upload --session-name "my-evaluation-session"

      # Auto-create session without confirmation
      recce-cloud upload --session-name "new-session" --yes

      # Custom target path
      recce-cloud upload --target-path custom-target
    """
    console = Console()

    # 1. Auto-detect CI environment information
    console.rule("CI Environment Detection", style="blue")
    try:
        ci_info = CIDetector.detect()
        ci_info = CIDetector.apply_overrides(ci_info, cr=cr, session_type=session_type)

        # Display detected CI information immediately
        if ci_info:
            info_table = []
            if ci_info.platform:
                info_table.append(f"[cyan]Platform:[/cyan] {ci_info.platform}")

            # Display CR number as PR or MR based on platform
            if ci_info.cr_number is not None:
                if ci_info.platform == "github-actions":
                    info_table.append(f"[cyan]PR Number:[/cyan] {ci_info.cr_number}")
                elif ci_info.platform == "gitlab-ci":
                    info_table.append(f"[cyan]MR Number:[/cyan] {ci_info.cr_number}")
                else:
                    info_table.append(f"[cyan]CR Number:[/cyan] {ci_info.cr_number}")

            # Display CR URL as PR URL or MR URL based on platform
            if ci_info.cr_url:
                if ci_info.platform == "github-actions":
                    info_table.append(f"[cyan]PR URL:[/cyan] {ci_info.cr_url}")
                elif ci_info.platform == "gitlab-ci":
                    info_table.append(f"[cyan]MR URL:[/cyan] {ci_info.cr_url}")
                else:
                    info_table.append(f"[cyan]CR URL:[/cyan] {ci_info.cr_url}")

            if ci_info.session_type:
                info_table.append(f"[cyan]Session Type:[/cyan] {ci_info.session_type}")
            if ci_info.commit_sha:
                info_table.append(f"[cyan]Commit SHA:[/cyan] {ci_info.commit_sha[:8]}...")
            if ci_info.base_branch:
                info_table.append(f"[cyan]Base Branch:[/cyan] {ci_info.base_branch}")
            if ci_info.source_branch:
                info_table.append(f"[cyan]Source Branch:[/cyan] {ci_info.source_branch}")
            if ci_info.repository:
                info_table.append(f"[cyan]Repository:[/cyan] {ci_info.repository}")

            for line in info_table:
                console.print(line)
        else:
            console.print("[yellow]No CI environment detected[/yellow]")
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Failed to detect CI environment: {e}")
        console.print("Continuing without CI metadata...")
        ci_info = None

    # 2. Validate artifacts exist
    if not verify_artifacts_path(target_path):
        console.print(f"[red]Error:[/red] Invalid target path: {target_path}")
        console.print("Please provide a valid target path containing manifest.json and catalog.json.")
        sys.exit(3)

    manifest_path = os.path.join(target_path, "manifest.json")
    catalog_path = os.path.join(target_path, "catalog.json")

    # 3. Extract adapter type from manifest
    try:
        adapter_type = get_adapter_type(manifest_path)
    except Exception as e:
        console.print("[red]Error:[/red] Failed to parse adapter type from manifest.json")
        console.print(f"Reason: {e}")
        sys.exit(3)

    # 4. Handle dry-run mode (before authentication or API calls)
    if dry_run:
        console.rule("Dry Run Summary", style="yellow")
        console.print("[yellow]Dry run mode enabled - no actual upload will be performed[/yellow]")
        console.print()

        # Display platform information if detected
        if ci_info and ci_info.platform:
            console.print("[cyan]Platform Information:[/cyan]")
            console.print(f"  • Platform: {ci_info.platform}")
            if ci_info.repository:
                console.print(f"  • Repository: {ci_info.repository}")
            if ci_info.cr_number is not None:
                console.print(f"  • CR Number: {ci_info.cr_number}")
            if ci_info.commit_sha:
                console.print(f"  • Commit SHA: {ci_info.commit_sha[:8]}")
            if ci_info.source_branch:
                console.print(f"  • Source Branch: {ci_info.source_branch}")
            if ci_info.base_branch:
                console.print(f"  • Base Branch: {ci_info.base_branch}")
            if ci_info.session_type:
                console.print(f"  • Session Type: {ci_info.session_type}")
            console.print()

        # Display upload summary
        console.print("[cyan]Upload Workflow:[/cyan]")
        if session_id:
            console.print("  • Upload to existing session by ID")
            console.print(f"  • Session ID: {session_id}")
        elif session_name:
            console.print("  • Upload by session name (lookup or create)")
            console.print(f"  • Session Name: {session_name}")
            if skip_confirmation:
                console.print("  • Auto-create if not exists (--yes flag)")
            else:
                console.print("  • Will prompt before creating if not exists")
        else:
            console.print("  • Auto-create session and upload")
            if ci_info and ci_info.platform in ["github-actions", "gitlab-ci"]:
                console.print("  • Platform-specific APIs will be used")
            else:
                console.print("  • [yellow]Warning: Platform not supported for auto-session creation[/yellow]")

        console.print()
        console.print("[cyan]Files to upload:[/cyan]")
        console.print(f"  • manifest.json: {os.path.abspath(manifest_path)}")
        console.print(f"  • catalog.json: {os.path.abspath(catalog_path)}")
        console.print(f"  • Adapter type: {adapter_type}")

        console.print()
        console.print("[green]✓[/green] Dry run completed successfully")
        sys.exit(0)

    # 5. Choose upload workflow based on provided options
    # Priority: --session-id > --session-name > platform-specific auto-detection
    if session_id:
        # Generic workflow: Upload to existing session using session ID
        # This workflow requires RECCE_API_TOKEN or logged-in profile
        from recce_cloud.auth.profile import get_api_token

        token = os.getenv("RECCE_API_TOKEN") or get_api_token()
        if not token:
            console.print("[red]Error:[/red] No RECCE_API_TOKEN provided and not logged in")
            console.print("Either set RECCE_API_TOKEN environment variable or run 'recce-cloud login' first")
            sys.exit(2)

        upload_to_existing_session(console, token, session_id, manifest_path, catalog_path, adapter_type, target_path)
    elif session_name:
        # Session name workflow: Look up session by name, create if not exists
        # This workflow requires RECCE_API_TOKEN or logged-in profile, plus org/project config
        from recce_cloud.auth.profile import get_api_token
        from recce_cloud.upload import upload_with_session_name

        token = os.getenv("RECCE_API_TOKEN") or get_api_token()
        if not token:
            console.print("[red]Error:[/red] No RECCE_API_TOKEN provided and not logged in")
            console.print("Either set RECCE_API_TOKEN environment variable or run 'recce-cloud login' first")
            sys.exit(2)

        upload_with_session_name(
            console,
            token,
            session_name,
            manifest_path,
            catalog_path,
            adapter_type,
            target_path,
            skip_confirmation=skip_confirmation,
        )
    else:
        # Platform-specific workflow: Use platform APIs to create session and upload
        # This workflow MUST use CI job tokens (CI_JOB_TOKEN or GITHUB_TOKEN)
        if not ci_info or not ci_info.access_token:
            console.print("[red]Error:[/red] Platform-specific upload requires CI environment")
            console.print(
                "Either run in GitHub Actions/GitLab CI or provide --session-id/--session-name for generic upload"
            )
            sys.exit(2)

        token = ci_info.access_token
        if ci_info.platform == "github-actions":
            console.print("[cyan]Info:[/cyan] Using GITHUB_TOKEN for platform-specific authentication")
        elif ci_info.platform == "gitlab-ci":
            console.print("[cyan]Info:[/cyan] Using CI_JOB_TOKEN for platform-specific authentication")

        upload_with_platform_apis(console, token, ci_info, manifest_path, catalog_path, adapter_type, target_path)


@cloud_cli.command(name="list")
@click.option(
    "--type",
    "session_type",
    type=click.Choice(["cr", "prod", "dev"]),
    help="Filter by session type (prod=base, cr=has PR link, dev=other)",
)
@click.option(
    "--json",
    "output_json",
    is_flag=True,
    help="Output in JSON format",
)
def list_sessions_cmd(session_type, output_json):
    """
    List sessions in the configured Recce Cloud project.

    \b
    Requires:
    - RECCE_API_TOKEN env var or 'recce-cloud login'
    - Project binding via 'recce-cloud init' or RECCE_ORG/RECCE_PROJECT env vars

    \b
    Examples:
      # List all sessions
      recce-cloud list

      # List only production sessions
      recce-cloud list --type prod

      # Output as JSON
      recce-cloud list --json
    """
    import json

    from rich.table import Table

    from recce_cloud.api.client import RecceCloudClient
    from recce_cloud.auth.profile import get_api_token
    from recce_cloud.config.resolver import ConfigurationError, resolve_config

    console = Console()

    # 1. Get API token
    token = os.getenv("RECCE_API_TOKEN") or get_api_token()
    if not token:
        console.print("[red]Error:[/red] No RECCE_API_TOKEN provided and not logged in")
        console.print("Either set RECCE_API_TOKEN environment variable or run 'recce-cloud login' first")
        sys.exit(2)

    # 2. Resolve org/project configuration
    try:
        config = resolve_config()
        org = config.org
        project = config.project
    except ConfigurationError as e:
        console.print("[red]Error:[/red] Could not resolve org/project configuration")
        console.print(f"Reason: {e}")
        console.print()
        console.print("Run 'recce-cloud init' to bind this directory to a project,")
        console.print("or set RECCE_ORG and RECCE_PROJECT environment variables")
        sys.exit(2)

    # 3. Initialize client and resolve IDs
    try:
        client = RecceCloudClient(token)

        org_info = client.get_organization(org)
        if not org_info:
            console.print(f"[red]Error:[/red] Organization '{org}' not found or you don't have access")
            sys.exit(2)
        org_id = org_info["id"]

        project_info = client.get_project(org_id, project)
        if not project_info:
            console.print(f"[red]Error:[/red] Project '{project}' not found in organization '{org}'")
            sys.exit(2)
        project_id = project_info["id"]

    except Exception as e:
        console.print(f"[red]Error:[/red] Failed to initialize: {e}")
        sys.exit(2)

    # Helper to derive session type from fields:
    # - prod: is_base = True
    # - cr: pr_link is not null
    # - dev: everything else
    def get_session_type(s):
        if s.get("is_base"):
            return "prod"
        elif s.get("pr_link"):
            return "cr"
        else:
            return "dev"

    # 4. List sessions
    try:
        sessions = client.list_sessions(org_id, project_id)

        if session_type:
            sessions = [s for s in sessions if get_session_type(s) == session_type]
    except Exception as e:
        console.print(f"[red]Error:[/red] Failed to list sessions: {e}")
        sys.exit(2)

    # 5. Output results
    if output_json:
        console.print(json.dumps(sessions, indent=2, default=str))
        sys.exit(0)

    if not sessions:
        console.print("[yellow]No sessions found[/yellow]")
        if session_type:
            console.print(f"(filtered by type: {session_type})")
        sys.exit(0)

    # Display as table
    console.print(f"[cyan]Organization:[/cyan] {org}")
    console.print(f"[cyan]Project:[/cyan] {project}")
    console.print()

    table = Table(title=f"Sessions ({len(sessions)} total)")
    table.add_column("Name", style="cyan", no_wrap=True)
    table.add_column("ID", style="dim")
    table.add_column("Type", style="green")
    table.add_column("Created At")
    table.add_column("Adapter")

    for session in sessions:
        name = session.get("name", "-")
        session_id = session.get("id", "-")
        s_type = get_session_type(session)
        created_at = session.get("created_at", "-")
        if created_at and created_at != "-":
            # Format datetime if present
            try:
                from datetime import datetime

                dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                created_at = dt.strftime("%Y-%m-%d %H:%M")
            except (ValueError, AttributeError):
                pass
        adapter = session.get("adapter_type", "-")

        table.add_row(name or "(unnamed)", session_id, s_type, created_at, adapter or "-")

    console.print(table)
    sys.exit(0)


@cloud_cli.command()
@click.option(
    "--target-path",
    type=click.Path(),
    default="target",
    help="Path to directory where artifacts will be downloaded (default: 'target')",
)
@click.option(
    "--session-id",
    envvar="RECCE_SESSION_ID",
    help="Recce Cloud session ID to download artifacts from (or use RECCE_SESSION_ID env var). "
    "If not provided, session will be found automatically using platform-specific APIs (GitHub/GitLab).",
)
@click.option(
    "--prod",
    is_flag=True,
    help="Download production/base session instead of PR/MR session",
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Show what would be downloaded without actually downloading",
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="Overwrite existing files without prompting",
)
def download(target_path, session_id, prod, dry_run, force):
    """
    Download dbt artifacts (manifest.json, catalog.json) from Recce Cloud.

    \b
    Authentication (auto-detected):
    - RECCE_API_TOKEN env var or 'recce-cloud login' profile (for --session-id workflow)
    - GITHUB_TOKEN (GitHub Actions)
    - CI_JOB_TOKEN (GitLab CI)

    \b
    Common Examples:
      # Auto-find and download current PR/MR session
      recce-cloud download

      # Download project's production/base session
      recce-cloud download --prod

      # Download from specific session ID
      recce-cloud download --session-id abc123

      # Download prod session to target-base
      recce-cloud download --prod --target-path target-base

      # Force overwrite existing files
      recce-cloud download --force
    """
    console = Console()

    # Validate flag combinations
    if session_id and prod:
        console.print("[yellow]Warning:[/yellow] --prod is ignored when --session-id is provided")

    # Determine session type from --prod flag
    session_type = "prod" if prod else None

    # 1. Auto-detect CI environment information
    console.rule("CI Environment Detection", style="blue")
    try:
        ci_info = CIDetector.detect()
        ci_info = CIDetector.apply_overrides(ci_info, session_type=session_type)

        # Display detected CI information immediately
        if ci_info:
            info_table = []
            if ci_info.platform:
                info_table.append(f"[cyan]Platform:[/cyan] {ci_info.platform}")

            if ci_info.repository:
                info_table.append(f"[cyan]Repository:[/cyan] {ci_info.repository}")

            if ci_info.session_type:
                info_table.append(f"[cyan]Session Type:[/cyan] {ci_info.session_type}")

            # Only show CR number and URL for CR sessions (not for prod)
            if ci_info.session_type == "cr" and ci_info.cr_number is not None:
                if ci_info.platform == "github-actions":
                    info_table.append(f"[cyan]PR Number:[/cyan] {ci_info.cr_number}")
                elif ci_info.platform == "gitlab-ci":
                    info_table.append(f"[cyan]MR Number:[/cyan] {ci_info.cr_number}")
                else:
                    info_table.append(f"[cyan]CR Number:[/cyan] {ci_info.cr_number}")

            # Only show CR URL for CR sessions
            if ci_info.session_type == "cr" and ci_info.cr_url:
                if ci_info.platform == "github-actions":
                    info_table.append(f"[cyan]PR URL:[/cyan] {ci_info.cr_url}")
                elif ci_info.platform == "gitlab-ci":
                    info_table.append(f"[cyan]MR URL:[/cyan] {ci_info.cr_url}")
                else:
                    info_table.append(f"[cyan]CR URL:[/cyan] {ci_info.cr_url}")

            for line in info_table:
                console.print(line)
        else:
            console.print("[yellow]No CI environment detected[/yellow]")
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Failed to detect CI environment: {e}")
        console.print("Continuing without CI metadata...")
        ci_info = None

    # 2. Handle dry-run mode (before authentication or API calls)
    if dry_run:
        console.rule("Dry Run Summary", style="yellow")
        console.print("[yellow]Dry run mode enabled - no actual download will be performed[/yellow]")
        console.print()

        # Display platform information if detected
        if ci_info and ci_info.platform:
            console.print("[cyan]Platform Information:[/cyan]")
            console.print(f"  • Platform: {ci_info.platform}")
            if ci_info.repository:
                console.print(f"  • Repository: {ci_info.repository}")
            if ci_info.session_type:
                console.print(f"  • Session Type: {ci_info.session_type}")
            if ci_info.session_type == "cr" and ci_info.cr_number is not None:
                console.print(f"  • CR Number: {ci_info.cr_number}")
            console.print()

        # Display download summary
        console.print("[cyan]Download Workflow:[/cyan]")
        if session_id:
            console.print("  • Download from specific session ID")
            console.print(f"  • Session ID: {session_id}")
        else:
            if prod:
                console.print("  • Download project's production/base session")
            else:
                console.print("  • Auto-detect and download PR/MR session")

            if ci_info and ci_info.platform in ["github-actions", "gitlab-ci"]:
                console.print("  • Platform-specific APIs will be used")
            else:
                console.print("  • [yellow]Warning: Platform not supported for auto-session discovery[/yellow]")

        console.print()
        console.print("[cyan]Download destination:[/cyan]")
        console.print(f"  • Target path: {os.path.abspath(target_path)}")
        console.print("  • Files: manifest.json, catalog.json")
        if force:
            console.print("  • Will overwrite existing files")
        elif os.path.exists(target_path):
            console.print("  • [yellow]Warning: Target path exists (use --force to overwrite)[/yellow]")

        console.print()
        console.print("[green]✓[/green] Dry run completed successfully")
        sys.exit(0)

    # 3. Choose download workflow based on whether session_id is provided
    if session_id:
        # Generic workflow: Download from existing session using session ID
        # This workflow requires RECCE_API_TOKEN or logged-in profile
        from recce_cloud.auth.profile import get_api_token

        token = os.getenv("RECCE_API_TOKEN") or get_api_token()
        if not token:
            console.print("[red]Error:[/red] No RECCE_API_TOKEN provided and not logged in")
            console.print("Either set RECCE_API_TOKEN environment variable or run 'recce-cloud login' first")
            sys.exit(2)

        download_from_existing_session(console, token, session_id, target_path, force)
    else:
        # Platform-specific workflow: Use platform APIs to find session and download
        # This workflow MUST use CI job tokens (CI_JOB_TOKEN or GITHUB_TOKEN)
        if not ci_info or not ci_info.access_token:
            console.print("[red]Error:[/red] Platform-specific download requires CI environment")
            console.print("Either run in GitHub Actions/GitLab CI or provide --session-id for generic download")
            sys.exit(2)

        token = ci_info.access_token
        if ci_info.platform == "github-actions":
            console.print("[cyan]Info:[/cyan] Using GITHUB_TOKEN for platform-specific authentication")
        elif ci_info.platform == "gitlab-ci":
            console.print("[cyan]Info:[/cyan] Using CI_JOB_TOKEN for platform-specific authentication")

        download_with_platform_apis(console, token, ci_info, target_path, force)


@cloud_cli.command()
@click.option(
    "--session-id",
    envvar="RECCE_SESSION_ID",
    help="Session ID to delete. Required for non-CI workflows.",
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Show what would be deleted without actually deleting",
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="Skip confirmation prompt",
)
def delete(session_id, dry_run, force):
    """
    Delete a Recce Cloud session.

    Note: Deleting production sessions is not supported. To update production,
    upload a new session to overwrite it. Contact us if you need to delete
    a production session.

    \b
    Authentication (auto-detected):
    - RECCE_API_TOKEN env var or 'recce-cloud login' profile (for --session-id workflow)
    - GITHUB_TOKEN (GitHub Actions)
    - CI_JOB_TOKEN (GitLab CI)

    \b
    Common Examples:
      # Delete current PR/MR session (in CI)
      recce-cloud delete

      # Delete a specific session by ID
      recce-cloud delete --session-id abc123

      # Skip confirmation prompt
      recce-cloud delete --force
    """
    console = Console()

    # 1. Auto-detect CI environment information
    console.rule("CI Environment Detection", style="blue")
    try:
        ci_info = CIDetector.detect()

        # Display detected CI information immediately
        if ci_info:
            info_table = []
            if ci_info.platform:
                info_table.append(f"[cyan]Platform:[/cyan] {ci_info.platform}")

            if ci_info.repository:
                info_table.append(f"[cyan]Repository:[/cyan] {ci_info.repository}")

            # Only show session type and CR info for platform workflow
            if not session_id:
                if ci_info.session_type:
                    info_table.append(f"[cyan]Session Type:[/cyan] {ci_info.session_type}")

                # Only show CR number and URL for CR sessions (not for prod)
                if ci_info.session_type == "cr" and ci_info.cr_number is not None:
                    if ci_info.platform == "github-actions":
                        info_table.append(f"[cyan]PR Number:[/cyan] {ci_info.cr_number}")
                    elif ci_info.platform == "gitlab-ci":
                        info_table.append(f"[cyan]MR Number:[/cyan] {ci_info.cr_number}")
                    else:
                        info_table.append(f"[cyan]CR Number:[/cyan] {ci_info.cr_number}")

                # Only show CR URL for CR sessions
                if ci_info.session_type == "cr" and ci_info.cr_url:
                    if ci_info.platform == "github-actions":
                        info_table.append(f"[cyan]PR URL:[/cyan] {ci_info.cr_url}")
                    elif ci_info.platform == "gitlab-ci":
                        info_table.append(f"[cyan]MR URL:[/cyan] {ci_info.cr_url}")
                    else:
                        info_table.append(f"[cyan]CR URL:[/cyan] {ci_info.cr_url}")

            for line in info_table:
                console.print(line)
        else:
            console.print("[yellow]No CI environment detected[/yellow]")
    except Exception as e:
        console.print(f"[yellow]Warning:[/yellow] Failed to detect CI environment: {e}")
        console.print("Continuing without CI metadata...")
        ci_info = None

    # 2. Handle dry-run mode (before authentication or API calls)
    if dry_run:
        console.rule("Dry Run Summary", style="yellow")
        console.print("[yellow]Dry run mode enabled - no actual deletion will be performed[/yellow]")
        console.print()

        # Display platform information if detected
        if ci_info and ci_info.platform:
            console.print("[cyan]Platform Information:[/cyan]")
            console.print(f"  • Platform: {ci_info.platform}")
            if ci_info.repository:
                console.print(f"  • Repository: {ci_info.repository}")
            if ci_info.session_type:
                console.print(f"  • Session Type: {ci_info.session_type}")
            if ci_info.session_type == "cr" and ci_info.cr_number is not None:
                console.print(f"  • CR Number: {ci_info.cr_number}")
            console.print()

        # Display delete summary
        console.print("[cyan]Delete Workflow:[/cyan]")
        if session_id:
            console.print("  • Delete specific session by ID")
            console.print(f"  • Session ID: {session_id}")
        else:
            console.print("  • Auto-detect and delete PR/MR session")

            if ci_info and ci_info.platform in ["github-actions", "gitlab-ci"]:
                console.print("  • Platform-specific APIs will be used")
            else:
                console.print("  • [yellow]Warning: Platform not supported for auto-session discovery[/yellow]")

        console.print()
        console.print("[green]✓[/green] Dry run completed successfully")
        sys.exit(0)

    # 3. Confirmation prompt (unless --force is provided)
    if not force:
        console.print()
        if session_id:
            confirm_msg = f'Are you sure you want to delete session "{session_id}"?'
        else:
            confirm_msg = "Are you sure you want to delete the PR/MR session?"

        if not click.confirm(confirm_msg):
            console.print("[yellow]Aborted[/yellow]")
            sys.exit(0)

    # 4. Choose delete workflow based on whether session_id is provided
    if session_id:
        # Generic workflow: Delete from existing session using session ID
        # This workflow requires RECCE_API_TOKEN or logged-in profile
        from recce_cloud.auth.profile import get_api_token

        token = os.getenv("RECCE_API_TOKEN") or get_api_token()
        if not token:
            console.print("[red]Error:[/red] No RECCE_API_TOKEN provided and not logged in")
            console.print("Either set RECCE_API_TOKEN environment variable or run 'recce-cloud login' first")
            sys.exit(2)

        delete_existing_session(console, token, session_id)
    else:
        # Platform-specific workflow: Use platform APIs to find and delete session
        # This workflow MUST use CI job tokens (CI_JOB_TOKEN or GITHUB_TOKEN)
        if not ci_info or not ci_info.access_token:
            console.print("[red]Error:[/red] Platform-specific delete requires CI environment")
            console.print("Either run in GitHub Actions/GitLab CI or provide --session-id for generic delete")
            sys.exit(2)

        token = ci_info.access_token
        if ci_info.platform == "github-actions":
            console.print("[cyan]Info:[/cyan] Using GITHUB_TOKEN for platform-specific authentication")
        elif ci_info.platform == "gitlab-ci":
            console.print("[cyan]Info:[/cyan] Using CI_JOB_TOKEN for platform-specific authentication")

        delete_with_platform_apis(console, token, ci_info, prod=False)


@cloud_cli.command()
@click.option(
    "--repo",
    type=str,
    help="Repository full name (owner/repo). Auto-detected from git remote if not provided.",
)
@click.option(
    "--since",
    type=str,
    default="30d",
    help="Start date (ISO format 2024-11-01 or relative like 30d). Default: 30d",
)
@click.option(
    "--until",
    type=str,
    default=None,
    help="End date (ISO format or relative). Default: today",
)
@click.option(
    "--base-branch",
    type=str,
    default="main",
    help="Target branch filter. Default: main",
)
@click.option(
    "--merged-only/--include-open",
    default=True,
    help="Only include merged CRs (default) or include open CRs too",
)
@click.option(
    "-o",
    "--output",
    type=click.Path(),
    default=None,
    help="Output file path for CSV report",
)
def report(repo, since, until, base_branch, merged_only, output):
    """
    Generate PR (Pull Request) metrics report.

    Tracks commit counts before/after PR open, time to merge, and Recce session data.
    Useful for measuring Recce's effectiveness in catching issues before merge.

    By default, displays a summary to the console. Use -o to save as CSV file.

    \b
    Authentication:
    - Requires RECCE_API_TOKEN env var or 'recce-cloud login' profile

    \b
    Examples:
      # Last 30 days for current repo (auto-detected)
      recce-cloud report

      # Last 60 days, save to CSV file
      recce-cloud report --since 60d -o report.csv

      # Specific date range
      recce-cloud report --since 2024-11-01 --until 2024-12-15

      # Different repo and branch
      recce-cloud report --repo super/analytics --base-branch develop

      # Include open PRs (not just merged)
      recce-cloud report --include-open
    """
    console = Console()

    # Check for API token (env var or logged-in profile)
    from recce_cloud.auth.profile import get_api_token

    token = os.getenv("RECCE_API_TOKEN") or get_api_token()
    if not token:
        console.print("[red]Error:[/red] No RECCE_API_TOKEN provided and not logged in")
        console.print("Either set RECCE_API_TOKEN environment variable or run 'recce-cloud login' first")
        sys.exit(2)

    # Auto-detect repo from git remote if not provided
    if not repo:
        try:
            result = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
            remote_url = result.stdout.strip()

            # Parse repo from various URL formats
            # SSH: git@gitlab.com:owner/repo.git
            # HTTPS: https://gitlab.com/owner/repo.git
            if remote_url.startswith("git@"):
                # git@gitlab.com:owner/repo.git -> owner/repo
                repo = remote_url.split(":")[-1].replace(".git", "")
            elif "://" in remote_url:
                # https://gitlab.com/owner/repo.git -> owner/repo
                path = remote_url.split("://")[-1].split("/", 1)[-1]
                repo = path.replace(".git", "")

            if repo:
                console.print(f"[cyan]Auto-detected repository:[/cyan] {repo}")
        except FileNotFoundError:
            # git executable not found
            logger.debug("git not found while auto-detecting repository")
        except Exception as e:
            # Unexpected failure during git remote parsing
            logger.debug("Failed to auto-detect repository from git remote: %s", e)

    if not repo:
        console.print("[red]Error:[/red] Could not detect repository. Please provide --repo option.")
        sys.exit(1)

    # Generate report
    exit_code = fetch_and_generate_report(
        console=console,
        token=token,
        repo=repo,
        since=since,
        until=until,
        base_branch=base_branch,
        merged_only=merged_only,
        output_path=output,
    )

    sys.exit(exit_code)


if __name__ == "__main__":
    cloud_cli()
