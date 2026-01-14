"""
Report generation module for Recce Cloud CLI.

Handles fetching PR metrics reports from Recce Cloud API and formatting as CSV.
"""

import csv
import io
from dataclasses import dataclass
from typing import List, Optional

from rich.console import Console

from recce_cloud.api.client import ReportClient
from recce_cloud.api.exceptions import RecceCloudException


@dataclass
class PRMetrics:
    """Metrics for a single pull request."""

    pr_number: int
    pr_title: str
    pr_state: str
    pr_url: str
    pr_author: Optional[str]
    pr_created_at: Optional[str]
    pr_merged_at: Optional[str]
    time_to_merge: Optional[float]
    commits_before_pr_open: int
    commits_after_pr_open: int
    commits_after_summary: Optional[int]
    commits_fetch_failed: bool
    has_recce_session: bool
    recce_session_url: Optional[str]
    recce_checks_count: Optional[int]
    recce_check_types: Optional[List[str]]
    recce_summary_generated: Optional[bool]
    recce_summary_at: Optional[str]


@dataclass
class SummaryStatistics:
    """Aggregated statistics for the report."""

    total_prs: int
    prs_merged: int
    prs_open: int
    prs_with_recce_session: int
    prs_with_recce_summary: int
    recce_adoption_rate: float
    summary_generation_rate: float
    total_commits_before_pr_open: int
    total_commits_after_pr_open: int
    total_commits_after_summary: int
    avg_commits_before_pr_open: float
    avg_commits_after_pr_open: float
    avg_commits_after_summary: Optional[float]
    avg_time_to_merge: Optional[float]


@dataclass
class PRMetricsReport:
    """Full PR metrics report."""

    success: bool
    repo: str
    date_range_since: str
    date_range_until: str
    summary: SummaryStatistics
    pull_requests: List[PRMetrics]


