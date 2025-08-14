import unittest
from unittest.mock import Mock, patch

from recce.exceptions import RecceException
from recce.state import CloudStateLoader, RecceState
from recce.state.const import (
    RECCE_CLOUD_PASSWORD_MISSING,
    RECCE_CLOUD_TOKEN_MISSING,
)


class TestCloudStateLoader(unittest.TestCase):

    def test_init_with_defaults(self):
        with self.assertRaises(RecceException):
            CloudStateLoader()

    @patch("recce.state.state_loader.fetch_pr_metadata")
    def test_init_with_github_token(self, mock_fetch_pr):
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_pr_info.repository = "owner/repo"
        mock_fetch_pr.return_value = mock_pr_info

        cloud_options = {"github_token": "test_token"}
        loader = CloudStateLoader(cloud_options=cloud_options)

        self.assertTrue(loader.cloud_mode)
        self.assertEqual(loader.catalog, "github")
        self.assertEqual(loader.pr_info, mock_pr_info)

    def test_init_with_api_token(self):
        cloud_options = {"api_token": "test_api_token", "share_id": "test_share"}
        loader = CloudStateLoader(cloud_options=cloud_options)

        self.assertTrue(loader.cloud_mode)
        self.assertEqual(loader.catalog, "preview")
        self.assertEqual(loader.share_id, "test_share")

    @patch("recce.state.state_loader.fetch_pr_metadata")
    def test_verify_github_mode_success(self, mock_fetch_pr):
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_fetch_pr.return_value = mock_pr_info

        cloud_options = {"github_token": "test_token", "password": "test_pass"}
        loader = CloudStateLoader(cloud_options=cloud_options)

        self.assertTrue(loader.verify())

    def test_verify_github_mode_missing_token(self):
        # Test that creating CloudStateLoader without tokens raises exception
        with self.assertRaises(RecceException) as cm:
            CloudStateLoader(cloud_options={})

        self.assertEqual(str(cm.exception), RECCE_CLOUD_TOKEN_MISSING.error_message)

    @patch("recce.state.state_loader.fetch_pr_metadata")
    def test_verify_github_mode_missing_password(self, mock_fetch_pr):
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_fetch_pr.return_value = mock_pr_info

        cloud_options = {"github_token": "test_token"}
        loader = CloudStateLoader(cloud_options=cloud_options)

        self.assertFalse(loader.verify())
        self.assertEqual(loader.error_message, RECCE_CLOUD_PASSWORD_MISSING.error_message)
        self.assertEqual(loader.hint_message, RECCE_CLOUD_PASSWORD_MISSING.hint_message)

    def test_verify_preview_mode_success(self):
        cloud_options = {"api_token": "test_token", "share_id": "test_share"}
        loader = CloudStateLoader(cloud_options=cloud_options)
        loader.catalog = "preview"

        self.assertTrue(loader.verify())

    def test_verify_preview_mode_missing_token(self):
        # Test that creating CloudStateLoader without api_token raises exception
        with self.assertRaises(RecceException) as cm:
            CloudStateLoader(cloud_options={"share_id": "test_share"})

        self.assertEqual(str(cm.exception), RECCE_CLOUD_TOKEN_MISSING.error_message)

    def test_verify_preview_mode_missing_share_id(self):
        cloud_options = {"api_token": "test_token"}
        loader = CloudStateLoader(cloud_options=cloud_options)
        loader.catalog = "preview"
        loader.cloud_options = cloud_options

        self.assertFalse(loader.verify())
        self.assertEqual(loader.error_message, "No share ID is provided for the preview catalog.")

    @patch("recce.state.cloud.RecceCloud")
    @patch("requests.get")
    def test_load_state_from_recce_cloud_github_success(self, mock_get, mock_recce_cloud):
        # Setup
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_pr_info.repository = "owner/repo"

        loader = CloudStateLoader(cloud_options={"api_token": "token"})
        loader.catalog = "github"
        loader.pr_info = mock_pr_info
        loader.cloud_options = {"password": "test_pass"}

        # Mock RecceCloud
        mock_cloud_instance = Mock()
        mock_recce_cloud.return_value = mock_cloud_instance
        mock_cloud_instance.get_presigned_url_by_github_repo.return_value = "http://presigned.url"

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'{"runs": [], "checks": []}'
        mock_get.return_value = mock_response

        # Mock RecceState.from_file
        with patch("recce.state.cloud.RecceState") as mock_recce_state:
            mock_state = Mock()
            mock_recce_state.from_file.return_value = mock_state

            result = loader._load_state_from_recce_cloud()

            self.assertEqual(result, mock_state)
            mock_get.assert_called_once()
            mock_cloud_instance.get_presigned_url_by_github_repo.assert_called_once()

    @patch("recce.state.cloud.RecceCloud")
    @patch("requests.get")
    def test_load_state_from_recce_cloud_preview_success(self, mock_get, mock_recce_cloud):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"
        loader.cloud_options = {"share_id": "test_share"}

        # Mock RecceCloud
        mock_cloud_instance = Mock()
        mock_recce_cloud.return_value = mock_cloud_instance
        mock_cloud_instance.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'{"runs": [], "checks": []}'
        mock_get.return_value = mock_response

        # Mock RecceState.from_file
        with patch("recce.state.cloud.RecceState") as mock_recce_state:
            mock_state = Mock()
            mock_recce_state.from_file.return_value = mock_state

            result = loader._load_state_from_recce_cloud()

            self.assertEqual(result, mock_state)
            mock_cloud_instance.get_presigned_url_by_share_id.assert_called_once()

    @patch("recce.state.cloud.RecceCloud")
    @patch("requests.get")
    def test_load_state_from_recce_cloud_404_error(self, mock_get, mock_recce_cloud):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"

        # Mock RecceCloud
        mock_cloud_instance = Mock()
        mock_recce_cloud.return_value = mock_cloud_instance
        mock_cloud_instance.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP 404 response
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        result = loader._load_state_from_recce_cloud()

        self.assertIsNone(result)
        self.assertEqual(loader.error_message, "The state file is not found in Recce Cloud.")

    @patch("recce.state.cloud.RecceCloud")
    @patch("requests.get")
    def test_load_state_from_recce_cloud_auth_error(self, mock_get, mock_recce_cloud):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"

        # Mock RecceCloud
        mock_cloud_instance = Mock()
        mock_recce_cloud.return_value = mock_cloud_instance
        mock_cloud_instance.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP 401 response
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_get.return_value = mock_response

        with self.assertRaises(RecceException) as cm:
            loader._load_state_from_recce_cloud()

        self.assertIn("401 Failed to download", str(cm.exception))

    @patch("recce.state.cloud.RecceCloud")
    @patch("requests.put")
    def test_export_state_to_recce_cloud_github_success(self, mock_put, mock_recce_cloud):
        # Setup
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_pr_info.repository = "owner/repo"

        loader = CloudStateLoader(cloud_options={"api_token": "token"})
        loader.catalog = "github"
        loader.pr_info = mock_pr_info
        loader.cloud_options = {"password": "test_pass"}
        loader.state = RecceState()

        # Mock RecceCloud
        mock_cloud_instance = Mock()
        mock_recce_cloud.return_value = mock_cloud_instance
        mock_cloud_instance.get_presigned_url_by_github_repo.return_value = "http://presigned.url"

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response

        result = loader._export_state_to_recce_cloud()

        self.assertIsNone(result)  # Success returns None
        mock_put.assert_called_once()
        mock_cloud_instance.get_presigned_url_by_github_repo.assert_called_once()

    @patch("recce.state.cloud.RecceCloud")
    @patch("requests.put")
    def test_export_state_to_recce_cloud_preview_success(self, mock_put, mock_recce_cloud):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"
        loader.cloud_options = {"share_id": "test_share"}
        loader.state = RecceState()

        # Mock RecceCloud
        mock_cloud_instance = Mock()
        mock_recce_cloud.return_value = mock_cloud_instance
        mock_cloud_instance.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response

        result = loader._export_state_to_recce_cloud()

        self.assertIsNone(result)  # Success returns None
        mock_cloud_instance.get_presigned_url_by_share_id.assert_called_once()

    @patch("recce.state.cloud.RecceCloud")
    @patch("requests.put")
    def test_export_state_to_recce_cloud_failure(self, mock_put, mock_recce_cloud):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"
        loader.cloud_options = {"share_id": "test_share"}
        loader.state = RecceState()

        # Mock RecceCloud
        mock_cloud_instance = Mock()
        mock_recce_cloud.return_value = mock_cloud_instance
        mock_cloud_instance.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP error response
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_put.return_value = mock_response

        result = loader._export_state_to_recce_cloud()

        self.assertIn("Failed to upload", result)
        self.assertIn("Internal Server Error", result)

    @patch("recce.state.cloud.RecceCloudStateManager")
    def test_purge_success(self, mock_manager_class):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token"})

        # Mock manager instance
        mock_manager = Mock()
        mock_manager_class.return_value = mock_manager
        mock_manager.purge_cloud_state.return_value = (True, None)

        result = loader.purge()

        self.assertTrue(result)
        self.assertIsNone(loader.error_message)

    @patch("recce.state.cloud.RecceCloudStateManager")
    def test_purge_failure(self, mock_manager_class):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token"})

        # Mock manager instance
        mock_manager = Mock()
        mock_manager_class.return_value = mock_manager
        mock_manager.purge_cloud_state.return_value = (False, "Purge failed")

        result = loader.purge()

        self.assertFalse(result)
        self.assertEqual(loader.error_message, "Purge failed")

    @patch("recce.state.cloud.RecceCloud")
    def test_get_metadata_from_recce_cloud(self, mock_recce_cloud):
        # Setup
        mock_pr_info = Mock()
        loader = CloudStateLoader(cloud_options={"api_token": "token"})
        loader.pr_info = mock_pr_info

        # Mock RecceCloud
        mock_cloud_instance = Mock()
        mock_recce_cloud.return_value = mock_cloud_instance
        mock_metadata = {"etag": "test_etag", "total_checks": 5}
        mock_cloud_instance.get_artifact_metadata.return_value = mock_metadata

        result = loader._get_metadata_from_recce_cloud()

        self.assertEqual(result, mock_metadata)
        mock_cloud_instance.get_artifact_metadata.assert_called_once_with(pr_info=mock_pr_info)

    def test_get_metadata_from_recce_cloud_no_pr_info(self):
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test"})
        loader.pr_info = None

        result = loader._get_metadata_from_recce_cloud()

        self.assertIsNone(result)

    def test_inheritance_from_state_loader(self):
        from recce.state import RecceStateLoader

        cloud_options = {"api_token": "test_token", "share_id": "test_share"}
        loader = CloudStateLoader(cloud_options=cloud_options)
        self.assertIsInstance(loader, RecceStateLoader)

    @patch("recce.state.state_loader.fetch_pr_metadata")
    def test_load_state_calls_load_state_from_cloud(self, mock_fetch_pr):
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_fetch_pr.return_value = mock_pr_info

        loader = CloudStateLoader(cloud_options={"github_token": "token", "password": "pass"})

        with patch.object(loader, "_load_state_from_cloud") as mock_load:
            mock_load.return_value = (RecceState(), "etag")
            result = loader._load_state()

            mock_load.assert_called_once()
            self.assertIsInstance(result[0], RecceState)

    @patch("recce.state.state_loader.fetch_pr_metadata")
    def test_export_state_calls_export_state_to_cloud(self, mock_fetch_pr):
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_fetch_pr.return_value = mock_pr_info

        loader = CloudStateLoader(cloud_options={"github_token": "token", "password": "pass"})
        loader.state = RecceState()

        with patch.object(loader, "_export_state_to_cloud") as mock_export:
            mock_export.return_value = ("message", "etag")
            result = loader._export_state()

            mock_export.assert_called_once()
            self.assertEqual(result, ("message", "etag"))


if __name__ == "__main__":
    unittest.main()
