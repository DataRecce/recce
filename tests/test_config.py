import os.path
from unittest import TestCase
from unittest.mock import patch

from recce.config import RecceConfig
from recce.util import SingletonMeta

test_root_path = os.path.dirname(os.path.abspath(__file__))


class RecceConfigTestCase(TestCase):
    def setUp(self):
        self.recce_config_path = os.path.join(test_root_path, 'data', 'config', 'recce.yml')
        pass

    def tearDown(self):
        # Reset the SingletonMeta instances due to RecceConfig is a singleton
        SingletonMeta._instances = {}

    def test_load_recce_config(self):
        config = RecceConfig(self.recce_config_path)

        # Test data contains 2 checks
        preset_checks = config.config.get('checks')
        self.assertIsNotNone(preset_checks)
        self.assertIsInstance(preset_checks, list)
        self.assertEqual(len(preset_checks), 2)

    @patch('recce.config.RecceConfig.save')
    def test_recce_config_not_found(self, mock_save):
        default_config = RecceConfig('NOT_EXISTING_FILE')
        assert mock_save.called is True
        # Default config should be generated
        preset_checks = default_config.config.get('checks')
        self.assertIsNotNone(default_config.config)
        self.assertIsInstance(preset_checks, list)
        self.assertEqual(len(preset_checks), 2)

    @patch('recce.yaml.safe_load')
    def test_recce_config_null_checks(self, mock_yaml_safe_load):
        # mock to load a yaml file with null checks
        mock_yaml_safe_load.return_value = {
            'checks': None
        }
        RecceConfig(self.recce_config_path)
