"""
Diagnostic service for checking Recce Cloud setup and configuration.

This service contains the business logic for health checks, separated from
CLI presentation concerns.
"""

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class CheckStatus(Enum):
    """Status of a diagnostic check."""

    PASS = "pass"
    FAIL = "fail"
    SKIP = "skip"  # When check cannot be performed due to missing prerequisites


@dataclass
class CheckResult:
    """Result of a single diagnostic check."""

    status: CheckStatus
    message: Optional[str] = None
    suggestion: Optional[str] = None
    details: dict = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return self.status == CheckStatus.PASS

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result = {
            "status": self.status.value,
            "message": self.message,
            "suggestion": self.suggestion,
        }
        result.update(self.details)
        return result


@dataclass
class DiagnosticResults:
    """Aggregated results of all diagnostic checks."""

    login: CheckResult
    project_binding: CheckResult
    production_metadata: CheckResult
    dev_session: CheckResult

    @property
    def all_passed(self) -> bool:
        return all(
            [
                self.login.passed,
                self.project_binding.passed,
                self.production_metadata.passed,
                self.dev_session.passed,
            ]
        )

    @property
    def passed_count(self) -> int:
        return sum(
            1
            for check in [self.login, self.project_binding, self.production_metadata, self.dev_session]
            if check.passed
        )

    @property
    def total_count(self) -> int:
        return 4

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "login": self.login.to_dict(),
            "project_binding": self.project_binding.to_dict(),
            "production_metadata": self.production_metadata.to_dict(),
            "dev_session": self.dev_session.to_dict(),
            "all_passed": self.all_passed,
        }


