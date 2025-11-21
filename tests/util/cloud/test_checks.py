"""
Tests for recce.util.cloud.checks module.

These tests verify the ChecksCloud client functionality for managing
checks in Recce Cloud sessions.
"""

import unittest
from unittest.mock import Mock, patch

import pytest

from recce.util.cloud.checks import ChecksCloud
from recce.util.recce_cloud import RecceCloudException


class TestChecksCloud(unittest.TestCase):
    """Test suite for ChecksCloud class."""

    def setUp(self):
        """Test ChecksCloud initialization."""
        self.token = "test-token"
        self.client = ChecksCloud(self.token)

    def test_init_no_token(self):
        """Test ChecksCloud initialization without token raises ValueError."""
        with pytest.raises(ValueError, match="Token cannot be None"):
            ChecksCloud(token=None)

    @patch("recce.util.cloud.ChecksCloud._request")
    def test_list_checks_success(self, mock_request):
        """Test successful listing of checks."""
        # Arrange
        expected_checks = [
            {"id": "check1", "name": "Schema Check"},
            {"id": "check2", "name": "Value Check"},
        ]
        mock_response = Mock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {"checks": expected_checks}
        mock_request.return_value = mock_response

        # Act
        result = self.client.list_checks("org1", "proj1", "sess1")

        # Assert
        assert result == expected_checks
        self.assertEqual(len(result), len(expected_checks))

    @patch("recce.util.cloud.ChecksCloud._request")
    def test_list_checks_error(self, mock_request):
        """Test list_checks with API error."""
        # Arrange
        mock_response = Mock()
        mock_response.ok = False
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_request.return_value = mock_response

        # Test method and expect exception
        with self.assertRaises(RecceCloudException) as context:
            self.client.list_checks("org1", "proj1", "sess1")

        # Assertions
        self.assertIn("Failed to list checks from Recce Cloud.", str(context.exception))
        self.assertEqual(context.exception.status_code, 500)

    @patch("recce.util.cloud.ChecksCloud._request")
    def test_create_check_success(self, mock_request):
        """Test successful check creation."""
        # Arrange
        check_data = {"name": "New Check", "type": "schema_diff", "params": {"model": "customers"}}
        created_check = {"check": {**check_data, "id": "check123"}}
        mock_response = Mock()
        mock_response.ok = True
        mock_response.status_code = 201
        mock_response.json.return_value = created_check
        mock_request.return_value = mock_response

        # Act
        result = self.client.create_check("org1", "proj1", "sess1", check_data)

        # Assert
        assert result == created_check["check"]

    @patch("recce.util.cloud.ChecksCloud._request")
    def test_get_check_success(self, mock_request):
        """Test successful retrieval of a specific check."""
        # Arrange
        expected_check = {"check": {"id": "check123", "name": "Schema Check", "status": "approved"}}
        mock_response = Mock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = expected_check
        mock_request.return_value = mock_response

        # Act
        result = self.client.get_check("org1", "proj1", "sess1", "check123")

        # Assert
        assert result == expected_check["check"]

    @patch("recce.util.cloud.ChecksCloud._request")
    def test_get_check_not_found(self, mock_request):
        """Test get_check when check doesn't exist."""
        # Arrange
        mock_response = Mock()
        mock_response.ok = False
        mock_response.status_code = 404
        mock_response.text = "Check not found"
        mock_request.return_value = mock_response
        not_real_check_id = "not_real_404"

        # Act & Assert
        with self.assertRaises(RecceCloudException) as context:
            self.client.get_check("org1", "proj1", "sess1", not_real_check_id)

        self.assertIn(f"Failed to get check {not_real_check_id} from Recce Cloud.", str(context.exception))
        self.assertEqual(context.exception.status_code, 404)

    @patch("recce.util.cloud.ChecksCloud._request")
    def test_update_check_success(self, mock_request):
        """Test successful check update."""
        # Arrange
        update_data = {"status": "approved", "notes": "Looks good"}
        updated_check = {"check": {"id": "check123", "name": "Schema Check", **update_data}}
        mock_response = Mock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = updated_check
        mock_request.return_value = mock_response

        # Act
        result = self.client.update_check("org1", "proj1", "sess1", "check123", update_data)

        # Assert
        assert result == updated_check["check"]

    @patch("recce.util.cloud.ChecksCloud._request")
    def test_delete_check_success_204(self, mock_request):
        """Test successful check deletion with 204 No Content."""
        # Arrange
        mock_response = Mock()
        mock_response.ok = True
        mock_response.status_code = 204
        mock_request.return_value = mock_response

        # Act
        self.client.delete_check("org1", "proj1", "sess1", "check123")

        # Assert
        self.assertEqual(self.client._request.return_value.status_code, 204)

    @patch("recce.util.cloud.ChecksCloud._request")
    def test_delete_check_success_200(self, mock_request):
        """Test successful check deletion with 200 OK."""
        # Arrange
        mock_response = Mock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_request.return_value = mock_response

        # Act
        self.client.delete_check("org1", "proj1", "sess1", "check123")

        # Assert - should not raise an exception
        self.assertEqual(self.client._request.call_count, 1)

    @patch("recce.util.cloud.ChecksCloud._request")
    def test_delete_check_error(self, mock_request):
        """Test delete_check with API error."""
        # Arrange
        mock_response = Mock()
        mock_response.ok = False
        mock_response.status_code = 403
        mock_response.text = "Forbidden"
        mock_request.return_value = mock_response
        check_id = "check123"

        # Act & Assert
        with self.assertRaises(RecceCloudException) as context:
            self.client.delete_check("org1", "proj1", "sess1", check_id)

        # Assertions
        self.assertIn(f"Failed to delete check {check_id} from Recce Cloud.", str(context.exception))
        self.assertEqual(context.exception.status_code, 403)


class TestIntegrationWithRecceCloud:
    """Test integration between ChecksCloud and RecceCloud."""

    def test_recce_cloud_checks_property(self):
        """Test that RecceCloud can access checks client."""
        from recce.util.recce_cloud import RecceCloud

        cloud = RecceCloud(token="test-token")

        # Access checks property
        checks_client = cloud.checks

        # Verify it's a ChecksCloud instance
        assert isinstance(checks_client, ChecksCloud)
        assert checks_client.token == cloud.token
