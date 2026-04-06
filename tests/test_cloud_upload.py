import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch, MagicMock

from recce.server import (
    _check_base_needs_upload,
    _maybe_upload_base_session,
    _upload_artifacts_to_session,
)


class TestCheckBaseNeedsUpload(unittest.TestCase):
    """Test _check_base_needs_upload helper."""

    def test_base_session_exists_without_artifacts(self):
        """Base session exists but has no adapter_type -> needs upload."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "s1", "is_base": True, "adapter_type": None},
        ]
        self.assertTrue(_check_base_needs_upload(cloud, "org1", "proj1"))

    def test_base_session_exists_with_artifacts(self):
        """Base session has adapter_type -> does NOT need upload."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "s1", "is_base": True, "adapter_type": "postgres"},
        ]
        self.assertFalse(_check_base_needs_upload(cloud, "org1", "proj1"))

    def test_no_base_session(self):
        """No base session at all -> False."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "s1", "is_base": False},
        ]
        self.assertFalse(_check_base_needs_upload(cloud, "org1", "proj1"))

    def test_empty_sessions(self):
        cloud = Mock()
        cloud.list_sessions.return_value = []
        self.assertFalse(_check_base_needs_upload(cloud, "org1", "proj1"))

    def test_exception_returns_false(self):
        """If list_sessions raises, return False gracefully."""
        cloud = Mock()
        cloud.list_sessions.side_effect = Exception("network error")
        self.assertFalse(_check_base_needs_upload(cloud, "org1", "proj1"))

    def test_base_session_with_empty_string_adapter_type(self):
        """Empty string adapter_type is falsy -> needs upload."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "s1", "is_base": True, "adapter_type": ""},
        ]
        self.assertTrue(_check_base_needs_upload(cloud, "org1", "proj1"))


class TestUploadArtifactsToSession(unittest.TestCase):
    """Test _upload_artifacts_to_session helper."""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.manifest_path = os.path.join(self.tmp_dir, "manifest.json")
        self.catalog_path = os.path.join(self.tmp_dir, "catalog.json")
        with open(self.manifest_path, "w") as f:
            json.dump({"metadata": {}}, f)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp_dir)

    @patch("requests.put")
    def test_upload_manifest_and_catalog(self, mock_put):
        """Upload both manifest and catalog, then update + complete."""
        with open(self.catalog_path, "w") as f:
            json.dump({"nodes": {}}, f)

        cloud = Mock()
        cloud.get_upload_urls_by_session_id.return_value = {
            "manifest_url": "https://s3/manifest",
            "catalog_url": "https://s3/catalog",
        }
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_put.return_value = mock_resp

        _upload_artifacts_to_session(
            cloud, "org1", "proj1", "sess1",
            self.manifest_path, self.catalog_path, "postgres",
        )

        self.assertEqual(mock_put.call_count, 2)
        cloud.update_session.assert_called_once_with("org1", "proj1", "sess1", "postgres")
        cloud.upload_completed.assert_called_once_with("sess1")

    @patch("requests.put")
    def test_upload_manifest_only_no_catalog(self, mock_put):
        """When catalog doesn't exist, only manifest is uploaded."""
        cloud = Mock()
        cloud.get_upload_urls_by_session_id.return_value = {
            "manifest_url": "https://s3/manifest",
            "catalog_url": "https://s3/catalog",
        }
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_put.return_value = mock_resp

        _upload_artifacts_to_session(
            cloud, "org1", "proj1", "sess1",
            self.manifest_path, self.catalog_path, "postgres",
        )

        # Only manifest uploaded (catalog doesn't exist)
        self.assertEqual(mock_put.call_count, 1)
        cloud.update_session.assert_called_once()
        cloud.upload_completed.assert_called_once()

    @patch("requests.put")
    def test_upload_notify_completed_false(self, mock_put):
        """When notify_completed=False, upload_completed is NOT called."""
        cloud = Mock()
        cloud.get_upload_urls_by_session_id.return_value = {
            "manifest_url": "https://s3/manifest",
            "catalog_url": "https://s3/catalog",
        }
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_put.return_value = mock_resp

        _upload_artifacts_to_session(
            cloud, "org1", "proj1", "sess1",
            self.manifest_path, self.catalog_path, "postgres",
            notify_completed=False,
        )

        cloud.update_session.assert_called_once()
        cloud.upload_completed.assert_not_called()

    @patch("requests.put")
    def test_upload_manifest_failure_raises(self, mock_put):
        """If manifest upload returns non-200/204, raise."""
        cloud = Mock()
        cloud.get_upload_urls_by_session_id.return_value = {
            "manifest_url": "https://s3/manifest",
            "catalog_url": "https://s3/catalog",
        }
        mock_resp = Mock()
        mock_resp.status_code = 500
        mock_resp.text = "Server error"
        mock_put.return_value = mock_resp

        with self.assertRaises(Exception) as ctx:
            _upload_artifacts_to_session(
                cloud, "org1", "proj1", "sess1",
                self.manifest_path, self.catalog_path, "postgres",
            )
        self.assertIn("Failed to upload manifest", str(ctx.exception))


class TestMaybeUploadBaseSession(unittest.TestCase):
    """Test _maybe_upload_base_session helper."""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.manifest_path = os.path.join(self.tmp_dir, "manifest.json")
        with open(self.manifest_path, "w") as f:
            json.dump({"metadata": {}}, f)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp_dir)

    def test_no_base_target(self):
        """Returns False when base_target is None."""
        cloud = Mock()
        self.assertFalse(
            _maybe_upload_base_session(cloud, "org1", "proj1", None, "postgres")
        )

    def test_no_base_manifest(self):
        """Returns False when manifest.json doesn't exist in base_target."""
        cloud = Mock()
        empty_dir = tempfile.mkdtemp()
        try:
            self.assertFalse(
                _maybe_upload_base_session(cloud, "org1", "proj1", empty_dir, "postgres")
            )
        finally:
            import shutil
            shutil.rmtree(empty_dir)

    def test_no_base_session_in_project(self):
        """Returns False when no session has is_base=True."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "s1", "is_base": False},
        ]
        self.assertFalse(
            _maybe_upload_base_session(cloud, "org1", "proj1", self.tmp_dir, "postgres")
        )

    def test_base_session_already_has_artifacts(self):
        """Returns False when base session already has adapter_type."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "s1", "is_base": True, "adapter_type": "postgres"},
        ]
        self.assertFalse(
            _maybe_upload_base_session(cloud, "org1", "proj1", self.tmp_dir, "postgres")
        )

    @patch("recce.server._upload_artifacts_to_session")
    def test_uploads_when_base_session_needs_artifacts(self, mock_upload):
        """Uploads and returns True when base session has no adapter_type."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "base-sess-1", "is_base": True, "adapter_type": None},
        ]

        result = _maybe_upload_base_session(
            cloud, "org1", "proj1", self.tmp_dir, "postgres"
        )

        self.assertTrue(result)
        mock_upload.assert_called_once_with(
            cloud, "org1", "proj1", "base-sess-1",
            self.manifest_path,
            os.path.join(self.tmp_dir, "catalog.json"),
            "postgres",
            notify_completed=False,
        )


if __name__ == "__main__":
    unittest.main()