class DiagnosticService:
    """
    Service for performing Recce Cloud diagnostic checks.

    This service checks:
    1. Login status - Is the user authenticated?
    2. Project binding - Is the project configured?
    3. Production metadata - Does a production session exist?
    4. Dev session - Does a development session exist?
    """

    def __init__(self):
        self._token: Optional[str] = None
        self._org: Optional[str] = None
        self._project: Optional[str] = None

    def run_all_checks(self) -> DiagnosticResults:
        """
        Run all diagnostic checks and return aggregated results.

        Returns:
            DiagnosticResults containing the status of all checks.
        """
        login_result = self._check_login()
        project_result = self._check_project_binding()

        # Session checks depend on login and project binding
        if login_result.passed and project_result.passed:
            prod_result, dev_result = self._check_sessions()
        else:
            skip_message = "Cannot check - requires login and project binding"
            prod_result = CheckResult(
                status=CheckStatus.SKIP,
                message=skip_message,
            )
            dev_result = CheckResult(
                status=CheckStatus.SKIP,
                message=skip_message,
            )

        return DiagnosticResults(
            login=login_result,
            project_binding=project_result,
            production_metadata=prod_result,
            dev_session=dev_result,
        )

    def _check_login(self) -> CheckResult:
        """Check if user is logged in with a valid token."""
        from recce_cloud.auth.login import check_login_status
        from recce_cloud.auth.profile import get_api_token

        self._token = os.getenv("RECCE_API_TOKEN") or get_api_token()

        if not self._token:
            return CheckResult(
                status=CheckStatus.FAIL,
                message="Not logged in",
                suggestion="Run 'recce-cloud login' to authenticate",
            )

        is_logged_in, email = check_login_status()

        if is_logged_in:
            return CheckResult(
                status=CheckStatus.PASS,
                details={"email": email},
            )
        else:
            return CheckResult(
                status=CheckStatus.FAIL,
                message="Token invalid or expired",
                suggestion="Run 'recce-cloud login' to authenticate",
            )

    def _check_project_binding(self) -> CheckResult:
        """Check if project is bound to Recce Cloud."""
        from recce_cloud.config.project_config import get_project_binding

        binding = get_project_binding()

        if binding:
            self._org = binding.get("org")
            self._project = binding.get("project")
            return CheckResult(
                status=CheckStatus.PASS,
                details={
                    "org": self._org,
                    "project": self._project,
                    "source": "config_file",
                },
            )

        # Check environment variables as fallback
        env_org = os.environ.get("RECCE_ORG")
        env_project = os.environ.get("RECCE_PROJECT")

        if env_org and env_project:
            self._org = env_org
            self._project = env_project
            return CheckResult(
                status=CheckStatus.PASS,
                details={
                    "org": self._org,
                    "project": self._project,
                    "source": "env_vars",
                },
            )

        return CheckResult(
            status=CheckStatus.FAIL,
            message="No project binding found",
            suggestion="Run 'recce-cloud init' to bind this directory to a project",
        )

    def _check_sessions(self) -> tuple[CheckResult, CheckResult]:
        """
        Check for production and development sessions.

        Returns:
            Tuple of (production_result, dev_result)
        """
        from recce_cloud.api.client import RecceCloudClient
        from recce_cloud.api.exceptions import RecceCloudException

        try:
            client = RecceCloudClient(self._token)

            # Get org and project IDs
            org_info = client.get_organization(self._org)
            if not org_info:
                raise RecceCloudException(f"Organization '{self._org}' not found", 404)
            org_id = org_info.get("id")
            if not org_id:
                raise RecceCloudException(f"Organization '{self._org}' response missing ID", 500)

            project_info = client.get_project(org_id, self._project)
            if not project_info:
                raise RecceCloudException(f"Project '{self._project}' not found", 404)
            project_id = project_info.get("id")
            if not project_id:
                raise RecceCloudException(f"Project '{self._project}' response missing ID", 500)

            # List sessions
            sessions = client.list_sessions(org_id, project_id)

            prod_session = None
            dev_sessions = []

            for s in sessions:
                if s.get("is_base"):
                    prod_session = s
                elif not s.get("pr_link"):  # dev = not base and no PR link
                    dev_sessions.append(s)

            # Check production
            prod_result = self._evaluate_production_session(prod_session)

            # Check dev
            dev_result = self._evaluate_dev_sessions(dev_sessions)

            return prod_result, dev_result

        except RecceCloudException as e:
            error_result = CheckResult(
                status=CheckStatus.FAIL,
                message=f"Failed to fetch sessions: {e}",
            )
            return error_result, error_result

        except Exception as e:
            logger.debug("Unexpected error during session check: %s", e, exc_info=True)
            error_result = CheckResult(
                status=CheckStatus.FAIL,
                message=f"Unexpected error: {e}",
                suggestion="Check your network connection and try again.",
            )
            return error_result, error_result

    def _evaluate_production_session(self, prod_session: Optional[dict]) -> CheckResult:
        """Evaluate the production session check."""
        if not prod_session:
            return CheckResult(
                status=CheckStatus.FAIL,
                message="No production artifacts found",
                suggestion=(
                    "To upload production metadata:\n"
                    "  1. Check out your main branch:\n"
                    "     $ git checkout main\n"
                    "  2. Generate and upload production artifacts:\n"
                    "     $ dbt docs generate --target prod\n"
                    "     $ recce-cloud upload --type prod"
                ),
            )

        # Check if the session has actual data (adapter_type is not null)
        # An empty session created by default will have adapter_type=null
        if not prod_session.get("adapter_type"):
            return CheckResult(
                status=CheckStatus.FAIL,
                message="Production session exists but has no data",
                suggestion=(
                    "To upload production metadata:\n"
                    "  1. Check out your main branch:\n"
                    "     $ git checkout main\n"
                    "  2. Generate and upload production artifacts:\n"
                    "     $ dbt docs generate --target prod\n"
                    "     $ recce-cloud upload --type prod"
                ),
            )

        session_name = prod_session.get("name") or "(unnamed)"
        uploaded_at = prod_session.get("updated_at") or prod_session.get("created_at")

        return CheckResult(
            status=CheckStatus.PASS,
            details={
                "session_name": session_name,
                "uploaded_at": uploaded_at,
                "relative_time": self._format_relative_time(uploaded_at),
            },
        )

    def _evaluate_dev_sessions(self, dev_sessions: list) -> CheckResult:
        """Evaluate the dev session check."""
        if not dev_sessions:
            return CheckResult(
                status=CheckStatus.FAIL,
                message="No dev session found",
                suggestion=(
                    "To create and upload a dev session:\n"
                    "  1. Check out a feature branch with your changes:\n"
                    "     $ git checkout -b my-feature-branch\n"
                    "     (make some changes to your dbt models)\n"
                    "  2. Generate and upload dev artifacts:\n"
                    "     $ dbt docs generate\n"
                    "     $ recce-cloud upload --session-name my-feature-branch"
                ),
            )

        # Sort by updated_at/created_at to get most recent
        dev_sessions.sort(
            key=lambda x: x.get("updated_at") or x.get("created_at") or "",
            reverse=True,
        )
        latest_dev = dev_sessions[0]
        session_name = latest_dev.get("name") or "(unnamed)"
        uploaded_at = latest_dev.get("updated_at") or latest_dev.get("created_at")

        return CheckResult(
            status=CheckStatus.PASS,
            details={
                "session_name": session_name,
                "uploaded_at": uploaded_at,
                "relative_time": self._format_relative_time(uploaded_at),
            },
        )

    @staticmethod
    def _format_relative_time(iso_timestamp: Optional[str]) -> Optional[str]:
        """Format an ISO timestamp as a human-readable relative time."""
        if not iso_timestamp:
            return None

        try:
            # Parse ISO timestamp
            if iso_timestamp.endswith("Z"):
                dt = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
            else:
                dt = datetime.fromisoformat(iso_timestamp)

            now = datetime.now(timezone.utc)
            diff = now - dt

            seconds = diff.total_seconds()
            if seconds < 60:
                return "just now"
            elif seconds < 3600:
                mins = int(seconds / 60)
                return f"{mins}m ago"
            elif seconds < 86400:
                hours = int(seconds / 3600)
                return f"{hours}h ago"
            else:
                days = int(seconds / 86400)
                return f"{days}d ago"
        except (ValueError, TypeError):
            return None