def format_report_as_csv(report: PRMetricsReport) -> str:
    """
    Convert PR metrics report to CSV format.

    Args:
        report: PRMetricsReport to convert

    Returns:
        CSV formatted string
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row - enhanced with new fields
    writer.writerow(
        [
            "pr_number",
            "pr_title",
            "pr_state",
            "pr_url",
            "pr_author",
            "pr_created_at",
            "pr_merged_at",
            "time_to_merge",
            "commits_before_pr_open",
            "commits_after_pr_open",
            "commits_after_summary",
            "commits_fetch_failed",
            "has_recce_session",
            "recce_session_url",
            "recce_checks_count",
            "recce_check_types",
            "recce_summary_generated",
            "recce_summary_at",
        ]
    )

    # Data rows
    for pr in report.pull_requests:
        check_types = ";".join(pr.recce_check_types) if pr.recce_check_types else ""
        writer.writerow(
            [
                pr.pr_number,
                pr.pr_title,
                pr.pr_state,
                pr.pr_url,
                pr.pr_author or "",
                pr.pr_created_at or "",
                pr.pr_merged_at or "",
                pr.time_to_merge if pr.time_to_merge is not None else "",
                pr.commits_before_pr_open,
                pr.commits_after_pr_open,
                pr.commits_after_summary if pr.commits_after_summary is not None else "",
                pr.commits_fetch_failed,
                pr.has_recce_session,
                pr.recce_session_url or "",
                pr.recce_checks_count if pr.recce_checks_count is not None else "",
                check_types,
                pr.recce_summary_generated if pr.recce_summary_generated is not None else "",
                pr.recce_summary_at or "",
            ]
        )

    return output.getvalue()


def display_report_summary(console: Console, report: PRMetricsReport):
    """
    Display a summary of the report to console.

    Args:
        console: Rich console for output
        report: PRMetricsReport to summarize
    """
    console.print()
    console.print(f"[bold]Repository:[/bold] {report.repo}")
    console.print(f"[bold]Date Range:[/bold] {report.date_range_since} to {report.date_range_until}")

    if not report.pull_requests:
        console.print("[yellow]No pull requests found in the specified date range.[/yellow]")
        return

    # Use API-provided summary statistics
    summary = report.summary

    console.print()
    console.print("[bold cyan]═══════════════════════════════════════════════════════════[/bold cyan]")
    console.print("[bold cyan]                    SUMMARY STATISTICS                      [/bold cyan]")
    console.print("[bold cyan]═══════════════════════════════════════════════════════════[/bold cyan]")
    console.print()

    # Overview section
    console.print("[bold white]Overview[/bold white]")
    console.print(f"  Total PRs:     {summary.total_prs}")
    console.print(f"  Merged:        {summary.prs_merged}")
    console.print(f"  Open:          {summary.prs_open}")
    if summary.avg_time_to_merge is not None:
        console.print(f"  Avg Time to Merge: {summary.avg_time_to_merge:.1f} hours")
    console.print()

    # Recce Adoption section
    console.print("[bold white]Recce Adoption[/bold white]")
    console.print(
        f"  PRs with Recce summary:     {summary.prs_with_recce_summary}/{summary.total_prs} "
        f"([green]{summary.summary_generation_rate}%[/green])"
    )
    console.print()

    # Commit Analysis section
    console.print("[bold white]Commit Analysis[/bold white]")
    console.print(
        f"  Commits before PR open:     {summary.total_commits_before_pr_open} total, "
        f"{summary.avg_commits_before_pr_open:.1f} avg/PR"
    )
    console.print(
        f"  Commits after PR open:      {summary.total_commits_after_pr_open} total, "
        f"{summary.avg_commits_after_pr_open:.1f} avg/PR"
    )

    console.print()
    console.print("[bold cyan]═══════════════════════════════════════════════════════════[/bold cyan]")
    console.print()

    # Display PRs in a readable list format
    if len(report.pull_requests) > 0:
        console.print(f"[bold white]Pull Requests ({len(report.pull_requests)} total)[/bold white]")
        console.print()

        for pr in report.pull_requests[:10]:
            # State with color
            state = pr.pr_state
            if state == "merged":
                state_display = "[green]merged[/green]"
            elif state == "opened":
                state_display = "[yellow]opened[/yellow]"
            elif state == "closed":
                state_display = "[red]closed[/red]"
            else:
                state_display = f"[dim]{state}[/dim]"

            # Session and summary indicators
            session_icon = "[green]✓[/green]" if pr.has_recce_session else "[dim]✗[/dim]"
            summary_icon = (
                "[green]✓[/green]"
                if pr.recce_summary_generated
                else ("[dim]✗[/dim]" if pr.recce_summary_generated is False else "[dim]-[/dim]")
            )

            # Time to merge display
            time_display = ""
            if pr.time_to_merge is not None:
                time_display = f" | Merged in {pr.time_to_merge:.1f}h"

            # Print PR info
            console.print(f"  [cyan]!{pr.pr_number}[/cyan] {pr.pr_title}")
            console.print(
                f"      {state_display} by {pr.pr_author or 'unknown'}{time_display} | "
                f"Commits: {pr.commits_before_pr_open} before, {pr.commits_after_pr_open} after PR open"
            )
            console.print(f"      Recce: session {session_icon}  summary {summary_icon}")
            if pr.pr_url:
                console.print(f"      [dim]{pr.pr_url}[/dim]")
            console.print()

        # Indicate truncation if more PRs exist
        if len(report.pull_requests) > 10:
            console.print(
                f"[dim]... and {len(report.pull_requests) - 10} more "
                f"(showing 10 of {len(report.pull_requests)} total)[/dim]"
            )
            console.print()


def fetch_and_generate_report(
    console: Console,
    token: str,
    repo: str,
    since: str,
    until: Optional[str],
    base_branch: str,
    merged_only: bool,
    output_path: Optional[str],
) -> int:
    """
    Fetch PR metrics and generate report.

    Args:
        console: Rich console for output
        token: RECCE_API_TOKEN
        repo: Repository full name (owner/repo)
        since: Start date
        until: End date
        base_branch: Target branch filter
        merged_only: Only merged PRs
        output_path: Output file path for CSV (None for summary display only)

    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    console.rule("Fetching PR Metrics Report", style="blue")

    try:
        client = ReportClient(token)
        report = client.get_pr_metrics(
            repo=repo,
            since=since,
            until=until,
            base_branch=base_branch,
            merged_only=merged_only,
        )
    except RecceCloudException as e:
        console.print(f"[red]Error:[/red] {e.reason}")
        return 1
    except Exception as e:
        console.print(f"[red]Error:[/red] Failed to fetch report: {e}")
        return 1

    # Display summary
    display_report_summary(console, report)

    # Write CSV to file if output path is provided
    if output_path:
        try:
            csv_content = format_report_as_csv(report)
            with open(output_path, "w") as f:
                f.write(csv_content)
            console.print()
            console.print(f"[green]✓[/green] Report saved to: {output_path}")
        except Exception as e:
            console.print(f"[red]Error:[/red] Failed to write file: {e}")
            return 1

    return 0
