import unittest
from unittest.mock import Mock, patch

from recce.exceptions import RecceException
from recce.state import RecceState, RecceStateLoader
from recce.state.const import RECCE_API_TOKEN_MISSING


class ConcreteStateLoader(RecceStateLoader):
    """Concrete implementation for testing the abstract base class"""

    def __init__(self, **kwargs):
        self.verify_result = True
        self.load_state_result = (RecceState(), "test_etag")
        self.export_state_result = ("exported", "test_etag")
        self.purge_result = True
        super().__init__(**kwargs)

    def verify(self) -> bool:
        return self.verify_result

    def _load_state(self):
        return self.load_state_result

    def _export_state(self):
        return self.export_state_result

    def purge(self) -> bool:
        return self.purge_result


class TestRecceStateLoader(unittest.TestCase):

    @patch("recce.state.state_loader.fetch_pr_metadata")
    def test_init_with_parameters(self, mock_fetch_pr):
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_fetch_pr.return_value = mock_pr_info

        initial_state = RecceState()
        cloud_options = {"github_token": "test_token"}

        loader = ConcreteStateLoader(
            review_mode=True,
            cloud_mode=True,
            state_file="/path/to/file.json",
            cloud_options=cloud_options,
            initial_state=initial_state,
        )

        self.assertTrue(loader.review_mode)
        self.assertTrue(loader.cloud_mode)
        self.assertEqual(loader.state_file, "/path/to/file.json")
        self.assertEqual(loader.cloud_options, cloud_options)
        self.assertEqual(loader.state, initial_state)

    @patch("recce.state.state_loader.fetch_pr_metadata")
    def test_cloud_mode_with_github_token(self, mock_fetch_pr):
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_fetch_pr.return_value = mock_pr_info

        cloud_options = {"github_token": "test_token"}
        loader = ConcreteStateLoader(cloud_mode=True, cloud_options=cloud_options)

        self.assertEqual(loader.catalog, "github")
        self.assertEqual(loader.pr_info, mock_pr_info)
        mock_fetch_pr.assert_called_once_with(cloud=True, github_token="test_token")

    @patch("recce.state.state_loader.fetch_pr_metadata")
    def test_cloud_mode_with_github_token_no_pr_id(self, mock_fetch_pr):
        mock_pr_info = Mock()
        mock_pr_info.id = None
        mock_fetch_pr.return_value = mock_pr_info

        cloud_options = {"github_token": "test_token"}

        with self.assertRaises(RecceException) as cm:
            ConcreteStateLoader(cloud_mode=True, cloud_options=cloud_options)

        self.assertEqual(str(cm.exception), "Cannot get the pull request information from GitHub.")

    def test_cloud_mode_with_api_token(self):
        cloud_options = {"api_token": "test_api_token", "share_id": "test_share_id"}
        loader = ConcreteStateLoader(cloud_mode=True, cloud_options=cloud_options)

        self.assertEqual(loader.catalog, "preview")
        self.assertEqual(loader.share_id, "test_share_id")

    def test_cloud_mode_without_tokens(self):
        with self.assertRaises(RecceException) as cm:
            ConcreteStateLoader(cloud_mode=True, cloud_options={})

        self.assertEqual(str(cm.exception), RECCE_API_TOKEN_MISSING.error_message)

    def test_error_and_hint_property(self):
        loader = ConcreteStateLoader()
        loader.error_message = "test error"
        loader.hint_message = "test hint"

        error, hint = loader.error_and_hint
        self.assertEqual(error, "test error")
        self.assertEqual(hint, "test hint")

    def test_load_with_existing_state(self):
        initial_state = RecceState()
        loader = ConcreteStateLoader(initial_state=initial_state)

        # Should return existing state without calling _load_state
        result = loader.load(refresh=False)
        self.assertEqual(result, initial_state)

    def test_load_with_refresh(self):
        initial_state = RecceState()
        loader = ConcreteStateLoader(initial_state=initial_state)
        new_state = RecceState()
        loader.load_state_result = (new_state, "new_etag")

        result = loader.load(refresh=True)
        self.assertEqual(result, new_state)
        self.assertEqual(loader.state_etag, "new_etag")

    def test_export_updates_state(self):
        loader = ConcreteStateLoader()
        new_state = RecceState()

        with patch("recce.state.state_loader.logger"):
            result = loader.export(new_state)

        self.assertEqual(loader.state, new_state)
        self.assertEqual(result, "exported")

    def test_save_as_in_cloud_mode(self):
        cloud_options = {"api_token": "test_token", "share_id": "test_share"}
        loader = ConcreteStateLoader(cloud_mode=True, cloud_options=cloud_options)

        with self.assertRaises(Exception) as cm:
            loader.save_as("/path/to/file.json")

        self.assertEqual(str(cm.exception), "Cannot save the state to Recce Cloud.")

    def test_save_as_in_local_mode(self):
        loader = ConcreteStateLoader(cloud_mode=False)
        state = RecceState()

        with patch.object(loader, "export") as mock_export:
            loader.save_as("/path/to/file.json", state)

        self.assertEqual(loader.state_file, "/path/to/file.json")
        mock_export.assert_called_once_with(state)

    def test_info_without_state(self):
        loader = ConcreteStateLoader()
        loader.state = None

        result = loader.info()

        self.assertIsNone(result)
        self.assertEqual(loader.error_message, "No state is loaded.")

    def test_info_local_mode(self):
        loader = ConcreteStateLoader(cloud_mode=False, state_file="/path/to/state.json")
        loader.state = RecceState()

        result = loader.info()

        expected = {
            "mode": "local",
            "source": "/path/to/state.json",
        }
        self.assertEqual(result, expected)

    @patch("recce.state.state_loader.fetch_pr_metadata")
    def test_info_cloud_mode_with_pr_info(self, mock_fetch_pr):
        mock_pr_info = Mock()
        mock_pr_info.id = "123"
        mock_fetch_pr.return_value = mock_pr_info

        cloud_options = {"github_token": "test_token"}
        loader = ConcreteStateLoader(cloud_mode=True, cloud_options=cloud_options)
        loader.state = RecceState()

        result = loader.info()

        expected = {
            "mode": "cloud",
            "source": "Recce Cloud",
            "pull_request": mock_pr_info,
        }
        self.assertEqual(result, expected)

    def test_update_state(self):
        loader = ConcreteStateLoader()
        new_state = RecceState()

        loader.update(new_state)
        self.assertEqual(loader.state, new_state)

    def test_refresh(self):
        loader = ConcreteStateLoader()
        new_state = RecceState()
        loader.load_state_result = (new_state, "new_etag")

        result = loader.refresh()

        self.assertEqual(result, new_state)
        self.assertEqual(loader.state, new_state)


if __name__ == "__main__":
    unittest.main()
