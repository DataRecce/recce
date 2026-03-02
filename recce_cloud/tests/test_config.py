"""
Tests for recce-cloud config module.
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestProjectConfig(unittest.TestCase):
    """Test cases for project configuration management."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil

        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_get_config_path(self):
        """Test config path generation."""
        from recce_cloud.config.project_config import get_config_path

        path = get_config_path(self.temp_dir)
        expected = Path(self.temp_dir) / ".recce" / "config"
        self.assertEqual(path, expected)

    def test_load_config_nonexistent(self):
        """Test loading config when file doesn't exist."""
        from recce_cloud.config.project_config import load_config

        config = load_config(self.temp_dir)
        self.assertEqual(config, {})

    def test_save_and_load_config(self):
        """Test saving and loading config."""
        from recce_cloud.config.project_config import load_config, save_config

        test_config = {
            "version": 1,
            "cloud": {
                "org_id": "test-org-id",
                "project_id": "test-project-id",
            },
        }

        save_config(test_config, self.temp_dir)
        loaded = load_config(self.temp_dir)

        self.assertEqual(loaded, test_config)

    def test_get_project_binding_not_bound(self):
        """Test getting binding when not bound."""
        from recce_cloud.config.project_config import get_project_binding

        binding = get_project_binding(self.temp_dir)
        self.assertIsNone(binding)

    def test_save_and_get_project_binding(self):
        """Test saving and getting project binding."""
        from recce_cloud.config.project_config import (
            get_project_binding,
            save_project_binding,
        )

        save_project_binding(
            org_id="100",
            project_id="200",
            bound_by="test@example.com",
            project_dir=self.temp_dir,
        )

        binding = get_project_binding(self.temp_dir)

        self.assertIsNotNone(binding)
        self.assertEqual(binding["org_id"], "100")
        self.assertEqual(binding["project_id"], "200")
        self.assertEqual(binding["bound_by"], "test@example.com")
        self.assertIsNotNone(binding["bound_at"])

    def test_clear_project_binding(self):
        """Test clearing project binding."""
        from recce_cloud.config.project_config import (
            clear_project_binding,
            get_project_binding,
            save_project_binding,
        )

        # First save a binding
        save_project_binding(
            org_id="100",
            project_id="200",
            project_dir=self.temp_dir,
        )

        binding = get_project_binding(self.temp_dir)
        self.assertIsNotNone(binding)

        # Now clear it
        result = clear_project_binding(self.temp_dir)
        self.assertTrue(result)

        binding = get_project_binding(self.temp_dir)
        self.assertIsNone(binding)

    def test_clear_project_binding_not_bound(self):
        """Test clearing binding when not bound."""
        from recce_cloud.config.project_config import clear_project_binding

        result = clear_project_binding(self.temp_dir)
        self.assertFalse(result)

    def test_add_to_gitignore_new_file(self):
        """Test adding .recce/ to new .gitignore."""
        from recce_cloud.config.project_config import add_to_gitignore

        result = add_to_gitignore(self.temp_dir)
        self.assertTrue(result)

        gitignore_path = Path(self.temp_dir) / ".gitignore"
        with open(gitignore_path) as f:
            content = f.read()
            self.assertIn(".recce/", content)

    def test_add_to_gitignore_existing(self):
        """Test not duplicating .recce/ in .gitignore."""
        from recce_cloud.config.project_config import add_to_gitignore

        gitignore_path = Path(self.temp_dir) / ".gitignore"
        with open(gitignore_path, "w") as f:
            f.write("# Existing content\n.recce/\n")

        result = add_to_gitignore(self.temp_dir)
        self.assertFalse(result)


class TestConfigResolver(unittest.TestCase):
    """Test cases for configuration resolution."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil

        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_resolve_config_cli_flags(self):
        """Test CLI flags have highest priority."""
        from recce_cloud.config.resolver import resolve_config

        config = resolve_config(
            cli_org="123",
            cli_project="456",
        )

        self.assertEqual(config.org_id, "123")
        self.assertEqual(config.project_id, "456")
        self.assertEqual(config.source, "cli")

    def test_resolve_config_env_vars(self):
        """Test environment variables override config file."""
        from recce_cloud.config.resolver import resolve_config

        with patch.dict(
            os.environ,
            {
                "RECCE_ORG": "789",
                "RECCE_PROJECT": "101",
            },
        ):
            config = resolve_config(project_dir=self.temp_dir)

            self.assertEqual(config.org_id, "789")
            self.assertEqual(config.project_id, "101")
            self.assertEqual(config.source, "env")

    def test_resolve_config_local_config(self):
        """Test local config file is used as fallback."""
        from recce_cloud.config.project_config import save_project_binding
        from recce_cloud.config.resolver import resolve_config

        save_project_binding(
            org_id="202",
            project_id="303",
            project_dir=self.temp_dir,
        )

        # Clear any env vars that might interfere
        with patch.dict(os.environ, {}, clear=True):
            config = resolve_config(project_dir=self.temp_dir)

            self.assertEqual(config.org_id, "202")
            self.assertEqual(config.project_id, "303")
            self.assertEqual(config.source, "config")

    def test_resolve_config_error(self):
        """Test error when no configuration found."""
        from recce_cloud.config.resolver import ConfigurationError, resolve_config

        # Clear any env vars
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ConfigurationError):
                resolve_config(project_dir=self.temp_dir)

    def test_resolve_org_id_cli_priority(self):
        """Test CLI org_id has priority over env and config."""
        from recce_cloud.config.project_config import save_project_binding
        from recce_cloud.config.resolver import resolve_org_id

        save_project_binding(
            org_id="300",
            project_id="400",
            project_dir=self.temp_dir,
        )

        with patch.dict(os.environ, {"RECCE_ORG": "500"}):
            org_id = resolve_org_id(cli_org="600", project_dir=self.temp_dir)
            self.assertEqual(org_id, "600")

    def test_resolve_project_id_env_priority(self):
        """Test env project has priority over config."""
        from recce_cloud.config.project_config import save_project_binding
        from recce_cloud.config.resolver import resolve_project_id

        save_project_binding(
            org_id="300",
            project_id="400",
            project_dir=self.temp_dir,
        )

        with patch.dict(os.environ, {"RECCE_PROJECT": "500"}):
            project_id = resolve_project_id(project_dir=self.temp_dir)
            self.assertEqual(project_id, "500")

    def test_resolve_org_id_fallback_to_config(self):
        """Test org_id resolution falls back to config."""
        from recce_cloud.config.project_config import save_project_binding
        from recce_cloud.config.resolver import resolve_org_id

        save_project_binding(
            org_id="300",
            project_id="400",
            project_dir=self.temp_dir,
        )

        with patch.dict(os.environ, {}, clear=True):
            org_id = resolve_org_id(project_dir=self.temp_dir)
            self.assertEqual(org_id, "300")


if __name__ == "__main__":
    unittest.main()
