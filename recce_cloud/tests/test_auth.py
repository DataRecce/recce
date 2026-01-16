"""
Tests for recce-cloud auth module.
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml


class TestProfile(unittest.TestCase):
    """Test cases for profile management."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.recce_home = Path(self.temp_dir) / ".recce"
        self.recce_home.mkdir(parents=True, exist_ok=True)
        self.profile_path = str(self.recce_home / "profile.yml")

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil

        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_load_profile_creates_new(self):
        """Test loading profile creates new one when not existing."""
        from recce_cloud.auth import profile

        with patch.object(profile, "RECCE_USER_PROFILE", self.profile_path):
            with patch.object(profile, "RECCE_USER_HOME", str(self.recce_home)):
                loaded = profile.load_profile()

                # Should have created a new profile with user_id
                self.assertIn("user_id", loaded)
                self.assertIn("anonymous_tracking", loaded)

    def test_load_profile_existing(self):
        """Test loading profile from existing file."""
        from recce_cloud.auth import profile

        # Create a test profile
        test_profile = {
            "user_id": "test123",
            "recce_cloud": {"api_token": "test_token_123"},
        }
        with open(self.profile_path, "w") as f:
            yaml.dump(test_profile, f)

        with patch.object(profile, "RECCE_USER_PROFILE", self.profile_path):
            loaded = profile.load_profile()
            self.assertEqual(loaded["user_id"], "test123")
            self.assertEqual(loaded["recce_cloud"]["api_token"], "test_token_123")

    def test_update_api_token(self):
        """Test updating API token in profile."""
        from recce_cloud.auth import profile

        with patch.object(profile, "RECCE_USER_PROFILE", self.profile_path):
            with patch.object(profile, "RECCE_USER_HOME", str(self.recce_home)):
                profile.update_api_token("new_token_456")
                loaded = profile.load_profile()

                # api_token is stored at root level
                self.assertIn("api_token", loaded)
                self.assertEqual(loaded["api_token"], "new_token_456")

    def test_clear_api_token(self):
        """Test clearing API token from profile."""
        from recce_cloud.auth import profile

        with patch.object(profile, "RECCE_USER_PROFILE", self.profile_path):
            with patch.object(profile, "RECCE_USER_HOME", str(self.recce_home)):
                # First set a token
                profile.update_api_token("test_token")
                loaded = profile.load_profile()
                self.assertIn("api_token", loaded)

                # Now clear it
                profile.clear_api_token()
                loaded = profile.load_profile()
                self.assertNotIn("api_token", loaded)

    def test_get_api_token(self):
        """Test getting API token from profile."""
        from recce_cloud.auth import profile

        with patch.object(profile, "RECCE_USER_PROFILE", self.profile_path):
            with patch.object(profile, "RECCE_USER_HOME", str(self.recce_home)):
                # Initially no token
                token = profile.get_api_token()
                self.assertIsNone(token)

                # After setting token
                profile.update_api_token("my_token")
                token = profile.get_api_token()
                self.assertEqual(token, "my_token")


class TestKeyPair(unittest.TestCase):
    """Test cases for RSA key generation and decryption."""

    def test_generate_key_pair(self):
        """Test RSA key pair generation."""
        from cryptography.hazmat.primitives.asymmetric.rsa import (
            RSAPrivateKey,
            RSAPublicKey,
        )

        from recce_cloud.auth.login import generate_key_pair

        private_key, public_key = generate_key_pair()

        self.assertIsNotNone(private_key)
        self.assertIsNotNone(public_key)
        self.assertIsInstance(private_key, RSAPrivateKey)
        self.assertIsInstance(public_key, RSAPublicKey)

    def test_decrypt_code(self):
        """Test RSA decryption."""
        import base64

        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding

        from recce_cloud.auth.login import decrypt_code, generate_key_pair

        # Generate key pair
        private_key, public_key = generate_key_pair()

        # Encrypt a test message using public key
        test_message = "test_code_12345"
        encrypted = public_key.encrypt(
            test_message.encode("utf-8"),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA1()),
                algorithm=hashes.SHA1(),
                label=None,
            ),
        )
        encrypted_b64 = base64.b64encode(encrypted).decode("utf-8")

        # Decrypt and verify (note: private_key is first argument)
        decrypted = decrypt_code(private_key, encrypted_b64)
        self.assertEqual(decrypted, test_message)


class TestCallbackServer(unittest.TestCase):
    """Test cases for OAuth callback server."""

    def test_callback_result_class(self):
        """Test CallbackResult class initialization."""
        from recce_cloud.auth.callback_server import CallbackResult

        result = CallbackResult()
        self.assertIsNone(result.code)
        self.assertIsNone(result.error)


class TestLoginStatus(unittest.TestCase):
    """Test cases for login status checking."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.profile_path = Path(self.temp_dir) / ".recce" / "profile.yml"
        self.profile_path.parent.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil

        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_check_login_status_not_logged_in(self):
        """Test login status when not logged in."""
        from recce_cloud.auth.login import check_login_status

        with patch(
            "recce_cloud.auth.profile.get_profile_path",
            return_value=Path(self.temp_dir) / "nonexistent" / "profile.yml",
        ):
            with patch("recce_cloud.auth.login.get_api_token", return_value=None):
                is_logged_in, user_info = check_login_status()
                self.assertFalse(is_logged_in)
                self.assertIsNone(user_info)

    def test_check_login_status_logged_in(self):
        """Test login status when logged in with valid token."""
        from recce_cloud.auth.login import check_login_status

        mock_user_info = {"email": "test@example.com", "name": "Test User"}

        with patch("recce_cloud.auth.login.get_api_token", return_value="valid_token"):
            with patch("recce_cloud.auth.login.verify_token", return_value=True):
                with patch(
                    "recce_cloud.auth.login.get_user_info",
                    return_value=mock_user_info,
                ):
                    is_logged_in, email = check_login_status()
                    self.assertTrue(is_logged_in)
                    self.assertEqual(email, "test@example.com")


if __name__ == "__main__":
    unittest.main()
