import unittest
from unittest.mock import patch

from recce.exceptions import RecceConfigException


class PrepareApiTokenTest(unittest.TestCase):

    @patch("recce.util.api_token.console.print")
    def test_show_invalid_api_token_message(self, mock_print):
        from recce.util.api_token import (
            RECCE_CLOUD_BASE_URL,
            show_invalid_api_token_message,
        )

        show_invalid_api_token_message()
        mock_print.assert_any_call("[[red]Error[/red]] Invalid Recce Cloud API token.")
        mock_print.assert_any_call(f"Please check your API token from {RECCE_CLOUD_BASE_URL}/settings#tokens")

    @patch("recce.util.api_token.get_recce_api_token", return_value=None)
    def test_no_token_provided_no_interaction(self, mock_get_token):
        from recce.util.api_token import prepare_api_token

        token = prepare_api_token(interaction=False)
        self.assertIsNone(token)

    @patch("recce.util.api_token.update_recce_api_token")
    @patch("recce.util.api_token.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="old-token")
    def test_new_token_invalid(self, mock_get_token, mock_recce_cloud, mock_update_token):
        from recce.util.api_token import prepare_api_token

        mock_recce_cloud.return_value.verify_token.return_value = False
        with self.assertRaises(RecceConfigException):
            prepare_api_token(api_token="new-invalid-token")

    @patch("recce.util.api_token.update_recce_api_token")
    @patch("recce.util.api_token.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="old-token")
    def test_new_token_valid(self, mock_get_token, mock_recce_cloud, mock_update_token):
        from recce.util.api_token import prepare_api_token

        mock_recce_cloud.return_value.verify_token.return_value = True
        token = prepare_api_token(api_token="new-valid-token")
        self.assertEqual(token, "new-valid-token")
        mock_update_token.assert_called_once()

    @patch("recce.util.api_token.console.print")
    @patch("recce.util.api_token.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="valid-token")
    def test_existing_token_valid(self, mock_get_token, mock_recce_cloud, mock_print):
        from recce.util.api_token import prepare_api_token

        mock_recce_cloud.return_value.verify_token.return_value = True
        token = prepare_api_token()
        self.assertEqual(token, "valid-token")

    @patch("recce.util.api_token.console.print")
    @patch("recce.util.api_token.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value="invalid-token")
    def test_existing_token_invalid(self, mock_get_token, mock_recce_cloud, mock_print):
        from recce.util.api_token import prepare_api_token

        mock_recce_cloud.return_value.verify_token.return_value = False
        token = prepare_api_token()
        self.assertIsNone(token)
        mock_print.assert_any_call("[[yellow]Warning[/yellow]] Invalid Recce Cloud API token. Skipping the share link.")

    @patch("recce.util.api_token.set_recce_cloud_onboarding_state")
    @patch("recce.util.api_token.get_recce_cloud_onboarding_state", return_value="new")
    @patch("recce.util.api_token.update_recce_api_token")
    @patch("recce.util.api_token.click.prompt", return_value="token")
    @patch("recce.util.api_token.console.print")
    @patch("recce.util.api_token.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value=None)
    def test_interactive_token_flow(
        self,
        mock_get_token,
        mock_recce_cloud,
        mock_print,
        mock_prompt,
        mock_update_token,
        mock_get_onboard,
        mock_set_onboard,
    ):
        from recce.util.api_token import prepare_api_token

        mock_recce_cloud.return_value.verify_token.return_value = True
        token = prepare_api_token(interaction=True)
        self.assertEqual(token, "token")
        mock_prompt.assert_called_once()
        mock_update_token.assert_called_once()
        mock_set_onboard.assert_called_once_with("token", "launched")

    @patch("recce.util.api_token.set_recce_cloud_onboarding_state")
    @patch("recce.util.api_token.get_recce_cloud_onboarding_state", return_value="new")
    @patch("recce.util.api_token.update_recce_api_token")
    @patch("recce.util.api_token.click.prompt", return_value="token")
    @patch("recce.util.api_token.console.print")
    @patch("recce.util.api_token.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value=None)
    def test_interactive_token_invalid_flow(
        self,
        mock_get_token,
        mock_recce_cloud,
        mock_print,
        mock_prompt,
        mock_update_token,
        mock_get_onboard,
        mock_set_onboard,
    ):
        from recce.util.api_token import prepare_api_token

        mock_recce_cloud.return_value.verify_token.return_value = False
        mock_prompt.return_value = "invalid-token"
        with self.assertRaises(RecceConfigException):
            prepare_api_token(interaction=True)
            mock_prompt.assert_called_once()
