"""Tests for the data review module."""

import unittest
from unittest.mock import MagicMock, patch

from recce_cloud.api.client import RecceCloudClient
from recce_cloud.api.exceptions import RecceCloudException
from recce_cloud.review import (
    ReviewResult,
    ReviewStatus,
    check_prerequisites,
    generate_data_review,
    generate_review_url,
    poll_task_status,
)


class TestReviewHelpers(unittest.TestCase):
    """Test helper functions in the review module."""

    def test_generate_review_url(self):
        """Test URL generation for data review."""
        url = generate_review_url("my-org", "my-project", "session-123")

        self.assertEqual(
            url,
            "https://cloud.datarecce.io/my-org/my-project/session-123/review",
        )

    def test_generate_review_url_with_special_chars(self):
        """Test URL generation with special characters."""
        url = generate_review_url("org-with-dash", "project_with_underscore", "uuid-session")

        self.assertIn("org-with-dash", url)
        self.assertIn("project_with_underscore", url)
        self.assertIn("uuid-session", url)


class TestCheckPrerequisites(unittest.TestCase):
    """Test the check_prerequisites function."""

    def setUp(self):
        """Set up test fixtures."""
        self.org_id = "org-123"
        self.project_id = "project-456"
        self.session_name = "test-session"

    def test_check_prerequisites_success(self):
        """Test prerequisites check when all conditions are met."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # Mock session lookup by name
        mock_client.get_session_by_name.return_value = {
            "id": "session-123",
            "name": self.session_name,
            "adapter_type": "postgres",
        }

        # Mock backend API call returning ready
        mock_client.check_prerequisites.return_value = {
            "success": True,
            "session_id": "session-123",
            "session_name": self.session_name,
            "adapter_type": "postgres",
            "has_base_session": True,
            "base_session_has_artifacts": True,
            "is_ready": True,
            "reason": None,
        }

        result = check_prerequisites(mock_client, self.org_id, self.project_id, self.session_name)

        self.assertTrue(result["success"])
        self.assertIsNotNone(result["session"])
        self.assertEqual(result["session"]["id"], "session-123")
        self.assertIsNone(result["error"])

    def test_check_prerequisites_session_not_found(self):
        """Test prerequisites check when session doesn't exist."""
        mock_client = MagicMock(spec=RecceCloudClient)
        mock_client.get_session_by_name.return_value = None

        result = check_prerequisites(mock_client, self.org_id, self.project_id, self.session_name)

        self.assertFalse(result["success"])
        self.assertIn("not found", result["error"])

    def test_check_prerequisites_session_no_artifacts(self):
        """Test prerequisites check when session has no artifacts."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # Session exists
        mock_client.get_session_by_name.return_value = {
            "id": "session-123",
            "name": self.session_name,
            "adapter_type": None,
        }

        # Backend API returns not ready due to no artifacts
        mock_client.check_prerequisites.return_value = {
            "success": True,
            "session_id": "session-123",
            "session_name": self.session_name,
            "adapter_type": None,
            "has_base_session": False,
            "base_session_has_artifacts": False,
            "is_ready": False,
            "reason": "Session has no artifacts uploaded. Please run 'recce-cloud upload' first.",
        }

        result = check_prerequisites(mock_client, self.org_id, self.project_id, self.session_name)

        self.assertFalse(result["success"])
        self.assertIn("no artifacts uploaded", result["error"])

    def test_check_prerequisites_no_base_session(self):
        """Test prerequisites check when base session doesn't exist."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # Target session exists with artifacts
        mock_client.get_session_by_name.return_value = {
            "id": "session-123",
            "name": self.session_name,
            "adapter_type": "postgres",
        }

        # Backend API returns not ready due to missing base session
        mock_client.check_prerequisites.return_value = {
            "success": True,
            "session_id": "session-123",
            "session_name": self.session_name,
            "adapter_type": "postgres",
            "has_base_session": False,
            "base_session_has_artifacts": False,
            "is_ready": False,
            "reason": "No base (production) session found. Please upload production artifacts first using 'recce-cloud upload --type prod'.",
        }

        result = check_prerequisites(mock_client, self.org_id, self.project_id, self.session_name)

        self.assertFalse(result["success"])
        self.assertIn("base", result["error"].lower())

    def test_check_prerequisites_base_session_no_artifacts(self):
        """Test prerequisites check when base session has no artifacts."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # Target session exists with artifacts
        mock_client.get_session_by_name.return_value = {
            "id": "session-123",
            "name": self.session_name,
            "adapter_type": "postgres",
        }

        # Backend API returns not ready due to base session missing artifacts
        mock_client.check_prerequisites.return_value = {
            "success": True,
            "session_id": "session-123",
            "session_name": self.session_name,
            "adapter_type": "postgres",
            "has_base_session": True,
            "base_session_has_artifacts": False,
            "is_ready": False,
            "reason": "Base session has no artifacts uploaded. Please run 'recce-cloud upload --type prod' first.",
        }

        result = check_prerequisites(mock_client, self.org_id, self.project_id, self.session_name)

        self.assertFalse(result["success"])
        self.assertIn("Base session has no artifacts", result["error"])

    def test_check_prerequisites_api_error_on_session_lookup(self):
        """Test prerequisites check when session lookup API throws an error."""
        mock_client = MagicMock(spec=RecceCloudClient)
        mock_client.get_session_by_name.side_effect = RecceCloudException(reason="API error", status_code=500)

        result = check_prerequisites(mock_client, self.org_id, self.project_id, self.session_name)

        self.assertFalse(result["success"])
        self.assertIn("Failed to find session", result["error"])

    def test_check_prerequisites_api_error_on_check(self):
        """Test prerequisites check when check_prerequisites API throws an error."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # Session lookup succeeds
        mock_client.get_session_by_name.return_value = {
            "id": "session-123",
            "name": self.session_name,
            "adapter_type": "postgres",
        }

        # But check_prerequisites API fails
        mock_client.check_prerequisites.side_effect = RecceCloudException(reason="Server error", status_code=500)

        result = check_prerequisites(mock_client, self.org_id, self.project_id, self.session_name)

        self.assertFalse(result["success"])
        self.assertIn("Failed to check prerequisites", result["error"])

    def test_check_prerequisites_with_session_id_directly(self):
        """Test prerequisites check when session_id is provided directly (skip name lookup)."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # Backend API call returning ready
        mock_client.check_prerequisites.return_value = {
            "success": True,
            "session_id": "direct-session-id",
            "session_name": "resolved-session-name",
            "adapter_type": "postgres",
            "has_base_session": True,
            "base_session_has_artifacts": True,
            "is_ready": True,
            "reason": None,
        }

        result = check_prerequisites(
            mock_client,
            self.org_id,
            self.project_id,
            session_id="direct-session-id",
        )

        self.assertTrue(result["success"])
        self.assertIsNotNone(result["session"])
        self.assertEqual(result["session"]["id"], "direct-session-id")
        self.assertEqual(result["session"]["name"], "resolved-session-name")
        self.assertIsNone(result["error"])

        # Verify get_session_by_name was NOT called (session_id skips this lookup)
        mock_client.get_session_by_name.assert_not_called()
        # Verify check_prerequisites API was called with the session_id
        mock_client.check_prerequisites.assert_called_once_with(self.org_id, self.project_id, "direct-session-id")

    def test_check_prerequisites_with_neither_session_id_nor_name(self):
        """Test prerequisites check fails when neither session_id nor session_name provided."""
        mock_client = MagicMock(spec=RecceCloudClient)

        result = check_prerequisites(
            mock_client,
            self.org_id,
            self.project_id,
            # Neither session_name nor session_id provided
        )

        self.assertFalse(result["success"])
        self.assertIn("Either session_id or session_name must be provided", result["error"])

        # Verify no API calls were made
        mock_client.get_session_by_name.assert_not_called()
        mock_client.check_prerequisites.assert_not_called()

    def test_check_prerequisites_with_session_id_api_error(self):
        """Test prerequisites check when using session_id directly and API fails."""
        mock_client = MagicMock(spec=RecceCloudClient)

        mock_client.check_prerequisites.side_effect = RecceCloudException(reason="Session not found", status_code=404)

        result = check_prerequisites(
            mock_client,
            self.org_id,
            self.project_id,
            session_id="nonexistent-session-id",
        )

        self.assertFalse(result["success"])
        self.assertIn("Failed to check prerequisites", result["error"])

        # Verify get_session_by_name was NOT called
        mock_client.get_session_by_name.assert_not_called()


class TestPollTaskStatus(unittest.TestCase):
    """Test the poll_task_status function."""

    def setUp(self):
        """Set up test fixtures."""
        self.org_id = "org-123"
        self.task_id = "task-456"

    @patch("recce_cloud.review.time.sleep")
    def test_poll_task_status_success(self, mock_sleep):
        """Test polling when task completes successfully."""
        mock_client = MagicMock(spec=RecceCloudClient)
        mock_client.get_task_status.return_value = {
            "status": "completed",
            "metadata": {},
        }

        result = poll_task_status(mock_client, self.org_id, self.task_id, poll_interval=1, timeout=10)

        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "completed")
        self.assertIsNone(result["error"])

    @patch("recce_cloud.review.time.sleep")
    @patch("recce_cloud.review.time.time")
    def test_poll_task_status_with_progress(self, mock_time, mock_sleep):
        """Test polling with progress callback."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # Simulate time progression
        mock_time.side_effect = [0, 1, 2, 3]

        # First call returns pending, second returns completed
        mock_client.get_task_status.side_effect = [
            {"status": "pending", "metadata": {}},
            {"status": "completed", "metadata": {}},
        ]

        progress_calls = []

        def progress_callback(status):
            progress_calls.append(status["status"])

        result = poll_task_status(
            mock_client,
            self.org_id,
            self.task_id,
            poll_interval=1,
            timeout=10,
            progress_callback=progress_callback,
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "completed")
        self.assertEqual(progress_calls, ["pending", "completed"])

    @patch("recce_cloud.review.time.sleep")
    def test_poll_task_status_failed(self, mock_sleep):
        """Test polling when task fails."""
        mock_client = MagicMock(spec=RecceCloudClient)
        mock_client.get_task_status.return_value = {
            "status": "failed",
            "metadata": {"error": "Something went wrong"},
        }

        result = poll_task_status(mock_client, self.org_id, self.task_id, poll_interval=1, timeout=10)

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "failed")
        self.assertIn("Something went wrong", result["error"])

    @patch("recce_cloud.review.time.sleep")
    @patch("recce_cloud.review.time.time")
    def test_poll_task_status_timeout(self, mock_time, mock_sleep):
        """Test polling when timeout is reached."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # Simulate time progression past timeout
        mock_time.side_effect = [0, 301]  # Start at 0, then past 300 second timeout

        mock_client.get_task_status.return_value = {
            "status": "pending",
            "metadata": {},
        }

        result = poll_task_status(mock_client, self.org_id, self.task_id, poll_interval=1, timeout=300)

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "timeout")
        self.assertIn("timed out", result["error"])

    @patch("recce_cloud.review.time.sleep")
    def test_poll_task_status_api_error(self, mock_sleep):
        """Test polling when API throws an error."""
        mock_client = MagicMock(spec=RecceCloudClient)
        mock_client.get_task_status.side_effect = RecceCloudException(reason="API error", status_code=500)

        result = poll_task_status(mock_client, self.org_id, self.task_id, poll_interval=1, timeout=10)

        self.assertFalse(result["success"])
        self.assertEqual(result["status"], "error")
        self.assertIn("Failed to get task status", result["error"])


class TestGenerateDataReview(unittest.TestCase):
    """Test the generate_data_review function."""

    def setUp(self):
        """Set up test fixtures."""
        self.org_id = "org-123"
        self.project_id = "project-456"
        self.session = {
            "id": "session-789",
            "name": "test-session",
            "adapter_type": "postgres",
        }
        self.console = MagicMock()

    def test_generate_data_review_already_exists(self):
        """Test when review already exists and regenerate is False."""
        mock_client = MagicMock(spec=RecceCloudClient)
        mock_client.get_data_review.return_value = {
            "session_id": "session-789",
            "summary": "# Existing Review",
        }

        result = generate_data_review(
            self.console,
            mock_client,
            self.org_id,
            self.project_id,
            self.session,
            regenerate=False,
            json_output=True,
        )

        self.assertEqual(result.status, ReviewStatus.ALREADY_EXISTS)
        self.assertEqual(result.session_id, "session-789")
        self.assertIn("review", result.review_url)

    @patch("recce_cloud.review.poll_task_status")
    def test_generate_data_review_success(self, mock_poll):
        """Test successful data review generation."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # No existing review (returns None for 404), then return review after generation
        mock_client.get_data_review.side_effect = [
            None,  # First call - no existing review
            {"session_id": "session-789", "summary": "# New Review"},  # After generation
        ]

        # No running task
        mock_client.get_running_task.return_value = None

        # Trigger returns task_id
        mock_client.generate_data_review.return_value = {"task_id": "task-123"}

        # Poll completes successfully
        mock_poll.return_value = {"success": True, "status": "completed", "task": {}}

        result = generate_data_review(
            self.console,
            mock_client,
            self.org_id,
            self.project_id,
            self.session,
            regenerate=False,
            json_output=True,
        )

        self.assertEqual(result.status, ReviewStatus.SUCCEEDED)
        self.assertEqual(result.task_id, "task-123")

    @patch("recce_cloud.review.poll_task_status")
    def test_generate_data_review_with_regenerate(self, mock_poll):
        """Test data review generation with regenerate flag."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # No running task
        mock_client.get_running_task.return_value = None

        # Trigger returns task_id
        mock_client.generate_data_review.return_value = {"task_id": "task-456"}

        # Poll completes successfully
        mock_poll.return_value = {"success": True, "status": "completed", "task": {}}

        # Return new review
        mock_client.get_data_review.return_value = {
            "session_id": "session-789",
            "summary": "# Regenerated Review",
        }

        result = generate_data_review(
            self.console,
            mock_client,
            self.org_id,
            self.project_id,
            self.session,
            regenerate=True,
            json_output=True,
        )

        self.assertEqual(result.status, ReviewStatus.SUCCEEDED)

        # Verify regenerate was passed to generate_data_review
        mock_client.generate_data_review.assert_called_once()
        call_args = mock_client.generate_data_review.call_args
        self.assertTrue(call_args[1]["regenerate"])

    @patch("recce_cloud.review.poll_task_status")
    def test_generate_data_review_task_already_running(self, mock_poll):
        """Test when a task is already running."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # No existing review (returns None for 404), then return review after generation
        mock_client.get_data_review.side_effect = [
            None,  # First call - no existing review
            {"session_id": "session-789", "summary": "# Review"},  # After generation
        ]

        # Task already running
        mock_client.get_running_task.return_value = {
            "task_id": "existing-task-123",
            "status": "processing",
        }

        # Poll completes successfully
        mock_poll.return_value = {"success": True, "status": "completed", "task": {}}

        result = generate_data_review(
            self.console,
            mock_client,
            self.org_id,
            self.project_id,
            self.session,
            regenerate=False,
            json_output=True,
        )

        self.assertEqual(result.status, ReviewStatus.SUCCEEDED)

        # Verify generate_data_review was NOT called (used existing task)
        mock_client.generate_data_review.assert_not_called()

    @patch("recce_cloud.review.poll_task_status")
    def test_generate_data_review_timeout(self, mock_poll):
        """Test when review generation times out."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # No existing review (returns None for 404)
        mock_client.get_data_review.return_value = None

        # No running task
        mock_client.get_running_task.return_value = None

        # Trigger returns task_id
        mock_client.generate_data_review.return_value = {"task_id": "task-123"}

        # Poll times out
        mock_poll.return_value = {
            "success": False,
            "status": "timeout",
            "error": "Task timed out after 300 seconds",
            "task": None,
        }

        result = generate_data_review(
            self.console,
            mock_client,
            self.org_id,
            self.project_id,
            self.session,
            regenerate=False,
            timeout=300,
            json_output=True,
        )

        self.assertEqual(result.status, ReviewStatus.TIMEOUT)
        self.assertIn("timed out", result.error_message)

    def test_generate_data_review_trigger_failure(self):
        """Test when triggering review generation fails."""
        mock_client = MagicMock(spec=RecceCloudClient)

        # No existing review (returns None for 404)
        mock_client.get_data_review.return_value = None

        # No running task
        mock_client.get_running_task.return_value = None

        # Trigger fails
        mock_client.generate_data_review.side_effect = RecceCloudException(reason="Missing artifacts", status_code=400)

        result = generate_data_review(
            self.console,
            mock_client,
            self.org_id,
            self.project_id,
            self.session,
            regenerate=False,
            json_output=True,
        )

        self.assertEqual(result.status, ReviewStatus.FAILED)
        self.assertIn("Failed to trigger", result.error_message)


class TestReviewResult(unittest.TestCase):
    """Test the ReviewResult dataclass."""

    def test_review_result_defaults(self):
        """Test ReviewResult with default values."""
        result = ReviewResult(status=ReviewStatus.SUCCEEDED)

        self.assertEqual(result.status, ReviewStatus.SUCCEEDED)
        self.assertIsNone(result.session_id)
        self.assertIsNone(result.session_name)
        self.assertIsNone(result.review_url)
        self.assertIsNone(result.task_id)
        self.assertIsNone(result.error_message)
        self.assertIsNone(result.summary)

    def test_review_result_all_fields(self):
        """Test ReviewResult with all fields populated."""
        result = ReviewResult(
            status=ReviewStatus.SUCCEEDED,
            session_id="session-123",
            session_name="test-session",
            review_url="https://cloud.datarecce.io/org/project/sessions/session-123/review",
            task_id="task-456",
            error_message=None,
            summary="# Review Summary",
        )

        self.assertEqual(result.status, ReviewStatus.SUCCEEDED)
        self.assertEqual(result.session_id, "session-123")
        self.assertEqual(result.session_name, "test-session")
        self.assertIn("session-123", result.review_url)
        self.assertEqual(result.task_id, "task-456")
        self.assertEqual(result.summary, "# Review Summary")


class TestReviewStatus(unittest.TestCase):
    """Test the ReviewStatus enum."""

    def test_review_status_values(self):
        """Test ReviewStatus enum values align with Recce Cloud backend."""
        # Terminal states
        self.assertEqual(ReviewStatus.SUCCEEDED.value, "SUCCEEDED")
        self.assertEqual(ReviewStatus.FAILED.value, "FAILED")
        # CLI-specific states
        self.assertEqual(ReviewStatus.ALREADY_EXISTS.value, "ALREADY_EXISTS")
        self.assertEqual(ReviewStatus.TIMEOUT.value, "TIMEOUT")
        # In-progress states
        self.assertEqual(ReviewStatus.QUEUED.value, "QUEUED")
        self.assertEqual(ReviewStatus.SCHEDULED.value, "SCHEDULED")
        self.assertEqual(ReviewStatus.RUNNING.value, "RUNNING")


if __name__ == "__main__":
    unittest.main()
