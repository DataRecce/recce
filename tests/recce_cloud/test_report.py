"""
Unit and integration tests for recce-cloud report command.

Tests cover:
- ReportClient class with mocked API responses
- format_report_as_csv() function
- display_report_summary() function
- CLI report command integration tests
"""

import json
import os
import tempfile
import unittest
from io import StringIO
from unittest.mock import MagicMock, Mock, patch

from click.testing import CliRunner
from rich.console import Console

from recce_cloud.api.exceptions import RecceCloudException
from recce_cloud.cli import cloud_cli
from recce_cloud.report import (
    CRMetrics,
    CRMetricsReport,
    ReportClient,
    SummaryStatistics,
    display_report_summary,
    fetch_and_generate_report,
    format_report_as_csv,
)


class TestCRMetricsDataclasses(unittest.TestCase):
    """Test dataclass definitions and instantiation."""

    def test_cr_metrics_creation(self):
        """Test CRMetrics dataclass creation with all fields."""
        cr = CRMetrics(
            cr_number=42,
            cr_title="Test PR",
            cr_state="merged",
            cr_url="https://github.com/owner/repo/pull/42",
            cr_author="testuser",
            cr_created_at="2024-01-01T00:00:00Z",
            cr_merged_at="2024-01-02T00:00:00Z",
            commits_before_cr_open=3,
            commits_after_cr_open=2,
            commits_after_summary=1,
            has_recce_session=True,
            recce_session_url="https://cloud.datarecce.io/session/abc123",
            recce_checks_count=5,
            recce_check_types=["row_count_diff", "value_diff"],
            recce_summary_generated=True,
            recce_summary_at="2024-01-01T12:00:00Z",
        )
        self.assertEqual(cr.cr_number, 42)
        self.assertEqual(cr.cr_title, "Test PR")
        self.assertEqual(cr.cr_state, "merged")
        self.assertTrue(cr.has_recce_session)
        self.assertEqual(cr.recce_checks_count, 5)

    def test_cr_metrics_with_none_values(self):
        """Test CRMetrics with optional None values."""
        cr = CRMetrics(
            cr_number=1,
            cr_title="Open PR",
            cr_state="opened",
            cr_url="https://github.com/owner/repo/pull/1",
            cr_author=None,
            cr_created_at=None,
            cr_merged_at=None,
            commits_before_cr_open=0,
            commits_after_cr_open=0,
            commits_after_summary=None,
            has_recce_session=False,
            recce_session_url=None,
            recce_checks_count=None,
            recce_check_types=None,
            recce_summary_generated=None,
            recce_summary_at=None,
        )
        self.assertIsNone(cr.cr_author)
        self.assertIsNone(cr.commits_after_summary)
        self.assertFalse(cr.has_recce_session)

    def test_summary_statistics_creation(self):
        """Test SummaryStatistics dataclass creation."""
        summary = SummaryStatistics(
            total_crs=10,
            crs_merged=8,
            crs_open=2,
            crs_with_recce_session=6,
            crs_with_recce_summary=4,
            recce_adoption_rate=60.0,
            summary_generation_rate=40.0,
            total_commits_before_cr_open=20,
            total_commits_after_cr_open=15,
            total_commits_after_summary=5,
            avg_commits_before_cr_open=2.0,
            avg_commits_after_cr_open=1.5,
            avg_commits_after_summary=1.25,
        )
        self.assertEqual(summary.total_crs, 10)
        self.assertEqual(summary.recce_adoption_rate, 60.0)
        self.assertEqual(summary.avg_commits_after_summary, 1.25)

    def test_cr_metrics_report_creation(self):
        """Test CRMetricsReport dataclass creation."""
        summary = SummaryStatistics(
            total_crs=1,
            crs_merged=1,
            crs_open=0,
            crs_with_recce_session=1,
            crs_with_recce_summary=1,
            recce_adoption_rate=100.0,
            summary_generation_rate=100.0,
            total_commits_before_cr_open=2,
            total_commits_after_cr_open=1,
            total_commits_after_summary=0,
            avg_commits_before_cr_open=2.0,
            avg_commits_after_cr_open=1.0,
            avg_commits_after_summary=0.0,
        )
        cr = CRMetrics(
            cr_number=1,
            cr_title="Test",
            cr_state="merged",
            cr_url="https://github.com/owner/repo/pull/1",
            cr_author="user",
            cr_created_at="2024-01-01T00:00:00Z",
            cr_merged_at="2024-01-02T00:00:00Z",
            commits_before_cr_open=2,
            commits_after_cr_open=1,
            commits_after_summary=0,
            has_recce_session=True,
            recce_session_url="https://cloud.datarecce.io/session/test",
            recce_checks_count=3,
            recce_check_types=["row_count_diff"],
            recce_summary_generated=True,
            recce_summary_at="2024-01-01T12:00:00Z",
        )
        report = CRMetricsReport(
            success=True,
            repo="owner/repo",
            date_range_since="2024-01-01",
            date_range_until="2024-01-31",
            summary=summary,
            change_requests=[cr],
        )
        self.assertTrue(report.success)
        self.assertEqual(report.repo, "owner/repo")
        self.assertEqual(len(report.change_requests), 1)


