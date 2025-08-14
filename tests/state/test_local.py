import os
import tempfile
import unittest
from unittest.mock import patch

from recce.models import Check, Run, RunType
from recce.state import FileStateLoader, RecceState, RecceStateLoader


class TestFileStateLoader(unittest.TestCase):
    def setUp(self):
        self.temp_file = None
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        if self.temp_file and os.path.exists(self.temp_file):
            os.remove(self.temp_file)

    def test_init_with_defaults(self):
        loader = FileStateLoader()
        self.assertFalse(loader.review_mode)
        self.assertFalse(loader.cloud_mode)
        self.assertIsNone(loader.state_file)
        self.assertIsNone(loader.state)

    def test_init_with_parameters(self):
        state_file = "/path/to/state.json"
        initial_state = RecceState()
        loader = FileStateLoader(review_mode=True, state_file=state_file, initial_state=initial_state)
        self.assertTrue(loader.review_mode)
        self.assertFalse(loader.cloud_mode)
        self.assertEqual(loader.state_file, state_file)
        self.assertEqual(loader.state, initial_state)

    def test_verify_review_mode_without_state_file(self):
        loader = FileStateLoader(review_mode=True, state_file=None)
        self.assertFalse(loader.verify())
        self.assertEqual(loader.error_message, "Recce can not launch without a state file.")
        self.assertEqual(loader.hint_message, "Please provide a state file in the command argument.")

    def test_verify_review_mode_with_state_file(self):
        loader = FileStateLoader(review_mode=True, state_file="/path/to/state.json")
        self.assertTrue(loader.verify())
        self.assertIsNone(loader.error_message)
        self.assertIsNone(loader.hint_message)

    def test_verify_non_review_mode(self):
        loader = FileStateLoader(review_mode=False, state_file=None)
        self.assertTrue(loader.verify())

    def test_load_state_with_existing_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            self.temp_file = f.name
            run = Run(type=RunType.QUERY, params=dict(sql_template="select 1"))
            check = Check(name="test check", description="test", type=run.type, params=run.params)
            state = RecceState(runs=[run], checks=[check])
            f.write(state.to_json())

        loader = FileStateLoader(state_file=self.temp_file)
        loaded_state, etag = loader._load_state()

        self.assertIsInstance(loaded_state, RecceState)
        self.assertEqual(len(loaded_state.runs), 1)
        self.assertEqual(len(loaded_state.checks), 1)
        self.assertIsNone(etag)

    def test_load_state_without_file(self):
        loader = FileStateLoader(state_file=None)
        state, etag = loader._load_state()

        self.assertIsNone(state)
        self.assertIsNone(etag)

    def test_export_state_without_file(self):
        loader = FileStateLoader(state_file=None)
        loader.state = RecceState()

        message, tag = loader._export_state()

        self.assertEqual(message, "No state file is provided. Skip storing the state.")
        self.assertIsNone(tag)

    def test_export_state_with_file(self):
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            self.temp_file = f.name

        run = Run(type=RunType.QUERY, params=dict(sql_template="select 1"))
        initial_state = RecceState(runs=[run])

        loader = FileStateLoader(state_file=self.temp_file, initial_state=initial_state)

        with patch("recce.state.local.logger") as mock_logger:
            message, tag = loader._export_state()

        self.assertTrue(message.startswith("The state file is stored at"))
        self.assertIn(self.temp_file, message)
        self.assertIsNone(tag)
        mock_logger.info.assert_called_once()

        # Verify file was actually written
        self.assertTrue(os.path.exists(self.temp_file))
        loaded_state = RecceState.from_file(self.temp_file)
        self.assertEqual(len(loaded_state.runs), 1)

    def test_purge_with_existing_file(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            self.temp_file = f.name
            # Write valid JSON content for initial state
            f.write(b'{"runs": [], "checks": []}')

        loader = FileStateLoader(state_file=self.temp_file)
        result = loader.purge()

        self.assertTrue(result)
        self.assertFalse(os.path.exists(self.temp_file))
        self.assertIsNone(loader.error_message)

    def test_purge_with_nonexistent_file(self):
        nonexistent_file = "/nonexistent/path/file.json"
        loader = FileStateLoader(state_file=nonexistent_file)

        result = loader.purge()

        self.assertFalse(result)
        self.assertIsNotNone(loader.error_message)
        self.assertTrue(loader.error_message.startswith("Failed to remove the state file:"))

    def test_purge_without_file(self):
        loader = FileStateLoader(state_file=None)

        result = loader.purge()

        self.assertFalse(result)
        self.assertEqual(loader.error_message, "No state file is provided. Skip removing the state file.")

    def test_inheritance_from_state_loader(self):
        loader = FileStateLoader()
        self.assertIsInstance(loader, RecceStateLoader)

    def test_load_method_calls_load_state(self):
        loader = FileStateLoader(state_file=None)

        with patch.object(loader, "_load_state") as mock_load_state:
            mock_load_state.return_value = (RecceState(), None)
            result = loader.load()

            mock_load_state.assert_called_once()
            self.assertIsInstance(result, RecceState)

    def test_export_method_calls_export_state(self):
        loader = FileStateLoader(state_file=None)
        loader.state = RecceState()

        with patch.object(loader, "_export_state") as mock_export_state:
            mock_export_state.return_value = ("message", None)
            with patch("recce.state.local.logger"):
                result = loader.export()

            mock_export_state.assert_called_once()
            self.assertEqual(result, "message")


if __name__ == "__main__":
    unittest.main()
