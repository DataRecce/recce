"""
Diagnostics CLI commands.

This module contains CLI presentation logic for diagnostic commands,
delegating business logic to the diagnostic service.
"""

import json
import sys

import click
from rich.console import Console
from rich.panel import Panel

from recce_cloud.services.diagnostic_service import (
    CheckStatus,
    DiagnosticResults,
    DiagnosticService,
)


class DiagnosticRenderer:
    """Renders diagnostic results to the console."""

    def __init__(self, console: Console):
        self.console = console

    def render_header(self) -> None:
        """Render the diagnostic header."""
        header = Panel(
            "[bold]🩺 Recce Doctor[/bold]\n[dim]Checking your Recce Cloud setup...[/dim]",
            expand=False,
            padding=(0, 3),
        )
        self.console.print()
        self.console.print(header)
        self.console.print()
        self.console.print("━" * 65)
        self.console.print()

    def render_login_check(self, results: DiagnosticResults) -> None:
        """Render the login status check."""
        self.console.print("[bold]1. Login Status[/bold] ($ recce-cloud login)")
        check = results.login

        if check.passed:
            email = check.details.get("email", "Unknown")
            self.console.print(f"[green]✓[/green] Logged in as [cyan]{email}[/cyan]")
        else:
            self._render_failure(check)

        self.console.print()

    def render_project_binding_check(self, results: DiagnosticResults) -> None:
        """Render the project binding check."""
        self.console.print("[bold]2. Project Binding[/bold] ($ recce-cloud init)")
        check = results.project_binding

        if check.passed:
            org = check.details.get("org")
            project = check.details.get("project")
            source = check.details.get("source")
            source_label = " (via env vars)" if source == "env_vars" else ""
            self.console.print(f"[green]✓[/green] Bound to [cyan]{org}/{project}[/cyan]{source_label}")
        else:
            self._render_failure(check)

        self.console.print()

    def render_production_check(self, results: DiagnosticResults) -> None:
        """Render the production metadata check."""
        self.console.print("[bold]3. Production Metadata[/bold]")
        check = results.production_metadata

        if check.status == CheckStatus.SKIP:
            self.console.print(f"[yellow]⚠[/yellow] {check.message}")
        elif check.passed:
            session_name = check.details.get("session_name", "(unnamed)")
            relative_time = check.details.get("relative_time")
            time_str = f" (uploaded {relative_time})" if relative_time else ""
            self.console.print(f'[green]✓[/green] Found production session "[cyan]{session_name}[/cyan]"{time_str}')
        else:
            self._render_failure(check)

        self.console.print()

    def render_dev_session_check(self, results: DiagnosticResults) -> None:
        """Render the dev session check."""
        self.console.print("[bold]4. Dev Session[/bold]")
        check = results.dev_session

        if check.status == CheckStatus.SKIP:
            self.console.print(f"[yellow]⚠[/yellow] {check.message}")
        elif check.passed:
            session_name = check.details.get("session_name", "(unnamed)")
            relative_time = check.details.get("relative_time")
            time_str = f" (uploaded {relative_time})" if relative_time else ""
            self.console.print(f'[green]✓[/green] Found dev session "[cyan]{session_name}[/cyan]"{time_str}')
        else:
            self._render_failure(check)

    def render_summary(self, results: DiagnosticResults) -> None:
        """Render the summary section."""
        self.console.print()
        self.console.print("━" * 65)
        self.console.print()

        if results.all_passed:
            self.console.print("[green]✓ All checks passed![/green] Your Recce setup is ready.")
            self.console.print()
            self.console.print("Next step:")
            self.console.print("  $ recce-cloud review --session-name <session_name>")
        else:
            self.console.print(
                f"[yellow]⚠ {results.passed_count}/{results.total_count} checks passed.[/yellow] "
                "See above for remediation steps."
            )

    def render_all(self, results: DiagnosticResults) -> None:
        """Render all diagnostic results."""
        self.render_header()
        self.render_login_check(results)
        self.render_project_binding_check(results)
        self.render_production_check(results)
        self.render_dev_session_check(results)
        self.render_summary(results)

    def _render_failure(self, check) -> None:
        """Render a failed check with its suggestion."""
        self.console.print(f"[red]✗[/red] {check.message}")
        if check.suggestion:
            self.console.print()
            self.console.print("[dim]→ To fix:[/dim]")
            for line in check.suggestion.split("\n"):
                self.console.print(f"  {line}")


@click.command()
@click.option(
    "--json",
    "output_json",
    is_flag=True,
    help="Output in JSON format for scripting",
)
def doctor(output_json: bool) -> None:
    """
    Check Recce Cloud setup and configuration.

    Validates login status, project binding, and session availability.
    Provides actionable suggestions when issues are found.

    \b
    Examples:
      # Check setup status
      recce-cloud doctor

      # Machine-readable output
      recce-cloud doctor --json
    """
    console = Console()

    # Run diagnostic checks
    service = DiagnosticService()
    results = service.run_all_checks()

    # Output results
    if output_json:
        console.print(json.dumps(results.to_dict(), indent=2, default=str))
    else:
        renderer = DiagnosticRenderer(console)
        renderer.render_all(results)

    # Exit with appropriate code
    sys.exit(0 if results.all_passed else 1)
