import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient

from recce.server import (
    _check_base_needs_upload,
    _maybe_upload_base_session,
    _upload_artifacts_to_session,
    app,
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
            cloud,
            "org1",
            "proj1",
            "sess1",
            self.manifest_path,
            self.catalog_path,
            "postgres",
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
            cloud,
            "org1",
            "proj1",
            "sess1",
            self.manifest_path,
            self.catalog_path,
            "postgres",
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
            cloud,
            "org1",
            "proj1",
            "sess1",
            self.manifest_path,
            self.catalog_path,
            "postgres",
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
                cloud,
                "org1",
                "proj1",
                "sess1",
                self.manifest_path,
                self.catalog_path,
                "postgres",
            )
        self.assertIn("Failed to upload manifest", str(ctx.exception))

    @patch("requests.put")
    def test_upload_catalog_failure_raises(self, mock_put):
        """If catalog upload returns non-200/204, raise."""
        with open(self.catalog_path, "w") as f:
            json.dump({"nodes": {}}, f)

        cloud = Mock()
        cloud.get_upload_urls_by_session_id.return_value = {
            "manifest_url": "https://s3/manifest",
            "catalog_url": "https://s3/catalog",
        }
        manifest_resp = Mock()
        manifest_resp.status_code = 200
        catalog_resp = Mock()
        catalog_resp.status_code = 500
        catalog_resp.text = "Server error"
        mock_put.side_effect = [manifest_resp, catalog_resp]

        with self.assertRaises(Exception) as ctx:
            _upload_artifacts_to_session(
                cloud,
                "org1",
                "proj1",
                "sess1",
                self.manifest_path,
                self.catalog_path,
                "postgres",
            )
        self.assertIn("Failed to upload catalog", str(ctx.exception))


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
        self.assertFalse(_maybe_upload_base_session(cloud, "org1", "proj1", None, "postgres"))

    def test_no_base_manifest(self):
        """Returns False when manifest.json doesn't exist in base_target."""
        cloud = Mock()
        empty_dir = tempfile.mkdtemp()
        try:
            self.assertFalse(_maybe_upload_base_session(cloud, "org1", "proj1", empty_dir, "postgres"))
        finally:
            import shutil

            shutil.rmtree(empty_dir)

    def test_no_base_session_in_project(self):
        """Returns False when no session has is_base=True."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "s1", "is_base": False},
        ]
        self.assertFalse(_maybe_upload_base_session(cloud, "org1", "proj1", self.tmp_dir, "postgres"))

    def test_base_session_already_has_artifacts(self):
        """Returns False when base session already has adapter_type."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "s1", "is_base": True, "adapter_type": "postgres"},
        ]
        self.assertFalse(_maybe_upload_base_session(cloud, "org1", "proj1", self.tmp_dir, "postgres"))

    @patch("recce.server._upload_artifacts_to_session")
    def test_uploads_when_base_session_needs_artifacts(self, mock_upload):
        """Uploads and returns True when base session has no adapter_type."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": "base-sess-1", "is_base": True, "adapter_type": None},
        ]

        result = _maybe_upload_base_session(cloud, "org1", "proj1", self.tmp_dir, "postgres")

        self.assertTrue(result)
        mock_upload.assert_called_once_with(
            cloud,
            "org1",
            "proj1",
            "base-sess-1",
            self.manifest_path,
            os.path.join(self.tmp_dir, "catalog.json"),
            "postgres",
            notify_completed=False,
        )


def _mock_context_with_token(token="test-token"):
    """Create a mock context with state_loader.token set."""
    ctx = Mock()
    ctx.state_loader = Mock()
    ctx.state_loader.token = token
    return ctx


def _mock_context_no_token():
    """Create a mock context with no token."""
    ctx = Mock()
    ctx.state_loader = Mock()
    ctx.state_loader.token = None
    return ctx


class _EndpointTestBase:
    """Base class that initializes app.state for TestClient-based tests."""

    @pytest.fixture(autouse=True)
    def init_app_state(self):
        app.state.last_activity = None
        yield
        app.state.last_activity = None


class TestCloudOrganizationsEndpoint(_EndpointTestBase):
    """Test GET /api/cloud/organizations endpoint."""

    @patch("recce.server.get_recce_api_token", return_value=None)
    @patch("recce.server.default_context")
    def test_401_when_no_token(self, mock_ctx, mock_token):
        mock_ctx.return_value = _mock_context_no_token()
        client = TestClient(app)
        resp = client.get("/api/cloud/organizations")
        assert resp.status_code == 401

    @patch("recce.util.recce_cloud.RecceCloud.list_organizations")
    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_returns_organizations(self, mock_ctx, mock_token, mock_list):
        mock_ctx.return_value = _mock_context_with_token()
        mock_list.return_value = [{"id": "1", "name": "org1"}]
        client = TestClient(app)
        resp = client.get("/api/cloud/organizations")
        assert resp.status_code == 200
        assert resp.json()["organizations"] == [{"id": "1", "name": "org1"}]

    @patch("recce.util.recce_cloud.RecceCloud.list_organizations")
    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_400_on_cloud_error(self, mock_ctx, mock_token, mock_list):
        mock_ctx.return_value = _mock_context_with_token()
        mock_list.side_effect = Exception("Cloud error")
        client = TestClient(app)
        resp = client.get("/api/cloud/organizations")
        assert resp.status_code == 400


class TestCloudProjectsEndpoint(_EndpointTestBase):
    """Test GET /api/cloud/organizations/{org_id}/projects endpoint."""

    @patch("recce.server.get_recce_api_token", return_value=None)
    @patch("recce.server.default_context")
    def test_401_when_no_token(self, mock_ctx, mock_token):
        mock_ctx.return_value = _mock_context_no_token()
        client = TestClient(app)
        resp = client.get("/api/cloud/organizations/org1/projects")
        assert resp.status_code == 401

    @patch("recce.util.recce_cloud.RecceCloud.list_projects")
    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_returns_projects(self, mock_ctx, mock_token, mock_list):
        mock_ctx.return_value = _mock_context_with_token()
        mock_list.return_value = [{"id": "1", "name": "proj1"}]
        client = TestClient(app)
        resp = client.get("/api/cloud/organizations/org1/projects")
        assert resp.status_code == 200
        assert resp.json()["projects"] == [{"id": "1", "name": "proj1"}]


class TestCloudBaseStatusEndpoint(_EndpointTestBase):
    """Test GET /api/cloud/organizations/{org_id}/projects/{project_id}/base-status."""

    @patch("recce.server.get_recce_api_token", return_value=None)
    @patch("recce.server.default_context")
    def test_401_when_no_token(self, mock_ctx, mock_token):
        mock_ctx.return_value = _mock_context_no_token()
        client = TestClient(app)
        resp = client.get("/api/cloud/organizations/org1/projects/proj1/base-status")
        assert resp.status_code == 401

    @patch("recce.util.recce_cloud.RecceCloud.list_sessions")
    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_returns_base_needs_upload_true(self, mock_ctx, mock_token, mock_sessions):
        mock_ctx.return_value = _mock_context_with_token()
        mock_sessions.return_value = [{"id": "s1", "is_base": True, "adapter_type": None}]
        client = TestClient(app)
        resp = client.get("/api/cloud/organizations/org1/projects/proj1/base-status")
        assert resp.status_code == 200
        assert resp.json()["base_needs_upload"] is True

    @patch("recce.util.recce_cloud.RecceCloud.list_sessions")
    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_returns_base_needs_upload_false(self, mock_ctx, mock_token, mock_sessions):
        mock_ctx.return_value = _mock_context_with_token()
        mock_sessions.return_value = [{"id": "s1", "is_base": True, "adapter_type": "postgres"}]
        client = TestClient(app)
        resp = client.get("/api/cloud/organizations/org1/projects/proj1/base-status")
        assert resp.status_code == 200
        assert resp.json()["base_needs_upload"] is False


class TestCloudUploadEndpoint(_EndpointTestBase):
    """Test POST /api/cloud/upload endpoint."""

    @patch("recce.server.get_recce_api_token", return_value=None)
    @patch("recce.server.default_context")
    def test_401_when_no_token(self, mock_ctx, mock_token):
        mock_ctx.return_value = _mock_context_no_token()
        client = TestClient(app)
        resp = client.post(
            "/api/cloud/upload",
            json={
                "org_id": "org1",
                "project_id": "proj1",
                "session_name": "test",
            },
        )
        assert resp.status_code == 401

    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_400_when_no_adapter(self, mock_ctx, mock_token):
        ctx = _mock_context_with_token()
        ctx.adapter = None
        mock_ctx.return_value = ctx
        client = TestClient(app)
        resp = client.post(
            "/api/cloud/upload",
            json={
                "org_id": "org1",
                "project_id": "proj1",
                "session_name": "test",
            },
        )
        assert resp.status_code == 400
        assert "No adapter" in resp.json()["detail"]

    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_400_when_no_target_path(self, mock_ctx, mock_token):
        ctx = _mock_context_with_token()
        ctx.adapter = Mock(spec=[])  # No target_path attribute
        mock_ctx.return_value = ctx
        client = TestClient(app)
        resp = client.post(
            "/api/cloud/upload",
            json={
                "org_id": "org1",
                "project_id": "proj1",
                "session_name": "test",
            },
        )
        assert resp.status_code == 400
        assert "target path" in resp.json()["detail"]

    @patch("recce.server._maybe_upload_base_session")
    @patch("recce.server._upload_artifacts_to_session")
    @patch("recce.util.recce_cloud.RecceCloud.create_session")
    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_successful_upload(self, mock_ctx, mock_token, mock_create, mock_upload, mock_base):
        tmp_dir = tempfile.mkdtemp()
        try:
            manifest_path = os.path.join(tmp_dir, "manifest.json")
            with open(manifest_path, "w") as f:
                json.dump({"metadata": {"adapter_type": "postgres"}}, f)

            ctx = _mock_context_with_token()
            ctx.adapter = Mock()
            ctx.adapter.target_path = tmp_dir
            ctx.adapter.base_path = None
            mock_ctx.return_value = ctx

            mock_base.return_value = False
            mock_create.return_value = {"id": "sess-123"}

            client = TestClient(app)
            resp = client.post(
                "/api/cloud/upload",
                json={
                    "org_id": "org1",
                    "project_id": "proj1",
                    "session_name": "my-session",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "success"
            assert data["session_id"] == "sess-123"
            assert "sess-123" in data["session_url"]
            mock_create.assert_called_once()
            mock_upload.assert_called_once()
        finally:
            import shutil

            shutil.rmtree(tmp_dir)

    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_400_when_manifest_missing(self, mock_ctx, mock_token):
        tmp_dir = tempfile.mkdtemp()
        try:
            ctx = _mock_context_with_token()
            ctx.adapter = Mock()
            ctx.adapter.target_path = tmp_dir  # No manifest.json
            mock_ctx.return_value = ctx

            client = TestClient(app)
            resp = client.post(
                "/api/cloud/upload",
                json={
                    "org_id": "org1",
                    "project_id": "proj1",
                    "session_name": "test",
                },
            )
            assert resp.status_code == 400
            assert "manifest.json" in resp.json()["detail"]
        finally:
            import shutil

            shutil.rmtree(tmp_dir)


class TestAdapterTypeValidation(_EndpointTestBase):
    """Test adapter_type validation in upload endpoint."""

    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_400_when_adapter_type_missing(self, mock_ctx, mock_token):
        """Manifest without metadata.adapter_type should return 400."""
        tmp_dir = tempfile.mkdtemp()
        try:
            manifest_path = os.path.join(tmp_dir, "manifest.json")
            with open(manifest_path, "w") as f:
                json.dump({"metadata": {}}, f)

            ctx = _mock_context_with_token()
            ctx.adapter = Mock()
            ctx.adapter.target_path = tmp_dir
            mock_ctx.return_value = ctx

            client = TestClient(app)
            resp = client.post(
                "/api/cloud/upload",
                json={
                    "org_id": "org1",
                    "project_id": "proj1",
                    "session_name": "test",
                },
            )
            assert resp.status_code == 400
            assert "adapter_type" in resp.json()["detail"]
        finally:
            import shutil

            shutil.rmtree(tmp_dir)

    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_400_when_adapter_type_null(self, mock_ctx, mock_token):
        """Manifest with null adapter_type should return 400."""
        tmp_dir = tempfile.mkdtemp()
        try:
            manifest_path = os.path.join(tmp_dir, "manifest.json")
            with open(manifest_path, "w") as f:
                json.dump({"metadata": {"adapter_type": None}}, f)

            ctx = _mock_context_with_token()
            ctx.adapter = Mock()
            ctx.adapter.target_path = tmp_dir
            mock_ctx.return_value = ctx

            client = TestClient(app)
            resp = client.post(
                "/api/cloud/upload",
                json={
                    "org_id": "org1",
                    "project_id": "proj1",
                    "session_name": "test",
                },
            )
            assert resp.status_code == 400
            assert "adapter_type" in resp.json()["detail"]
        finally:
            import shutil

            shutil.rmtree(tmp_dir)


class TestMaybeUploadBaseSessionIdValidation(unittest.TestCase):
    """Test _maybe_upload_base_session handles missing/empty session IDs."""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.manifest_path = os.path.join(self.tmp_dir, "manifest.json")
        with open(self.manifest_path, "w") as f:
            json.dump({"metadata": {}}, f)

    def tearDown(self):
        import shutil

        shutil.rmtree(self.tmp_dir)

    def test_returns_false_when_base_session_has_no_id(self):
        """Base session without 'id' field should return False, not crash."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"is_base": True, "adapter_type": None},  # No 'id' key
        ]
        self.assertFalse(_maybe_upload_base_session(cloud, "org1", "proj1", self.tmp_dir, "postgres"))

    def test_returns_false_when_base_session_id_is_none(self):
        """Base session with id=None should return False."""
        cloud = Mock()
        cloud.list_sessions.return_value = [
            {"id": None, "is_base": True, "adapter_type": None},
        ]
        self.assertFalse(_maybe_upload_base_session(cloud, "org1", "proj1", self.tmp_dir, "postgres"))


