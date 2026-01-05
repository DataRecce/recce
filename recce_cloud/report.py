"""
Report generation module for Recce Cloud CLI.

Handles fetching PR metrics reports from Recce Cloud API and formatting as CSV.
"""

import csv
import io
import json
import logging
import os
import sys
from dataclasses import dataclass
from typing import List, Optional

import requests
from rich.console import Console

from recce_cloud.api.exceptions import RecceCloudException

logger = logging.getLogger("recce")

RECCE_CLOUD_API_HOST = os.environ.get("RECCE_CLOUD_API_HOST", "https://cloud.datarecce.io")


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


class ReportClient:
    """Client for fetching reports from Recce Cloud API."""

    def __init__(self, token: str):
        if token is None:
            raise ValueError("Token cannot be None.")
        self.token = token
        self.base_url_v2 = f"{RECCE_CLOUD_API_HOST}/api/v2"

    def _request(self, method: str, url: str, headers: dict = None, **kwargs):
        """
        Make authenticated HTTP request to Recce Cloud API.

        Raises:
            RecceCloudException: If network error occurs
        """
        headers = {
            **(headers or {}),
            "Authorization": f"Bearer {self.token}",
        }
        try:
            return requests.request(method, url, headers=headers, timeout=60, **kwargs)
        except requests.exceptions.Timeout as e:
            logger.error(f"Request timeout: {e}")
            raise RecceCloudException(
                reason="Request timed out. Please try again.",
                status_code=0,
            )
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error: {e}")
            raise RecceCloudException(
                reason="Failed to connect to Recce Cloud API. Please check your network connection.",
                status_code=0,
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            raise RecceCloudException(
                reason=f"Network error: {str(e)}",
                status_code=0,
            )

    def get_pr_metrics(
        self,
        repo: str,
        since: str = "30d",
        until: Optional[str] = None,
        base_branch: str = "main",
        merged_only: bool = True,
    ) -> PRMetricsReport:
        """
        Fetch PR metrics report from Recce Cloud API.

        Args:
            repo: Repository full name (owner/repo)
            since: Start date (ISO format or relative like 30d)
            until: End date (ISO format or relative). Defaults to today.
            base_branch: Target branch filter
            merged_only: Only include merged PRs

        Returns:
            PRMetricsReport containing all metrics

        Raises:
            RecceCloudException: If the request fails
        """
        api_url = f"{self.base_url_v2}/reports/pr-metrics"

        params = {
            "repo": repo,
            "since": since,
            "base_branch": base_branch,
            "merged_only": str(merged_only).lower(),
        }
        if until:
            params["until"] = until

        response = self._request("GET", api_url, params=params)

        if response.status_code == 401:
            raise RecceCloudException(
                reason="Invalid or missing API token",
                status_code=401,
            )
        if response.status_code == 404:
            raise RecceCloudException(
                reason=f"Repository not found: {repo}",
                status_code=404,
            )
        if response.status_code == 400:
            try:
                error_detail = response.json().get("detail", "Bad request")
            except json.JSONDecodeError:
                error_detail = "Bad request"
            raise RecceCloudException(
                reason=error_detail,
                status_code=400,
            )
        if response.status_code == 502:
            try:
                error_detail = response.json().get("detail", "Upstream API error")
            except json.JSONDecodeError:
                error_detail = "Upstream API error"
            raise RecceCloudException(
                reason=error_detail,
                status_code=502,
            )
        if response.status_code != 200:
            raise RecceCloudException(
                reason=response.text,
                status_code=response.status_code,
            )

        try:
            data = response.json()
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse API response: {e}")
            raise RecceCloudException(
                reason="Invalid response from API",
                status_code=response.status_code,
            )

        # Parse pull requests
        pull_requests = []
        for pr in data.get("pull_requests", []):
            pull_requests.append(
                PRMetrics(
                    pr_number=pr.get("pr_number", 0),
                    pr_title=pr.get("pr_title", ""),
                    pr_state=pr.get("pr_state", "unknown"),
                    pr_url=pr.get("pr_url", ""),
                    pr_author=pr.get("pr_author"),
                    pr_created_at=pr.get("pr_created_at"),
                    pr_merged_at=pr.get("pr_merged_at"),
                    time_to_merge=pr.get("time_to_merge"),
                    commits_before_pr_open=pr.get("commits_before_pr_open", 0),
                    commits_after_pr_open=pr.get("commits_after_pr_open", 0),
                    commits_after_summary=pr.get("commits_after_summary"),
                    has_recce_session=pr.get("has_recce_session", False),
                    recce_session_url=pr.get("recce_session_url"),
                    recce_checks_count=pr.get("recce_checks_count"),
                    recce_check_types=pr.get("recce_check_types"),
                    recce_summary_generated=pr.get("recce_summary_generated"),
                    recce_summary_at=pr.get("recce_summary_at"),
                )
            )

        # Parse summary statistics
        summary_data = data.get("summary", {})
        summary = SummaryStatistics(
            total_prs=summary_data.get("total_prs", len(pull_requests)),
            prs_merged=summary_data.get("prs_merged", 0),
            prs_open=summary_data.get("prs_open", 0),
            prs_with_recce_session=summary_data.get("prs_with_recce_session", 0),
            prs_with_recce_summary=summary_data.get("prs_with_recce_summary", 0),
            recce_adoption_rate=summary_data.get("recce_adoption_rate", 0.0),
            summary_generation_rate=summary_data.get("summary_generation_rate", 0.0),
            total_commits_before_pr_open=summary_data.get("total_commits_before_pr_open", 0),
            total_commits_after_pr_open=summary_data.get("total_commits_after_pr_open", 0),
            total_commits_after_summary=summary_data.get("total_commits_after_summary", 0),
            avg_commits_before_pr_open=summary_data.get("avg_commits_before_pr_open", 0.0),
            avg_commits_after_pr_open=summary_data.get("avg_commits_after_pr_open", 0.0),
            avg_commits_after_summary=summary_data.get("avg_commits_after_summary"),
            avg_time_to_merge=summary_data.get("avg_time_to_merge"),
        )

        date_range = data.get("date_range", {})
        return PRMetricsReport(
            success=data.get("success", True),
            repo=data.get("repo", repo),
            date_range_since=date_range.get("since", ""),
            date_range_until=date_range.get("until", ""),
            summary=summary,
            pull_requests=pull_requests,
        )


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
        f"  PRs with Recce sessions:    {summary.prs_with_recce_session}/{summary.total_prs} "
        f"([green]{summary.recce_adoption_rate}%[/green])"
    )
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
    if summary.avg_commits_after_summary is not None:
        console.print(
            f"  Commits after summary:      {summary.total_commits_after_summary} total, "
            f"{summary.avg_commits_after_summary:.1f} avg/PR"
        )
    else:
        console.print("  Commits after summary:      N/A (no summaries generated)")

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

            # Commits after summary (key metric)
            after_sum_display = ""
            if pr.commits_after_summary is not None:
                if pr.commits_after_summary > 0:
                    after_sum_display = f" [yellow]({pr.commits_after_summary} commits after summary)[/yellow]"
                else:
                    after_sum_display = " [green](0 commits after summary)[/green]"

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
            console.print(f"      Recce: session {session_icon}  summary {summary_icon}{after_sum_display}")
            if pr.recce_session_url:
                console.print(f"      [dim]{pr.recce_session_url}[/dim]")
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
    show_csv: bool = False,
) -> int:
    """
    Fetch PR metrics and generate CSV report.

    Args:
        console: Rich console for output
        token: RECCE_API_TOKEN
        repo: Repository full name (owner/repo)
        since: Start date
        until: End date
        base_branch: Target branch filter
        merged_only: Only merged PRs
        output_path: Output file path for CSV (None for no file output)
        show_csv: If True, output CSV to stdout instead of summary

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

    # Generate CSV content (always needed for file output or --csv flag)
    csv_content = format_report_as_csv(report)

    if show_csv:
        # Output CSV to stdout only (no summary)
        sys.stdout.write(csv_content)
    else:
        # Display summary (default behavior)
        display_report_summary(console, report)

    # Write to file if output path is provided
    if output_path:
        try:
            with open(output_path, "w") as f:
                f.write(csv_content)
            console.print()
            console.print(f"[green]✓[/green] Report saved to: {output_path}")
        except Exception as e:
            console.print(f"[red]Error:[/red] Failed to write file: {e}")
            return 1

    return 0
