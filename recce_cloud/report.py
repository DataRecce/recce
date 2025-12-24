"""
Report generation module for Recce Cloud CLI.

Handles fetching CR metrics reports from Recce Cloud API and formatting as CSV.
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
class CRMetrics:
    """Metrics for a single change request."""

    cr_number: int
    cr_title: str
    cr_state: str
    cr_url: str
    cr_author: Optional[str]
    cr_created_at: Optional[str]
    cr_merged_at: Optional[str]
    commits_before_cr_open: int
    commits_after_cr_open: int
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

    total_crs: int
    crs_merged: int
    crs_open: int
    crs_with_recce_session: int
    crs_with_recce_summary: int
    recce_adoption_rate: float
    summary_generation_rate: float
    total_commits_before_cr_open: int
    total_commits_after_cr_open: int
    total_commits_after_summary: int
    avg_commits_before_cr_open: float
    avg_commits_after_cr_open: float
    avg_commits_after_summary: Optional[float]


@dataclass
class CRMetricsReport:
    """Full CR metrics report."""

    success: bool
    repo: str
    date_range_since: str
    date_range_until: str
    summary: SummaryStatistics
    change_requests: List[CRMetrics]


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

    def get_cr_metrics(
        self,
        repo: str,
        since: str = "30d",
        until: Optional[str] = None,
        base_branch: str = "main",
        merged_only: bool = True,
    ) -> CRMetricsReport:
        """
        Fetch CR metrics report from Recce Cloud API.

        Args:
            repo: Repository full name (owner/repo)
            since: Start date (ISO format or relative like 30d)
            until: End date (ISO format or relative). Defaults to today.
            base_branch: Target branch filter
            merged_only: Only include merged CRs

        Returns:
            CRMetricsReport containing all metrics

        Raises:
            RecceCloudException: If the request fails
        """
        api_url = f"{self.base_url_v2}/reports/cr-metrics"

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
                error_detail = response.json().get("detail", "GitLab API error")
            except json.JSONDecodeError:
                error_detail = "GitLab API error"
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

        # Parse change requests
        change_requests = []
        for cr in data.get("change_requests", []):
            change_requests.append(
                CRMetrics(
                    cr_number=cr["cr_number"],
                    cr_title=cr.get("cr_title", ""),
                    cr_state=cr.get("cr_state", "unknown"),
                    cr_url=cr.get("cr_url", ""),
                    cr_author=cr.get("cr_author"),
                    cr_created_at=cr.get("cr_created_at"),
                    cr_merged_at=cr.get("cr_merged_at"),
                    commits_before_cr_open=cr.get("commits_before_cr_open", 0),
                    commits_after_cr_open=cr.get("commits_after_cr_open", 0),
                    commits_after_summary=cr.get("commits_after_summary"),
                    has_recce_session=cr.get("has_recce_session", False),
                    recce_session_url=cr.get("recce_session_url"),
                    recce_checks_count=cr.get("recce_checks_count"),
                    recce_check_types=cr.get("recce_check_types"),
                    recce_summary_generated=cr.get("recce_summary_generated"),
                    recce_summary_at=cr.get("recce_summary_at"),
                )
            )

        # Parse summary statistics
        summary_data = data.get("summary", {})
        summary = SummaryStatistics(
            total_crs=summary_data.get("total_crs", len(change_requests)),
            crs_merged=summary_data.get("crs_merged", 0),
            crs_open=summary_data.get("crs_open", 0),
            crs_with_recce_session=summary_data.get("crs_with_recce_session", 0),
            crs_with_recce_summary=summary_data.get("crs_with_recce_summary", 0),
            recce_adoption_rate=summary_data.get("recce_adoption_rate", 0.0),
            summary_generation_rate=summary_data.get("summary_generation_rate", 0.0),
            total_commits_before_cr_open=summary_data.get("total_commits_before_cr_open", 0),
            total_commits_after_cr_open=summary_data.get("total_commits_after_cr_open", 0),
            total_commits_after_summary=summary_data.get("total_commits_after_summary", 0),
            avg_commits_before_cr_open=summary_data.get("avg_commits_before_cr_open", 0.0),
            avg_commits_after_cr_open=summary_data.get("avg_commits_after_cr_open", 0.0),
            avg_commits_after_summary=summary_data.get("avg_commits_after_summary"),
        )

        date_range = data.get("date_range", {})
        return CRMetricsReport(
            success=data.get("success", True),
            repo=data.get("repo", repo),
            date_range_since=date_range.get("since", ""),
            date_range_until=date_range.get("until", ""),
            summary=summary,
            change_requests=change_requests,
        )


def format_report_as_csv(report: CRMetricsReport) -> str:
    """
    Convert CR metrics report to CSV format.

    Args:
        report: CRMetricsReport to convert

    Returns:
        CSV formatted string
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row - enhanced with new fields
    writer.writerow(
        [
            "cr_number",
            "cr_title",
            "cr_state",
            "cr_url",
            "cr_author",
            "cr_created_at",
            "cr_merged_at",
            "commits_before_cr_open",
            "commits_after_cr_open",
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
    for cr in report.change_requests:
        check_types = ";".join(cr.recce_check_types) if cr.recce_check_types else ""
        writer.writerow(
            [
                cr.cr_number,
                cr.cr_title,
                cr.cr_state,
                cr.cr_url,
                cr.cr_author or "",
                cr.cr_created_at or "",
                cr.cr_merged_at or "",
                cr.commits_before_cr_open,
                cr.commits_after_cr_open,
                cr.commits_after_summary if cr.commits_after_summary is not None else "",
                cr.has_recce_session,
                cr.recce_session_url or "",
                cr.recce_checks_count if cr.recce_checks_count is not None else "",
                check_types,
                cr.recce_summary_generated if cr.recce_summary_generated is not None else "",
                cr.recce_summary_at or "",
            ]
        )

    return output.getvalue()


def display_report_summary(console: Console, report: CRMetricsReport):
    """
    Display a summary of the report to console.

    Args:
        console: Rich console for output
        report: CRMetricsReport to summarize
    """
    console.print()
    console.print(f"[bold]Repository:[/bold] {report.repo}")
    console.print(f"[bold]Date Range:[/bold] {report.date_range_since} to {report.date_range_until}")

    if not report.change_requests:
        console.print("[yellow]No change requests found in the specified date range.[/yellow]")
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
    console.print(f"  Total CRs:     {summary.total_crs}")
    console.print(f"  Merged:        {summary.crs_merged}")
    console.print(f"  Open:          {summary.crs_open}")
    console.print()

    # Recce Adoption section
    console.print("[bold white]Recce Adoption[/bold white]")
    console.print(
        f"  CRs with Recce sessions:    {summary.crs_with_recce_session}/{summary.total_crs} "
        f"([green]{summary.recce_adoption_rate}%[/green])"
    )
    console.print(
        f"  CRs with Recce summary:     {summary.crs_with_recce_summary}/{summary.total_crs} "
        f"([green]{summary.summary_generation_rate}%[/green])"
    )
    console.print()

    # Commit Analysis section
    console.print("[bold white]Commit Analysis[/bold white]")
    console.print(
        f"  Commits before CR open:     {summary.total_commits_before_cr_open} total, "
        f"{summary.avg_commits_before_cr_open:.1f} avg/CR"
    )
    console.print(
        f"  Commits after CR open:      {summary.total_commits_after_cr_open} total, "
        f"{summary.avg_commits_after_cr_open:.1f} avg/CR"
    )
    if summary.avg_commits_after_summary is not None:
        console.print(
            f"  Commits after summary:      {summary.total_commits_after_summary} total, "
            f"{summary.avg_commits_after_summary:.1f} avg/CR"
        )
    else:
        console.print("  Commits after summary:      N/A (no summaries generated)")

    console.print()
    console.print("[bold cyan]═══════════════════════════════════════════════════════════[/bold cyan]")
    console.print()

    # Display CRs in a readable list format
    if len(report.change_requests) > 0:
        console.print(f"[bold white]Change Requests ({len(report.change_requests)} total)[/bold white]")
        console.print()

        for cr in report.change_requests[:10]:
            # State with color
            state = cr.cr_state
            if state == "merged":
                state_display = "[green]merged[/green]"
            elif state == "opened":
                state_display = "[yellow]opened[/yellow]"
            elif state == "closed":
                state_display = "[red]closed[/red]"
            else:
                state_display = f"[dim]{state}[/dim]"

            # Session and summary indicators
            session_icon = "[green]✓[/green]" if cr.has_recce_session else "[dim]✗[/dim]"
            summary_icon = (
                "[green]✓[/green]"
                if cr.recce_summary_generated
                else ("[dim]✗[/dim]" if cr.recce_summary_generated is False else "[dim]-[/dim]")
            )

            # Commits after summary (key metric)
            after_sum_display = ""
            if cr.commits_after_summary is not None:
                if cr.commits_after_summary > 0:
                    after_sum_display = f" [yellow]({cr.commits_after_summary} commits after summary)[/yellow]"
                else:
                    after_sum_display = " [green](0 commits after summary)[/green]"

            # Print CR info
            console.print(f"  [cyan]!{cr.cr_number}[/cyan] {cr.cr_title}")
            console.print(
                f"      {state_display} by {cr.cr_author or 'unknown'} | "
                f"Commits: {cr.commits_before_cr_open} before, {cr.commits_after_cr_open} after CR open"
            )
            console.print(f"      Recce: session {session_icon}  summary {summary_icon}{after_sum_display}")
            if cr.recce_session_url:
                console.print(f"      [dim]{cr.recce_session_url}[/dim]")
            console.print()

        # Indicate truncation if more CRs exist
        if len(report.change_requests) > 10:
            console.print(
                f"[dim]... and {len(report.change_requests) - 10} more "
                f"(showing 10 of {len(report.change_requests)} total)[/dim]"
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
    Fetch CR metrics and generate CSV report.

    Args:
        console: Rich console for output
        token: RECCE_API_TOKEN
        repo: Repository full name (owner/repo)
        since: Start date
        until: End date
        base_branch: Target branch filter
        merged_only: Only merged CRs
        output_path: Output file path (None for stdout)

    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    console.rule("Fetching CR Metrics Report", style="blue")

    try:
        client = ReportClient(token)
        report = client.get_cr_metrics(
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

    # Generate CSV
    csv_content = format_report_as_csv(report)

    if output_path:
        # Write to file
        try:
            with open(output_path, "w") as f:
                f.write(csv_content)
            console.print()
            console.print(f"[green]✓[/green] Report saved to: {output_path}")
        except Exception as e:
            console.print(f"[red]Error:[/red] Failed to write file: {e}")
            return 1
    else:
        # Write to stdout
        console.print()
        console.rule("CSV Output", style="green")
        sys.stdout.write(csv_content)

    return 0
