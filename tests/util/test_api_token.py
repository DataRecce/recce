import unittest
from unittest.mock import patch

from recce.exceptions import RecceConfigException


class PrepareApiTokenTest(unittest.TestCase):

    @patch("recce.util.api_token.console.print")
    def test_show_invalid_api_token_message(self, mock_print):
        from recce.util.api_token import (
            show_invalid_api_token_message,
        )

        show_invalid_api_token_message()
        mock_print.assert_any_call("[[red]Error[/red]] Invalid Recce Cloud API token.")

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

    @patch("recce.util.api_token.update_recce_api_token")
    @patch("recce.util.api_token.click.prompt", return_value="token")
    @patch("recce.util.api_token.console.print")
    @patch("recce.util.api_token.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value=None)
    def test_interactive_token_flow(self, mock_get_token, mock_recce_cloud, mock_print, mock_prompt, mock_update_token):
        from recce.util.api_token import prepare_api_token

        mock_recce_cloud.return_value.verify_token.return_value = True
        token = prepare_api_token(interaction=True)
        self.assertEqual(token, "token")
        mock_prompt.assert_called_once()
        mock_update_token.assert_called_once()

    @patch("recce.util.api_token.update_recce_api_token")
    @patch("recce.util.api_token.click.prompt", return_value="token")
    @patch("recce.util.api_token.console.print")
    @patch("recce.util.api_token.RecceCloud")
    @patch("recce.util.api_token.get_recce_api_token", return_value=None)
    def test_interactive_token_invalid_flow(
        self, mock_get_token, mock_recce_cloud, mock_print, mock_prompt, mock_update_token
    ):
        from recce.util.api_token import prepare_api_token

        mock_recce_cloud.return_value.verify_token.return_value = False
        mock_prompt.return_value = "invalid-token"
        with self.assertRaises(RecceConfigException):
            prepare_api_token(interaction=True)
            mock_prompt.assert_called_once()

    @patch("recce.util.recce_cloud.is_anonymous_tracking", return_value=True)
    @patch("recce.util.recce_cloud.get_user_id", return_value="unittest-user")
    @patch("recce.util.recce_cloud.get_version", return_value="unittest-version")
    def test_verify_token_append_tracking_data(self, mock_is_anonymous_tracking, mock_get_user_id, mock_get_version):
        from recce.util.api_token import RecceCloud

        recce_cloud = RecceCloud("valid-token")
        with patch.object(recce_cloud, "_request") as mock_request:
            mock_request.return_value.status_code = 200
            mock_request.return_value.json.return_value = {"status": "success"}

            result = recce_cloud.verify_token()
            called_kwargs = mock_request.call_args.kwargs
            self.assertDictEqual(
                called_kwargs,
                {
                    "headers": {
                        "X-Recce-Oss-User-Id": "unittest-user",
                        "X-Recce-Oss-Version": "unittest-version",
                    }
                },
            )
            self.assertTrue(result)