class TestConnectionInfoEndpoint(_EndpointTestBase):
    """Test GET /api/connection-info endpoint."""

    @patch("recce.server.default_context")
    def test_returns_connection_info(self, mock_ctx):
        ctx = Mock()
        creds = Mock()
        creds.type = "snowflake"
        creds.connection_info.return_value = [
            ("account", "abc.us-east-1"),
            ("database", "MY_DB"),
            ("schema", "PUBLIC"),
        ]
        runtime_config = Mock()
        runtime_config.credentials = creds
        ctx.adapter = Mock()
        ctx.adapter.runtime_config = runtime_config
        mock_ctx.return_value = ctx

        client = TestClient(app)
        resp = client.get("/api/connection-info")
        assert resp.status_code == 200
        data = resp.json()["connection_info"]
        assert data["type"] == "snowflake"
        assert data["account"] == "abc.us-east-1"
        assert data["database"] == "MY_DB"
        assert data["schema"] == "PUBLIC"

    @patch("recce.server.default_context")
    def test_returns_null_when_no_runtime_config(self, mock_ctx):
        ctx = Mock()
        ctx.adapter = Mock(spec=[])  # No runtime_config
        mock_ctx.return_value = ctx

        client = TestClient(app)
        resp = client.get("/api/connection-info")
        assert resp.status_code == 200
        assert resp.json()["connection_info"] is None

    @patch("recce.server.default_context")
    def test_returns_null_when_runtime_config_is_none(self, mock_ctx):
        ctx = Mock()
        ctx.adapter = Mock()
        ctx.adapter.runtime_config = None
        mock_ctx.return_value = ctx

        client = TestClient(app)
        resp = client.get("/api/connection-info")
        assert resp.status_code == 200
        assert resp.json()["connection_info"] is None