class TestReportClient(unittest.TestCase):
    """Test cases for ReportClient class with mocked HTTP responses."""

    def test_init_with_token(self):
        """Test ReportClient initialization with valid token."""
        # Ensure we have the default API host by reimporting
        from importlib import reload

        import recce_cloud.report as report_module

        reload(report_module)
        client = report_module.ReportClient(token="test_token")
        self.assertEqual(client.token, "test_token")
        self.assertIn("cloud.datarecce.io", client.base_url_v2)

    def test_init_with_none_token_raises_error(self):
        """Test ReportClient initialization with None token raises ValueError."""
        with self.assertRaises(ValueError) as context:
            ReportClient(token=None)
        self.assertIn("Token cannot be None", str(context.exception))

    def test_init_with_custom_api_host(self):
        """Test ReportClient uses custom API host from environment."""
        with patch.dict(os.environ, {"RECCE_CLOUD_API_HOST": "https://custom.api.com"}):
            # Need to reimport to pick up the env var
            from importlib import reload

            import recce_cloud.report as report_module

            reload(report_module)
            client = report_module.ReportClient(token="test")
            self.assertIn("custom.api.com", client.base_url_v2)
            # Reload again to reset
            reload(report_module)

    @patch("recce_cloud.report.requests.request")
    def test_request_adds_authorization_header(self, mock_request):
        """Test _request method adds Authorization header."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        client = ReportClient(token="my_secret_token")
        client._request("GET", "https://api.example.com/test")

        mock_request.assert_called_once()
        call_args = mock_request.call_args
        headers = call_args.kwargs.get("headers") or call_args[1].get("headers")
        self.assertEqual(headers["Authorization"], "Bearer my_secret_token")

    @patch("recce_cloud.report.requests.request")
    def test_request_timeout_raises_recce_cloud_exception(self, mock_request):
        """Test _request raises RecceCloudException on timeout."""
        import requests

        mock_request.side_effect = requests.exceptions.Timeout("Connection timed out")

        client = ReportClient(token="test_token")
        with self.assertRaises(RecceCloudException) as context:
            client._request("GET", "https://api.example.com/test")

        self.assertIn("timed out", context.exception.reason)
        self.assertEqual(context.exception.status_code, 0)

    @patch("recce_cloud.report.requests.request")
    def test_request_connection_error_raises_recce_cloud_exception(self, mock_request):
        """Test _request raises RecceCloudException on connection error."""
        import requests

        mock_request.side_effect = requests.exceptions.ConnectionError("Failed to connect")

        client = ReportClient(token="test_token")
        with self.assertRaises(RecceCloudException) as context:
            client._request("GET", "https://api.example.com/test")

        self.assertIn("Failed to connect", context.exception.reason)
        self.assertEqual(context.exception.status_code, 0)

    @patch("recce_cloud.report.requests.request")
    def test_request_generic_exception_raises_recce_cloud_exception(self, mock_request):
        """Test _request raises RecceCloudException on generic request error."""
        import requests

        mock_request.side_effect = requests.exceptions.RequestException("Unknown error")

        client = ReportClient(token="test_token")
        with self.assertRaises(RecceCloudException) as context:
            client._request("GET", "https://api.example.com/test")

        self.assertIn("Network error", context.exception.reason)
        self.assertEqual(context.exception.status_code, 0)


class TestReportClientGetCRMetrics(unittest.TestCase):
    """Test cases for ReportClient.get_cr_metrics() with mocked API responses."""

    def _create_mock_api_response(self, status_code=200, json_data=None, text=""):
        """Helper to create a mock response object."""
        mock_response = Mock()
        mock_response.status_code = status_code
        mock_response.text = text
        if json_data is not None:
            mock_response.json.return_value = json_data
        else:
            mock_response.json.side_effect = json.JSONDecodeError("", "", 0)
        return mock_response

    def _create_sample_api_response(self):
        """Create a sample successful API response."""
        return {
            "success": True,
            "repo": "owner/repo",
            "date_range": {"since": "2024-01-01", "until": "2024-01-31"},
            "summary": {
                "total_crs": 5,
                "crs_merged": 4,
                "crs_open": 1,
                "crs_with_recce_session": 3,
                "crs_with_recce_summary": 2,
                "recce_adoption_rate": 60.0,
                "summary_generation_rate": 40.0,
                "total_commits_before_cr_open": 10,
                "total_commits_after_cr_open": 8,
                "total_commits_after_summary": 3,
                "avg_commits_before_cr_open": 2.0,
                "avg_commits_after_cr_open": 1.6,
                "avg_commits_after_summary": 1.5,
            },
            "change_requests": [
                {
                    "cr_number": 42,
                    "cr_title": "Add new feature",
                    "cr_state": "merged",
                    "cr_url": "https://github.com/owner/repo/pull/42",
                    "cr_author": "developer1",
                    "cr_created_at": "2024-01-05T10:00:00Z",
                    "cr_merged_at": "2024-01-06T15:00:00Z",
                    "commits_before_cr_open": 3,
                    "commits_after_cr_open": 2,
                    "commits_after_summary": 1,
                    "has_recce_session": True,
                    "recce_session_url": "https://cloud.datarecce.io/session/abc",
                    "recce_checks_count": 5,
                    "recce_check_types": ["row_count_diff", "value_diff"],
                    "recce_summary_generated": True,
                    "recce_summary_at": "2024-01-05T14:00:00Z",
                },
                {
                    "cr_number": 43,
                    "cr_title": "Fix bug",
                    "cr_state": "opened",
                    "cr_url": "https://github.com/owner/repo/pull/43",
                    "cr_author": "developer2",
                    "cr_created_at": "2024-01-10T09:00:00Z",
                    "cr_merged_at": None,
                    "commits_before_cr_open": 1,
                    "commits_after_cr_open": 0,
                    "commits_after_summary": None,
                    "has_recce_session": False,
                    "recce_session_url": None,
                    "recce_checks_count": None,
                    "recce_check_types": None,
                    "recce_summary_generated": None,
                    "recce_summary_at": None,
                },
            ],
        }

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_success(self, mock_request):
        """Test successful get_cr_metrics call."""
        mock_request.return_value = self._create_mock_api_response(
            status_code=200, json_data=self._create_sample_api_response()
        )

        client = ReportClient(token="test_token")
        report = client.get_cr_metrics(repo="owner/repo")

        self.assertTrue(report.success)
        self.assertEqual(report.repo, "owner/repo")
        self.assertEqual(report.date_range_since, "2024-01-01")
        self.assertEqual(report.date_range_until, "2024-01-31")
        self.assertEqual(report.summary.total_crs, 5)
        self.assertEqual(len(report.change_requests), 2)

        # Verify first CR
        cr1 = report.change_requests[0]
        self.assertEqual(cr1.cr_number, 42)
        self.assertEqual(cr1.cr_title, "Add new feature")
        self.assertTrue(cr1.has_recce_session)
        self.assertEqual(cr1.recce_check_types, ["row_count_diff", "value_diff"])

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_with_all_parameters(self, mock_request):
        """Test get_cr_metrics with all optional parameters."""
        mock_request.return_value = self._create_mock_api_response(
            status_code=200, json_data=self._create_sample_api_response()
        )

        client = ReportClient(token="test_token")
        client.get_cr_metrics(
            repo="owner/repo",
            since="2024-01-01",
            until="2024-01-31",
            base_branch="develop",
            merged_only=False,
        )

        # Verify request parameters
        call_args = mock_request.call_args
        params = call_args.kwargs.get("params") or call_args[1].get("params")
        self.assertEqual(params["repo"], "owner/repo")
        self.assertEqual(params["since"], "2024-01-01")
        self.assertEqual(params["until"], "2024-01-31")
        self.assertEqual(params["base_branch"], "develop")
        self.assertEqual(params["merged_only"], "false")

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_401_unauthorized(self, mock_request):
        """Test get_cr_metrics handles 401 unauthorized error."""
        mock_request.return_value = self._create_mock_api_response(status_code=401, text="Unauthorized")

        client = ReportClient(token="invalid_token")
        with self.assertRaises(RecceCloudException) as context:
            client.get_cr_metrics(repo="owner/repo")

        self.assertEqual(context.exception.status_code, 401)
        self.assertIn("Invalid or missing API token", context.exception.reason)

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_404_not_found(self, mock_request):
        """Test get_cr_metrics handles 404 repository not found."""
        mock_request.return_value = self._create_mock_api_response(status_code=404, text="Not found")

        client = ReportClient(token="test_token")
        with self.assertRaises(RecceCloudException) as context:
            client.get_cr_metrics(repo="unknown/repo")

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("Repository not found", context.exception.reason)

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_400_bad_request(self, mock_request):
        """Test get_cr_metrics handles 400 bad request with detail."""
        mock_request.return_value = self._create_mock_api_response(
            status_code=400,
            json_data={"detail": "Invalid date format for 'since' parameter"},
        )

        client = ReportClient(token="test_token")
        with self.assertRaises(RecceCloudException) as context:
            client.get_cr_metrics(repo="owner/repo", since="invalid")

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Invalid date format", context.exception.reason)

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_400_bad_request_no_json(self, mock_request):
        """Test get_cr_metrics handles 400 bad request without JSON body."""
        mock_response = self._create_mock_api_response(status_code=400, text="Bad request")
        mock_response.json.side_effect = json.JSONDecodeError("", "", 0)
        mock_request.return_value = mock_response

        client = ReportClient(token="test_token")
        with self.assertRaises(RecceCloudException) as context:
            client.get_cr_metrics(repo="owner/repo")

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Bad request", context.exception.reason)

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_502_upstream_error(self, mock_request):
        """Test get_cr_metrics handles 502 upstream API error."""
        mock_request.return_value = self._create_mock_api_response(
            status_code=502,
            json_data={"detail": "GitHub API rate limit exceeded"},
        )

        client = ReportClient(token="test_token")
        with self.assertRaises(RecceCloudException) as context:
            client.get_cr_metrics(repo="owner/repo")

        self.assertEqual(context.exception.status_code, 502)
        self.assertIn("rate limit", context.exception.reason)

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_500_server_error(self, mock_request):
        """Test get_cr_metrics handles 500 internal server error."""
        mock_request.return_value = self._create_mock_api_response(status_code=500, text="Internal Server Error")

        client = ReportClient(token="test_token")
        with self.assertRaises(RecceCloudException) as context:
            client.get_cr_metrics(repo="owner/repo")

        self.assertEqual(context.exception.status_code, 500)

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_invalid_json_response(self, mock_request):
        """Test get_cr_metrics handles invalid JSON response."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Expecting value", "", 0)
        mock_request.return_value = mock_response

        client = ReportClient(token="test_token")
        with self.assertRaises(RecceCloudException) as context:
            client.get_cr_metrics(repo="owner/repo")

        self.assertIn("Invalid response from API", context.exception.reason)

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_empty_change_requests(self, mock_request):
        """Test get_cr_metrics handles response with no change requests."""
        response_data = {
            "success": True,
            "repo": "owner/repo",
            "date_range": {"since": "2024-01-01", "until": "2024-01-31"},
            "summary": {
                "total_crs": 0,
                "crs_merged": 0,
                "crs_open": 0,
                "crs_with_recce_session": 0,
                "crs_with_recce_summary": 0,
                "recce_adoption_rate": 0.0,
                "summary_generation_rate": 0.0,
                "total_commits_before_cr_open": 0,
                "total_commits_after_cr_open": 0,
                "total_commits_after_summary": 0,
                "avg_commits_before_cr_open": 0.0,
                "avg_commits_after_cr_open": 0.0,
                "avg_commits_after_summary": None,
            },
            "change_requests": [],
        }
        mock_request.return_value = self._create_mock_api_response(status_code=200, json_data=response_data)

        client = ReportClient(token="test_token")
        report = client.get_cr_metrics(repo="owner/repo")

        self.assertTrue(report.success)
        self.assertEqual(len(report.change_requests), 0)
        self.assertEqual(report.summary.total_crs, 0)

    @patch("recce_cloud.report.requests.request")
    def test_get_cr_metrics_missing_optional_fields(self, mock_request):
        """Test get_cr_metrics handles response with missing optional fields."""
        response_data = {
            "success": True,
            "repo": "owner/repo",
            "date_range": {"since": "2024-01-01", "until": "2024-01-31"},
            "summary": {},
            "change_requests": [
                {
                    "cr_number": 1,
                    # Missing most optional fields
                }
            ],
        }
        mock_request.return_value = self._create_mock_api_response(status_code=200, json_data=response_data)

        client = ReportClient(token="test_token")
        report = client.get_cr_metrics(repo="owner/repo")

        # Should use defaults for missing fields
        self.assertEqual(len(report.change_requests), 1)
        cr = report.change_requests[0]
        self.assertEqual(cr.cr_number, 1)
        self.assertEqual(cr.cr_title, "")
        self.assertEqual(cr.cr_state, "unknown")
        self.assertEqual(cr.commits_before_cr_open, 0)
        self.assertFalse(cr.has_recce_session)


