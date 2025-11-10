import unittest
from unittest.mock import Mock, patch

from recce.exceptions import RecceException
from recce.state import CloudStateLoader, RecceState
from recce.state.const import (
    RECCE_API_TOKEN_MISSING,
    RECCE_CLOUD_PASSWORD_MISSING,
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

        self.assertEqual(str(cm.exception), RECCE_API_TOKEN_MISSING.error_message)

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

        self.assertEqual(str(cm.exception), RECCE_API_TOKEN_MISSING.error_message)

    def test_verify_preview_mode_missing_share_id(self):
        cloud_options = {"api_token": "test_token"}
        loader = CloudStateLoader(cloud_options=cloud_options)
        loader.catalog = "preview"
        loader.cloud_options = cloud_options

        self.assertFalse(loader.verify())
        self.assertEqual(loader.error_message, "No share ID is provided for the preview catalog.")

    @patch("requests.get")
    def test_load_state_from_github_success(self, mock_get):
        # Setup
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_pr_info.repository = "owner/repo"

        loader = CloudStateLoader(cloud_options={"api_token": "token"})
        loader.catalog = "github"
        loader.pr_info = mock_pr_info
        loader.cloud_options = {"password": "test_pass"}

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()
        loader.recce_cloud.get_presigned_url_by_github_repo.return_value = "http://presigned.url"
        loader.recce_cloud.get_artifact_metadata.return_value = {"etag": "test_etag"}

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'{"runs": [], "checks": []}'
        mock_get.return_value = mock_response

        # Mock RecceState.from_file
        with patch("recce.state.cloud.RecceState") as mock_recce_state:
            mock_state = Mock()
            mock_recce_state.from_file.return_value = mock_state

            result_state, result_etag = loader._load_state_from_github()

            self.assertEqual(result_state, mock_state)
            self.assertEqual(result_etag, "test_etag")
            mock_get.assert_called_once()
            loader.recce_cloud.get_presigned_url_by_github_repo.assert_called_once()

    @patch("requests.get")
    def test_load_state_from_preview_success(self, mock_get):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"
        loader.share_id = "test_share"

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()
        loader.recce_cloud.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'{"runs": [], "checks": []}'
        mock_get.return_value = mock_response

        # Mock RecceState.from_file
        with patch("recce.state.cloud.RecceState") as mock_recce_state:
            mock_state = Mock()
            mock_recce_state.from_file.return_value = mock_state

            result_state, result_etag = loader._load_state_from_preview()

            self.assertEqual(result_state, mock_state)
            self.assertIsNone(result_etag)  # Preview doesn't use etag
            loader.recce_cloud.get_presigned_url_by_share_id.assert_called_once()

    @patch("requests.get")
    def test_load_state_from_preview_404_error(self, mock_get):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"
        loader.share_id = "test_share"

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()
        loader.recce_cloud.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP 404 response
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        result_state, result_etag = loader._load_state_from_preview()

        self.assertIsNone(result_state)
        self.assertIsNone(result_etag)
        self.assertEqual(loader.error_message, "The state file is not found in Recce Cloud.")

    @patch("requests.get")
    def test_load_state_from_preview_auth_error(self, mock_get):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"
        loader.share_id = "test_share"

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()
        loader.recce_cloud.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP 401 response
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_get.return_value = mock_response

        with self.assertRaises(RecceException) as cm:
            loader._load_state_from_preview()

        self.assertIn("401 Failed to download", str(cm.exception))

    @patch("recce.state.cloud.CheckDAO")
    @patch("requests.put")
    def test_export_state_to_github_success(self, mock_put, mock_check_dao):
        # Setup
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_pr_info.repository = "owner/repo"

        loader = CloudStateLoader(cloud_options={"api_token": "token"})
        loader.catalog = "github"
        loader.pr_info = mock_pr_info
        loader.cloud_options = {"password": "test_pass"}
        loader.state = RecceState()

        # Mock CheckDAO
        mock_check_dao_instance = Mock()
        mock_check_dao.return_value = mock_check_dao_instance
        mock_check_dao_instance.status.return_value = {"total": 5, "approved": 3}

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()
        loader.recce_cloud.get_presigned_url_by_github_repo.return_value = "http://presigned.url"
        loader.recce_cloud.get_artifact_metadata.return_value = {"etag": "test_etag"}

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response

        result_message, result_etag = loader._export_state_to_github()

        self.assertIsNone(result_message)  # Success returns None
        self.assertEqual(result_etag, "test_etag")
        mock_put.assert_called_once()
        loader.recce_cloud.get_presigned_url_by_github_repo.assert_called_once()

    @patch("requests.put")
    def test_export_state_to_preview_success(self, mock_put):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"
        loader.cloud_options = {"share_id": "test_share"}
        loader.state = RecceState()

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()
        loader.recce_cloud.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response

        result_message, result_etag = loader._export_state_to_preview()

        self.assertIsNone(result_message)  # Success returns None
        self.assertIsNone(result_etag)  # Preview doesn't use etag
        loader.recce_cloud.get_presigned_url_by_share_id.assert_called_once()

    @patch("requests.put")
    def test_export_state_to_preview_failure(self, mock_put):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "share_id": "test_share"})
        loader.catalog = "preview"
        loader.cloud_options = {"share_id": "test_share"}
        loader.state = RecceState()

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()
        loader.recce_cloud.get_presigned_url_by_share_id.return_value = "http://presigned.url"

        # Mock HTTP error response
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_put.return_value = mock_response

        result_message, result_etag = loader._export_state_to_preview()

        self.assertIn("Failed to upload", result_message)
        self.assertIn("Internal Server Error", result_message)
        self.assertIsNone(result_etag)

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

    def test_get_metadata_from_recce_cloud(self):
        # Setup
        mock_pr_info = Mock()
        loader = CloudStateLoader(cloud_options={"api_token": "token"})
        loader.pr_info = mock_pr_info

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()
        mock_metadata = {"etag": "test_etag", "total_checks": 5}
        loader.recce_cloud.get_artifact_metadata.return_value = mock_metadata

        result = loader._get_metadata_from_recce_cloud()

        self.assertEqual(result, mock_metadata)
        loader.recce_cloud.get_artifact_metadata.assert_called_once_with(pr_info=mock_pr_info)

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

    def test_token_property_github(self):
        cloud_options = {"api_token": "test_api_token", "share_id": "test_share"}
        loader = CloudStateLoader(cloud_options=cloud_options)
        loader.cloud_options = {"github_token": "github_token_value"}
        self.assertEqual(loader.token, "github_token_value")

    def test_token_property_api(self):
        cloud_options = {"api_token": "api_token_value", "share_id": "test_share"}
        loader = CloudStateLoader(cloud_options=cloud_options)
        self.assertEqual(loader.token, "api_token_value")

    def test_token_property_both_tokens(self):
        cloud_options = {"api_token": "test_api_token", "share_id": "test_share"}
        loader = CloudStateLoader(cloud_options=cloud_options)
        loader.cloud_options = {"github_token": "github_token", "api_token": "api_token"}
        # Should return github_token first
        self.assertEqual(loader.token, "github_token")

    def test_init_with_session_id(self):
        cloud_options = {"api_token": "test_api_token", "session_id": "test_session"}
        loader = CloudStateLoader(cloud_options=cloud_options)

        self.assertTrue(loader.cloud_mode)
        self.assertEqual(loader.catalog, "session")
        self.assertEqual(loader.session_id, "test_session")

    def test_verify_session_mode_success(self):
        cloud_options = {"api_token": "test_token", "session_id": "test_session"}
        loader = CloudStateLoader(cloud_options=cloud_options)
        loader.catalog = "session"

        self.assertTrue(loader.verify())

    def test_verify_session_mode_missing_token(self):
        # Test that creating CloudStateLoader without api_token raises exception
        with self.assertRaises(RecceException) as cm:
            CloudStateLoader(cloud_options={"session_id": "test_session"})

        self.assertEqual(str(cm.exception), RECCE_API_TOKEN_MISSING.error_message)

    def test_verify_session_mode_missing_session_id(self):
        cloud_options = {"api_token": "test_token"}
        loader = CloudStateLoader(cloud_options=cloud_options)
        loader.catalog = "session"
        loader.cloud_options = cloud_options

        self.assertFalse(loader.verify())
        self.assertEqual(loader.error_message, "No session ID is provided for the session catalog.")

    @patch("requests.get")
    def test_load_state_from_session_success_with_existing_state(self, mock_get):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "session_id": "test_session"})
        loader.catalog = "session"
        loader.session_id = "test_session"

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()

        # Mock get_session response
        mock_session = {"org_id": "org1", "project_id": "proj1"}
        loader.recce_cloud.get_session.return_value = mock_session

        # Mock get_download_urls_by_session_id response
        mock_download_urls = {
            "manifest_url": "http://manifest.url",
            "catalog_url": "http://catalog.url",
            "recce_state_url": "http://recce_state.url",
        }
        loader.recce_cloud.get_download_urls_by_session_id.return_value = mock_download_urls

        # Mock get_base_session_download_urls response
        mock_base_urls = {"manifest_url": "http://base_manifest.url", "catalog_url": "http://base_catalog.url"}
        loader.recce_cloud.get_base_session_download_urls.return_value = mock_base_urls

        # Mock HTTP responses for artifacts
        mock_response_200 = Mock()
        mock_response_200.status_code = 200
        mock_response_200.json.side_effect = [
            "current_manifest_data",  # current manifest
            "current_catalog_data",  # current catalog
            "base_manifest_data",  # base manifest
            "base_catalog_data",  # base catalog
        ]

        # Mock HTTP response for recce_state
        mock_state_response = Mock()
        mock_state_response.status_code = 200
        mock_state_response.content = b'{"runs": [{"id": "test"}], "checks": [{"id": "test"}]}'

        # Set up the mock_get to return different responses for different URLs
        def side_effect(url, **kwargs):
            if "recce_state" in url:
                return mock_state_response
            else:
                return mock_response_200

        mock_get.side_effect = side_effect

        # Mock RecceState.from_file for the recce_state
        with patch("recce.state.cloud.RecceState") as mock_recce_state:
            mock_state = Mock()
            mock_state.runs = [{"id": "test"}]
            mock_state.checks = [{"id": "test"}]
            mock_recce_state.from_file.return_value = mock_state

            result_state = loader._load_state_from_session()

            # Verify the state was loaded from recce_state_url
            self.assertEqual(result_state, mock_state)

            # Verify artifacts were set
            self.assertEqual(
                result_state.artifacts.current, {"manifest": "current_manifest_data", "catalog": "current_catalog_data"}
            )
            self.assertEqual(
                result_state.artifacts.base, {"manifest": "base_manifest_data", "catalog": "base_catalog_data"}
            )

    @patch("requests.get")
    def test_load_state_from_session_no_existing_state(self, mock_get):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "session_id": "test_session"})
        loader.catalog = "session"
        loader.session_id = "test_session"

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()

        # Mock get_session response
        mock_session = {"org_id": "org1", "project_id": "proj1"}
        loader.recce_cloud.get_session.return_value = mock_session

        # Mock get_download_urls_by_session_id response (no recce_state_url)
        mock_download_urls = {"manifest_url": "http://manifest.url", "catalog_url": "http://catalog.url"}
        loader.recce_cloud.get_download_urls_by_session_id.return_value = mock_download_urls

        # Mock get_base_session_download_urls response
        mock_base_urls = {"manifest_url": "http://base_manifest.url", "catalog_url": "http://base_catalog.url"}
        loader.recce_cloud.get_base_session_download_urls.return_value = mock_base_urls

        # Mock HTTP responses for artifacts
        mock_response_200 = Mock()
        mock_response_200.status_code = 200
        mock_response_200.json.side_effect = [
            "current_manifest_data",
            "current_catalog_data",
            "base_manifest_data",
            "base_catalog_data",
        ]
        mock_get.return_value = mock_response_200

        # Mock RecceState constructor for empty state
        with patch("recce.state.cloud.RecceState") as mock_recce_state_class:
            mock_empty_state = Mock()
            mock_empty_state.runs = []
            mock_empty_state.checks = []
            mock_recce_state_class.return_value = mock_empty_state

            result_state = loader._load_state_from_session()

            # Verify empty state was created
            self.assertEqual(result_state, mock_empty_state)
            self.assertEqual(result_state.runs, [])
            self.assertEqual(result_state.checks, [])

            # Verify artifacts were set
            self.assertEqual(
                result_state.artifacts.current, {"manifest": "current_manifest_data", "catalog": "current_catalog_data"}
            )
            self.assertEqual(
                result_state.artifacts.base, {"manifest": "base_manifest_data", "catalog": "base_catalog_data"}
            )

    def test_load_state_from_session_missing_session_id(self):
        loader = CloudStateLoader(cloud_options={"api_token": "token"})
        loader.catalog = "session"
        loader.session_id = None

        with self.assertRaises(RecceException) as cm:
            loader._load_state_from_session()

        self.assertEqual(
            str(cm.exception), "Cannot load the session state from Recce Cloud. No session ID is provided."
        )

    def test_load_state_from_session_invalid_org_project(self):
        loader = CloudStateLoader(cloud_options={"api_token": "token", "session_id": "test_session"})
        loader.catalog = "session"
        loader.session_id = "test_session"

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()

        # Mock get_session response with missing org_id
        mock_session = {"project_id": "proj1"}  # Missing org_id
        loader.recce_cloud.get_session.return_value = mock_session

        with self.assertRaises(RecceException) as cm:
            loader._load_state_from_session()

        self.assertEqual(str(cm.exception), "Session test_session does not belong to a valid organization or project.")

    @patch("requests.put")
    def test_export_state_to_session_success(self, mock_put):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "session_id": "test_session"})
        loader.catalog = "session"
        loader.session_id = "test_session"

        # Create a mock state with runs and checks
        mock_runs = Mock()
        mock_runs.copy.return_value = [{"id": "run1"}, {"id": "run2"}]
        mock_checks = Mock()
        mock_checks.copy.return_value = [{"id": "check1"}]

        mock_state = Mock()
        mock_state.runs = mock_runs
        mock_state.checks = mock_checks
        loader.state = mock_state

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()

        # Mock get_session response
        mock_session = {"org_id": "org1", "project_id": "proj1"}
        loader.recce_cloud.get_session.return_value = mock_session

        # Mock get_upload_urls_by_session_id response
        mock_upload_urls = {"recce_state_url": "http://upload_recce_state.url"}
        loader.recce_cloud.get_upload_urls_by_session_id.return_value = mock_upload_urls

        # Mock HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_put.return_value = mock_response

        # Mock RecceState constructor for upload state
        with patch("recce.state.cloud.RecceState") as mock_recce_state_class:
            mock_upload_state = Mock()
            mock_upload_state.to_json.return_value = '{"runs": [], "checks": []}'
            mock_recce_state_class.return_value = mock_upload_state

            result_message, result_etag = loader._export_state_to_session()

            # Verify success
            self.assertIsNone(result_message)
            self.assertIsNone(result_etag)

            # Verify RecceState was created with empty artifacts
            mock_recce_state_class.assert_called_once()

            # Verify runs and checks were copied
            self.assertEqual(mock_upload_state.runs, [{"id": "run1"}, {"id": "run2"}])
            self.assertEqual(mock_upload_state.checks, [{"id": "check1"}])

    def test_export_state_to_session_missing_session_id(self):
        loader = CloudStateLoader(cloud_options={"api_token": "token"})
        loader.catalog = "session"
        loader.session_id = None

        with self.assertRaises(RecceException) as cm:
            loader._export_state_to_session()

        self.assertEqual(str(cm.exception), "Cannot export state to session. No session ID is provided.")

    def test_export_state_to_session_no_recce_state_url(self):
        loader = CloudStateLoader(cloud_options={"api_token": "token", "session_id": "test_session"})
        loader.catalog = "session"
        loader.session_id = "test_session"
        loader.state = Mock()

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()

        # Mock get_session response
        mock_session = {"org_id": "org1", "project_id": "proj1"}
        loader.recce_cloud.get_session.return_value = mock_session

        # Mock get_upload_urls_by_session_id response without recce_state_url
        mock_upload_urls = {}
        loader.recce_cloud.get_upload_urls_by_session_id.return_value = mock_upload_urls

        with self.assertRaises(RecceException) as cm:
            loader._export_state_to_session()

        self.assertEqual(str(cm.exception), "No recce_state_url found for session test_session")

    @patch("requests.put")
    def test_export_state_to_session_upload_failure(self, mock_put):
        # Setup
        loader = CloudStateLoader(cloud_options={"api_token": "token", "session_id": "test_session"})
        loader.catalog = "session"
        loader.session_id = "test_session"

        mock_runs = Mock()
        mock_runs.copy.return_value = []
        mock_checks = Mock()
        mock_checks.copy.return_value = []

        mock_state = Mock()
        mock_state.runs = mock_runs
        mock_state.checks = mock_checks
        loader.state = mock_state

        # Mock loader's RecceCloud instance
        loader.recce_cloud = Mock()

        # Mock get_session response
        mock_session = {"org_id": "org1", "project_id": "proj1"}
        loader.recce_cloud.get_session.return_value = mock_session

        # Mock get_upload_urls_by_session_id response
        mock_upload_urls = {"recce_state_url": "http://upload_recce_state.url"}
        loader.recce_cloud.get_upload_urls_by_session_id.return_value = mock_upload_urls

        # Mock HTTP error response
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_put.return_value = mock_response

        # Mock RecceState constructor for upload state
        with patch("recce.state.cloud.RecceState") as mock_recce_state_class:
            mock_upload_state = Mock()
            mock_upload_state.to_json.return_value = '{"runs": [], "checks": []}'
            mock_recce_state_class.return_value = mock_upload_state

            result_message, result_etag = loader._export_state_to_session()

            # Verify failure
            self.assertIn("Failed to upload", result_message)
            self.assertIn("Internal Server Error", result_message)
            self.assertIsNone(result_etag)

    @patch.object(CloudStateLoader, "_download_session_recce_state")
    @patch.object(CloudStateLoader, "_download_base_session_artifacts")
    @patch.object(CloudStateLoader, "_download_session_artifacts")
    def test_load_state_from_session_sets_pull_request_from_pr_link(
        self,
        mock_download_session_artifacts,
        mock_download_base_session_artifacts,
        mock_download_session_state,
    ):
        loader = CloudStateLoader(cloud_options={"api_token": "token", "session_id": "test_session"})
        loader.catalog = "session"
        loader.session_id = "test_session"

        loader.recce_cloud = Mock()
        loader.recce_cloud.get_session.return_value = {
            "org_id": "org1",
            "project_id": "proj1",
            "pr_link": "https://github.com/org/repo/pull/99",
        }

        mock_download_session_artifacts.return_value = {"manifest": "current_manifest", "catalog": "current_catalog"}
        mock_download_base_session_artifacts.return_value = {"manifest": "base_manifest", "catalog": "base_catalog"}

        state = RecceState()
        mock_download_session_state.return_value = state

        result_state = loader._load_state_from_session()

        mock_download_session_artifacts.assert_called_once()
        mock_download_base_session_artifacts.assert_called_once()
        mock_download_session_state.assert_called_once()
        self.assertIs(result_state, state)
        self.assertIsNotNone(loader.pr_info)
        self.assertEqual(str(loader.pr_info.id), "99")
        self.assertEqual(loader.pr_info.url, "https://github.com/org/repo/pull/99")
        self.assertIs(result_state.pull_request, loader.pr_info)


if __name__ == "__main__":
    unittest.main()