class TestWarehouseSetupEndpoint(_EndpointTestBase):
    """Test POST /api/cloud/warehouse-setup endpoint."""

    @patch("recce.server.get_recce_api_token", return_value=None)
    @patch("recce.server.default_context")
    def test_401_when_no_token(self, mock_ctx, mock_token):
        mock_ctx.return_value = _mock_context_no_token()
        client = TestClient(app)
        resp = client.post(
            "/api/cloud/warehouse-setup",
            json={
                "org_id": "org1",
                "project_id": "proj1",
                "connection_name": "DW",
                "config": {"type": "snowflake"},
            },
        )
        assert resp.status_code == 401

    @patch("recce.util.recce_cloud.RecceCloud.bind_warehouse_connection_to_project")
    @patch("recce.util.recce_cloud.RecceCloud.create_warehouse_connection")
    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_successful_setup(self, mock_ctx, mock_token, mock_create, mock_bind):
        mock_ctx.return_value = _mock_context_with_token()
        mock_create.return_value = {"id": "wc-123", "name": "My DW"}
        mock_bind.return_value = {"status": "ok"}

        client = TestClient(app)
        resp = client.post(
            "/api/cloud/warehouse-setup",
            json={
                "org_id": "org1",
                "project_id": "proj1",
                "connection_name": "My DW",
                "config": {"type": "snowflake", "account": "abc", "password": "secret"},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["warehouse_connection_id"] == "wc-123"

        mock_create.assert_called_once_with(
            org_id="org1",
            name="My DW",
            config={"type": "snowflake", "account": "abc", "password": "secret"},
        )
        mock_bind.assert_called_once_with(
            org_id="org1",
            project_id="proj1",
            warehouse_connection_id="wc-123",
        )

    @patch("recce.util.recce_cloud.RecceCloud.create_warehouse_connection")
    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_400_on_create_failure(self, mock_ctx, mock_token, mock_create):
        mock_ctx.return_value = _mock_context_with_token()
        mock_create.side_effect = Exception("Invalid config")

        client = TestClient(app)
        resp = client.post(
            "/api/cloud/warehouse-setup",
            json={
                "org_id": "org1",
                "project_id": "proj1",
                "connection_name": "Bad",
                "config": {"type": "snowflake"},
            },
        )
        assert resp.status_code == 400
        assert "Invalid config" in resp.json()["detail"]

    @patch("recce.util.recce_cloud.RecceCloud.bind_warehouse_connection_to_project")
    @patch("recce.util.recce_cloud.RecceCloud.create_warehouse_connection")
    @patch("recce.server.get_recce_api_token", return_value="tok")
    @patch("recce.server.default_context")
    def test_400_on_bind_failure(self, mock_ctx, mock_token, mock_create, mock_bind):
        mock_ctx.return_value = _mock_context_with_token()
        mock_create.return_value = {"id": "wc-123"}
        mock_bind.side_effect = Exception("Bind failed")

        client = TestClient(app)
        resp = client.post(
            "/api/cloud/warehouse-setup",
            json={
                "org_id": "org1",
                "project_id": "proj1",
                "connection_name": "DW",
                "config": {"type": "snowflake"},
            },
        )
        assert resp.status_code == 400
        assert "Bind failed" in resp.json()["detail"]


if __name__ == "__main__":
    unittest.main()