class TestFormatReportAsCsv(unittest.TestCase):
    """Test cases for format_report_as_csv() function."""

    def _create_sample_report(self, num_crs=2):
        """Create a sample CRMetricsReport for testing."""
        summary = SummaryStatistics(
            total_crs=num_crs,
            crs_merged=num_crs - 1 if num_crs > 0 else 0,
            crs_open=1 if num_crs > 0 else 0,
            crs_with_recce_session=num_crs // 2,
            crs_with_recce_summary=num_crs // 2,
            recce_adoption_rate=50.0,
            summary_generation_rate=50.0,
            total_commits_before_cr_open=num_crs * 2,
            total_commits_after_cr_open=num_crs,
            total_commits_after_summary=num_crs // 2,
            avg_commits_before_cr_open=2.0,
            avg_commits_after_cr_open=1.0,
            avg_commits_after_summary=0.5 if num_crs > 0 else None,
        )

        change_requests = []
        for i in range(num_crs):
            cr = CRMetrics(
                cr_number=i + 1,
                cr_title=f"PR {i + 1}: Test feature",
                cr_state="merged" if i % 2 == 0 else "opened",
                cr_url=f"https://github.com/owner/repo/pull/{i + 1}",
                cr_author=f"developer{i + 1}",
                cr_created_at=f"2024-01-{i + 1:02d}T10:00:00Z",
                cr_merged_at=f"2024-01-{i + 2:02d}T15:00:00Z" if i % 2 == 0 else None,
                commits_before_cr_open=2,
                commits_after_cr_open=1,
                commits_after_summary=0 if i % 2 == 0 else None,
                has_recce_session=i % 2 == 0,
                recce_session_url=f"https://cloud.datarecce.io/session/{i}" if i % 2 == 0 else None,
                recce_checks_count=3 if i % 2 == 0 else None,
                recce_check_types=["row_count_diff", "value_diff"] if i % 2 == 0 else None,
                recce_summary_generated=True if i % 2 == 0 else None,
                recce_summary_at=f"2024-01-{i + 1:02d}T12:00:00Z" if i % 2 == 0 else None,
            )
            change_requests.append(cr)

        return CRMetricsReport(
            success=True,
            repo="owner/repo",
            date_range_since="2024-01-01",
            date_range_until="2024-01-31",
            summary=summary,
            change_requests=change_requests,
        )

    def test_format_csv_header(self):
        """Test CSV output contains correct header row."""
        report = self._create_sample_report(num_crs=1)
        csv_output = format_report_as_csv(report)

        lines = csv_output.strip().split("\n")
        header = lines[0]

        expected_columns = [
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

        for col in expected_columns:
            self.assertIn(col, header)

    def test_format_csv_data_rows(self):
        """Test CSV output contains correct data rows."""
        report = self._create_sample_report(num_crs=2)
        csv_output = format_report_as_csv(report)

        lines = csv_output.strip().split("\n")
        self.assertEqual(len(lines), 3)  # 1 header + 2 data rows

        # Parse first data row
        data_row = lines[1]
        self.assertIn("1", data_row)  # cr_number
        self.assertIn("PR 1: Test feature", data_row)  # cr_title
        self.assertIn("merged", data_row)  # cr_state

    def test_format_csv_empty_report(self):
        """Test CSV output for report with no change requests."""
        report = self._create_sample_report(num_crs=0)
        csv_output = format_report_as_csv(report)

        lines = csv_output.strip().split("\n")
        self.assertEqual(len(lines), 1)  # Only header row

    def test_format_csv_check_types_joined(self):
        """Test that check_types list is joined with semicolons."""
        report = self._create_sample_report(num_crs=1)
        csv_output = format_report_as_csv(report)

        self.assertIn("row_count_diff;value_diff", csv_output)

    def test_format_csv_none_values_as_empty_string(self):
        """Test that None values are output as empty strings."""
        report = self._create_sample_report(num_crs=2)
        csv_output = format_report_as_csv(report)

        # The second row should have empty strings for None values
        lines = csv_output.strip().split("\n")
        # Second data row (index 2) has opened state with None values
        self.assertEqual(len(lines), 3)

    def test_format_csv_special_characters_escaped(self):
        """Test that special characters in titles are properly escaped."""
        summary = SummaryStatistics(
            total_crs=1,
            crs_merged=1,
            crs_open=0,
            crs_with_recce_session=0,
            crs_with_recce_summary=0,
            recce_adoption_rate=0.0,
            summary_generation_rate=0.0,
            total_commits_before_cr_open=0,
            total_commits_after_cr_open=0,
            total_commits_after_summary=0,
            avg_commits_before_cr_open=0.0,
            avg_commits_after_cr_open=0.0,
            avg_commits_after_summary=None,
        )
        cr = CRMetrics(
            cr_number=1,
            cr_title='Test with "quotes" and, commas',
            cr_state="merged",
            cr_url="https://github.com/owner/repo/pull/1",
            cr_author="user",
            cr_created_at="2024-01-01T00:00:00Z",
            cr_merged_at="2024-01-02T00:00:00Z",
            commits_before_cr_open=0,
            commits_after_cr_open=0,
            commits_after_summary=None,
            has_recce_session=False,
            recce_session_url=None,
            recce_checks_count=None,
            recce_check_types=None,
            recce_summary_generated=None,
            recce_summary_at=None,
        )
        report = CRMetricsReport(
            success=True,
            repo="owner/repo",
            date_range_since="2024-01-01",
            date_range_until="2024-01-31",
            summary=summary,
            change_requests=[cr],
        )

        csv_output = format_report_as_csv(report)
        # CSV should properly escape the title with quotes
        self.assertIn('"Test with ""quotes"" and, commas"', csv_output)


class TestDisplayReportSummary(unittest.TestCase):
    """Test cases for display_report_summary() function."""

    def _create_console_capture(self):
        """Create a console that captures output without ANSI codes."""
        output = StringIO()
        # Use no_color=True to prevent ANSI escape codes in output
        console = Console(file=output, force_terminal=False, no_color=True, width=80)
        return console, output

    def _create_sample_report(self, num_crs=5):
        """Create a sample CRMetricsReport for testing."""
        summary = SummaryStatistics(
            total_crs=num_crs,
            crs_merged=num_crs - 1 if num_crs > 0 else 0,
            crs_open=1 if num_crs > 0 else 0,
            crs_with_recce_session=num_crs // 2,
            crs_with_recce_summary=num_crs // 3,
            recce_adoption_rate=50.0,
            summary_generation_rate=33.3,
            total_commits_before_cr_open=num_crs * 2,
            total_commits_after_cr_open=num_crs,
            total_commits_after_summary=num_crs // 2,
            avg_commits_before_cr_open=2.0,
            avg_commits_after_cr_open=1.0,
            avg_commits_after_summary=0.5 if num_crs > 0 else None,
        )

        change_requests = []
        for i in range(num_crs):
            cr = CRMetrics(
                cr_number=i + 1,
                cr_title=f"PR {i + 1}: Feature update",
                cr_state=["merged", "opened", "closed"][i % 3],
                cr_url=f"https://github.com/owner/repo/pull/{i + 1}",
                cr_author=f"developer{i + 1}",
                cr_created_at=f"2024-01-{i + 1:02d}T10:00:00Z",
                cr_merged_at=f"2024-01-{i + 2:02d}T15:00:00Z" if i % 3 == 0 else None,
                commits_before_cr_open=2,
                commits_after_cr_open=1,
                commits_after_summary=0 if i % 2 == 0 else None,
                has_recce_session=i % 2 == 0,
                recce_session_url=f"https://cloud.datarecce.io/session/{i}" if i % 2 == 0 else None,
                recce_checks_count=3 if i % 2 == 0 else None,
                recce_check_types=["row_count_diff"] if i % 2 == 0 else None,
                recce_summary_generated=True if i % 3 == 0 else False,
                recce_summary_at=f"2024-01-{i + 1:02d}T12:00:00Z" if i % 3 == 0 else None,
            )
            change_requests.append(cr)

        return CRMetricsReport(
            success=True,
            repo="owner/repo",
            date_range_since="2024-01-01",
            date_range_until="2024-01-31",
            summary=summary,
            change_requests=change_requests,
        )

    def test_display_summary_shows_repository(self):
        """Test that display shows repository name."""
        console, output = self._create_console_capture()
        report = self._create_sample_report(num_crs=2)

        display_report_summary(console, report)

        output_text = output.getvalue()
        self.assertIn("owner/repo", output_text)

    def test_display_summary_shows_date_range(self):
        """Test that display shows date range."""
        console, output = self._create_console_capture()
        report = self._create_sample_report(num_crs=2)

        display_report_summary(console, report)

        output_text = output.getvalue()
        self.assertIn("2024-01-01", output_text)
        self.assertIn("2024-01-31", output_text)

    def test_display_summary_shows_statistics(self):
        """Test that display shows summary statistics."""
        console, output = self._create_console_capture()
        report = self._create_sample_report(num_crs=5)

        display_report_summary(console, report)

        output_text = output.getvalue()
        self.assertIn("Total CRs", output_text)
        self.assertIn("Merged", output_text)
        self.assertIn("Recce Adoption", output_text)
        self.assertIn("50.0%", output_text)  # adoption rate

    def test_display_summary_empty_report(self):
        """Test display with no change requests shows appropriate message."""
        console, output = self._create_console_capture()
        report = self._create_sample_report(num_crs=0)

        display_report_summary(console, report)

        output_text = output.getvalue()
        self.assertIn("No change requests found", output_text)

    def test_display_summary_truncates_long_list(self):
        """Test that more than 10 CRs shows truncation message."""
        console, output = self._create_console_capture()
        report = self._create_sample_report(num_crs=15)

        display_report_summary(console, report)

        output_text = output.getvalue()
        self.assertIn("and 5 more", output_text)
        self.assertIn("showing 10 of 15", output_text)

    def test_display_summary_shows_cr_details(self):
        """Test that CR details are displayed."""
        console, output = self._create_console_capture()
        report = self._create_sample_report(num_crs=2)

        display_report_summary(console, report)

        output_text = output.getvalue()
        self.assertIn("!1", output_text)  # CR number
        self.assertIn("PR 1: Feature update", output_text)  # CR title
        self.assertIn("developer1", output_text)  # author


class TestFetchAndGenerateReport(unittest.TestCase):
    """Test cases for fetch_and_generate_report() function."""

    def _create_console_capture(self):
        """Create a console that captures output."""
        output = StringIO()
        console = Console(file=output, force_terminal=True, width=80)
        return console, output

    def _create_mock_report(self):
        """Create a mock CRMetricsReport."""
        summary = SummaryStatistics(
            total_crs=1,
            crs_merged=1,
            crs_open=0,
            crs_with_recce_session=1,
            crs_with_recce_summary=1,
            recce_adoption_rate=100.0,
            summary_generation_rate=100.0,
            total_commits_before_cr_open=2,
            total_commits_after_cr_open=1,
            total_commits_after_summary=0,
            avg_commits_before_cr_open=2.0,
            avg_commits_after_cr_open=1.0,
            avg_commits_after_summary=0.0,
        )
        cr = CRMetrics(
            cr_number=1,
            cr_title="Test PR",
            cr_state="merged",
            cr_url="https://github.com/owner/repo/pull/1",
            cr_author="user",
            cr_created_at="2024-01-01T00:00:00Z",
            cr_merged_at="2024-01-02T00:00:00Z",
            commits_before_cr_open=2,
            commits_after_cr_open=1,
            commits_after_summary=0,
            has_recce_session=True,
            recce_session_url="https://cloud.datarecce.io/session/test",
            recce_checks_count=3,
            recce_check_types=["row_count_diff"],
            recce_summary_generated=True,
            recce_summary_at="2024-01-01T12:00:00Z",
        )
        return CRMetricsReport(
            success=True,
            repo="owner/repo",
            date_range_since="2024-01-01",
            date_range_until="2024-01-31",
            summary=summary,
            change_requests=[cr],
        )

    @patch("recce_cloud.report.ReportClient")
    def test_fetch_and_generate_success_stdout(self, MockReportClient):
        """Test successful report generation to stdout."""
        console, output = self._create_console_capture()
        mock_client = MagicMock()
        mock_client.get_cr_metrics.return_value = self._create_mock_report()
        MockReportClient.return_value = mock_client

        exit_code = fetch_and_generate_report(
            console=console,
            token="test_token",
            repo="owner/repo",
            since="30d",
            until=None,
            base_branch="main",
            merged_only=True,
            output_path=None,
        )

        self.assertEqual(exit_code, 0)
        mock_client.get_cr_metrics.assert_called_once_with(
            repo="owner/repo",
            since="30d",
            until=None,
            base_branch="main",
            merged_only=True,
        )

    @patch("recce_cloud.report.ReportClient")
    def test_fetch_and_generate_success_file_output(self, MockReportClient):
        """Test successful report generation to file."""
        console, output = self._create_console_capture()
        mock_client = MagicMock()
        mock_client.get_cr_metrics.return_value = self._create_mock_report()
        MockReportClient.return_value = mock_client

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            output_path = f.name

        try:
            exit_code = fetch_and_generate_report(
                console=console,
                token="test_token",
                repo="owner/repo",
                since="30d",
                until=None,
                base_branch="main",
                merged_only=True,
                output_path=output_path,
            )

            self.assertEqual(exit_code, 0)

            # Verify file was written
            with open(output_path, "r") as f:
                content = f.read()
            self.assertIn("cr_number", content)
            self.assertIn("Test PR", content)

            # Verify success message
            output_text = output.getvalue()
            self.assertIn("Report saved to", output_text)
        finally:
            os.unlink(output_path)

    @patch("recce_cloud.report.ReportClient")
    def test_fetch_and_generate_api_error(self, MockReportClient):
        """Test report generation handles API errors."""
        console, output = self._create_console_capture()
        mock_client = MagicMock()
        mock_client.get_cr_metrics.side_effect = RecceCloudException(reason="Repository not found", status_code=404)
        MockReportClient.return_value = mock_client

        exit_code = fetch_and_generate_report(
            console=console,
            token="test_token",
            repo="unknown/repo",
            since="30d",
            until=None,
            base_branch="main",
            merged_only=True,
            output_path=None,
        )

        self.assertEqual(exit_code, 1)
        output_text = output.getvalue()
        self.assertIn("Error", output_text)
        self.assertIn("Repository not found", output_text)

    @patch("recce_cloud.report.ReportClient")
    def test_fetch_and_generate_unexpected_error(self, MockReportClient):
        """Test report generation handles unexpected errors."""
        console, output = self._create_console_capture()
        mock_client = MagicMock()
        mock_client.get_cr_metrics.side_effect = Exception("Unexpected error")
        MockReportClient.return_value = mock_client

        exit_code = fetch_and_generate_report(
            console=console,
            token="test_token",
            repo="owner/repo",
            since="30d",
            until=None,
            base_branch="main",
            merged_only=True,
            output_path=None,
        )

        self.assertEqual(exit_code, 1)
        output_text = output.getvalue()
        self.assertIn("Error", output_text)
        self.assertIn("Failed to fetch report", output_text)

    @patch("recce_cloud.report.ReportClient")
    def test_fetch_and_generate_file_write_error(self, MockReportClient):
        """Test report generation handles file write errors."""
        console, output = self._create_console_capture()
        mock_client = MagicMock()
        mock_client.get_cr_metrics.return_value = self._create_mock_report()
        MockReportClient.return_value = mock_client

        # Use a path that doesn't exist
        invalid_path = "/nonexistent/directory/report.csv"

        exit_code = fetch_and_generate_report(
            console=console,
            token="test_token",
            repo="owner/repo",
            since="30d",
            until=None,
            base_branch="main",
            merged_only=True,
            output_path=invalid_path,
        )

        self.assertEqual(exit_code, 1)
        output_text = output.getvalue()
        self.assertIn("Error", output_text)
        self.assertIn("Failed to write file", output_text)


class TestReportCLICommand(unittest.TestCase):
    """Integration tests for the CLI report command."""

    def setUp(self):
        """Set up test fixtures."""
        self.runner = CliRunner()
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil

        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def _create_mock_api_response(self):
        """Create a mock successful API response."""
        return {
            "success": True,
            "repo": "owner/repo",
            "date_range": {"since": "2024-01-01", "until": "2024-01-31"},
            "summary": {
                "total_crs": 2,
                "crs_merged": 1,
                "crs_open": 1,
                "crs_with_recce_session": 1,
                "crs_with_recce_summary": 1,
                "recce_adoption_rate": 50.0,
                "summary_generation_rate": 50.0,
                "total_commits_before_cr_open": 4,
                "total_commits_after_cr_open": 2,
                "total_commits_after_summary": 1,
                "avg_commits_before_cr_open": 2.0,
                "avg_commits_after_cr_open": 1.0,
                "avg_commits_after_summary": 1.0,
            },
            "change_requests": [
                {
                    "cr_number": 1,
                    "cr_title": "Test PR 1",
                    "cr_state": "merged",
                    "cr_url": "https://github.com/owner/repo/pull/1",
                    "cr_author": "user1",
                    "cr_created_at": "2024-01-01T10:00:00Z",
                    "cr_merged_at": "2024-01-02T15:00:00Z",
                    "commits_before_cr_open": 2,
                    "commits_after_cr_open": 1,
                    "commits_after_summary": 0,
                    "has_recce_session": True,
                    "recce_session_url": "https://cloud.datarecce.io/session/abc",
                    "recce_checks_count": 3,
                    "recce_check_types": ["row_count_diff"],
                    "recce_summary_generated": True,
                    "recce_summary_at": "2024-01-01T12:00:00Z",
                },
                {
                    "cr_number": 2,
                    "cr_title": "Test PR 2",
                    "cr_state": "opened",
                    "cr_url": "https://github.com/owner/repo/pull/2",
                    "cr_author": "user2",
                    "cr_created_at": "2024-01-05T09:00:00Z",
                    "cr_merged_at": None,
                    "commits_before_cr_open": 2,
                    "commits_after_cr_open": 1,
                    "commits_after_summary": None,
                    "has_recce_session": False,
                    "recce_session_url": None,
                    "recce_checks_count": None,
                    "recce_check_types": None,
                    "recce_summary_generated": None,
                    "recce_summary_at": None,
                },
            ],
        }

    def test_report_missing_token(self):
        """Test report command fails without RECCE_API_TOKEN."""
        env = {}

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "owner/repo"],
            )

        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("RECCE_API_TOKEN", result.output)

    def test_report_missing_repo(self):
        """Test report command fails without repo when git is not available."""
        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            with patch("subprocess.run") as mock_run:
                mock_run.side_effect = FileNotFoundError("git not found")
                result = self.runner.invoke(
                    cloud_cli,
                    ["report"],
                )

        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Could not detect repository", result.output)

    @patch("recce_cloud.report.requests.request")
    def test_report_success_default_shows_summary(self, mock_request):
        """Test successful report shows summary by default, not CSV."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_mock_api_response()
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "owner/repo"],
            )

        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("owner/repo", result.output)
        self.assertIn("SUMMARY STATISTICS", result.output)
        self.assertNotIn("cr_number", result.output)  # Should not have CSV header

    @patch("recce_cloud.report.requests.request")
    def test_report_success_with_csv_output(self, mock_request):
        """Test report with --csv flag outputs only CSV."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_mock_api_response()
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "owner/repo", "--csv"],
            )

        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertNotIn("SUMMARY STATISTICS", result.output)
        self.assertIn("cr_number", result.output)  # Should have CSV header

    @patch("recce_cloud.report.requests.request")
    def test_report_auto_detect_repo_ssh(self, mock_request):
        """Test report auto-detects repo from SSH git remote."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_mock_api_response()
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            with patch("subprocess.run") as mock_run:
                mock_result = Mock()
                mock_result.stdout = "git@github.com:owner/repo.git\n"
                mock_run.return_value = mock_result

                result = self.runner.invoke(
                    cloud_cli,
                    ["report"],
                )

        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Auto-detected repository", result.output)
        self.assertIn("owner/repo", result.output)

    @patch("recce_cloud.report.requests.request")
    def test_report_auto_detect_repo_https(self, mock_request):
        """Test report auto-detects repo from HTTPS git remote."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_mock_api_response()
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            with patch("subprocess.run") as mock_run:
                mock_result = Mock()
                mock_result.stdout = "https://gitlab.com/group/subgroup/repo.git\n"
                mock_run.return_value = mock_result

                result = self.runner.invoke(
                    cloud_cli,
                    ["report"],
                )

        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Auto-detected repository", result.output)

    @patch("recce_cloud.report.requests.request")
    def test_report_with_output_file(self, mock_request):
        """Test report saves to output file."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_mock_api_response()
        mock_request.return_value = mock_response

        output_file = os.path.join(self.temp_dir, "report.csv")
        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "owner/repo", "-o", output_file],
            )

        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")
        self.assertIn("Report saved to", result.output)
        self.assertTrue(os.path.exists(output_file))

        with open(output_file, "r") as f:
            content = f.read()
        self.assertIn("cr_number", content)
        self.assertIn("Test PR 1", content)

    @patch("recce_cloud.report.requests.request")
    def test_report_with_custom_date_range(self, mock_request):
        """Test report with custom since/until options."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_mock_api_response()
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                [
                    "report",
                    "--repo",
                    "owner/repo",
                    "--since",
                    "2024-01-01",
                    "--until",
                    "2024-01-31",
                ],
            )

        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")

        # Verify API was called with correct parameters
        call_args = mock_request.call_args
        params = call_args.kwargs.get("params") or call_args[1].get("params")
        self.assertEqual(params["since"], "2024-01-01")
        self.assertEqual(params["until"], "2024-01-31")

    @patch("recce_cloud.report.requests.request")
    def test_report_with_relative_date(self, mock_request):
        """Test report with relative date (e.g., 60d)."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_mock_api_response()
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "owner/repo", "--since", "60d"],
            )

        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")

        call_args = mock_request.call_args
        params = call_args.kwargs.get("params") or call_args[1].get("params")
        self.assertEqual(params["since"], "60d")

    @patch("recce_cloud.report.requests.request")
    def test_report_with_base_branch(self, mock_request):
        """Test report with custom base branch."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_mock_api_response()
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "owner/repo", "--base-branch", "develop"],
            )

        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")

        call_args = mock_request.call_args
        params = call_args.kwargs.get("params") or call_args[1].get("params")
        self.assertEqual(params["base_branch"], "develop")

    @patch("recce_cloud.report.requests.request")
    def test_report_include_open_crs(self, mock_request):
        """Test report with --include-open flag."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self._create_mock_api_response()
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "owner/repo", "--include-open"],
            )

        self.assertEqual(result.exit_code, 0, f"Command failed: {result.output}")

        call_args = mock_request.call_args
        params = call_args.kwargs.get("params") or call_args[1].get("params")
        self.assertEqual(params["merged_only"], "false")

    @patch("recce_cloud.report.requests.request")
    def test_report_api_401_error(self, mock_request):
        """Test report handles 401 unauthorized error."""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "invalid_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "owner/repo"],
            )

        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Error", result.output)
        self.assertIn("Invalid or missing API token", result.output)

    @patch("recce_cloud.report.requests.request")
    def test_report_api_404_error(self, mock_request):
        """Test report handles 404 repository not found error."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = "Not found"
        mock_request.return_value = mock_response

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "unknown/repo"],
            )

        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Error", result.output)
        self.assertIn("Repository not found", result.output)

    @patch("recce_cloud.report.requests.request")
    def test_report_api_network_error(self, mock_request):
        """Test report handles network connection error."""
        import requests

        mock_request.side_effect = requests.exceptions.ConnectionError("Connection failed")

        env = {
            "RECCE_API_TOKEN": "test_token",
        }

        with patch.dict(os.environ, env, clear=True):
            result = self.runner.invoke(
                cloud_cli,
                ["report", "--repo", "owner/repo"],
            )

        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Error", result.output)

    @patch("recce_cloud.report.requests.request")
    def test_report_help(self, mock_request):
        """Test report command help output."""
        result = self.runner.invoke(
            cloud_cli,
            ["report", "--help"],
        )

        self.assertEqual(result.exit_code, 0)
        self.assertIn("Generate CR (Change Request) metrics report", result.output)
        self.assertIn("--repo", result.output)
        self.assertIn("--since", result.output)
        self.assertIn("--until", result.output)
        self.assertIn("--base-branch", result.output)
        self.assertIn("--merged-only", result.output)
        self.assertIn("--include-open", result.output)
        self.assertIn("--output", result.output)


if __name__ == "__main__":
    unittest.main()
