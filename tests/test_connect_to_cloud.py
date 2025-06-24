import base64
import unittest
from unittest.mock import patch
from urllib.parse import quote

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

from recce.connect_to_cloud import (
    connect_to_cloud_background_task,
    decrypt_code,
    generate_key_pair,
    is_callback_server_running,
    prepare_connection_url,
)


class ConnectToCloudTests(unittest.TestCase):

    def test_generate_key_pair(self):
        private_key, public_key = generate_key_pair()
        self.assertIsNotNone(private_key)
        self.assertIsNotNone(public_key)
        self.assertEqual(private_key.public_key().public_numbers(), public_key.public_numbers())

    def test_prepare_connection_url(self):
        _, public_key = generate_key_pair()
        url, port = prepare_connection_url(public_key)
        self.assertIn("connect?", url)
        self.assertTrue(port >= 10000 and port <= 15000)

    def test_decrypt_code(self):
        private_key, public_key = generate_key_pair()
        test_string = "recce-api-token-123"
        ciphertext = public_key.encrypt(
            test_string.encode(),
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA1()), algorithm=hashes.SHA1(), label=None),
        )
        b64_ciphertext = base64.b64encode(ciphertext).decode()
        result = decrypt_code(private_key, b64_ciphertext)
        self.assertEqual(result, test_string)

    @patch("recce.connect_to_cloud.update_recce_api_token")
    @patch("recce.connect_to_cloud.update_onboarding_state")
    @patch("recce.connect_to_cloud.RecceCloud")
    def test_handle_callback_request_success(self, mock_recce_cloud, mock_update_state, mock_update_token):
        private_key, public_key = generate_key_pair()

        # Prepare encrypted token
        test_token = "recce-api-token-xyz"
        ciphertext = public_key.encrypt(
            test_token.encode(),
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA1()), algorithm=hashes.SHA1(), label=None),
        )
        encrypted_b64 = base64.b64encode(ciphertext).decode()

        # Set up mocks
        mock_recce_cloud.return_value.verify_token.return_value = True

        from recce.connect_to_cloud import handle_callback_request

        result = handle_callback_request(f"code={quote(encrypted_b64)}", private_key)

        assert result == test_token
        mock_update_token.assert_called_once_with(test_token)
        mock_update_state.assert_called_once_with(test_token, False)

    def test_is_callback_server_running(self):
        # Should return False by default
        self.assertFalse(is_callback_server_running())

    @patch("recce.connect_to_cloud.run_one_time_http_server")
    def test_connect_to_cloud_background_task_runs(self, mock_server):
        private_key, public_key = generate_key_pair()
        url, port = prepare_connection_url(public_key)

        connect_to_cloud_background_task(private_key, port, url)
        mock_server.assert_called_once()


if __name__ == "__main__":
    unittest.main()
