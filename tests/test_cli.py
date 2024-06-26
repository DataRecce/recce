from unittest import TestCase
from unittest.mock import patch, MagicMock

from click.testing import CliRunner

from recce.cli import server as cli_command_server
from recce.state import RecceStateLoader


def test_cmd_version():
    from recce.cli import version
    from recce import __version__
    runner = CliRunner()
    result = runner.invoke(version, [])
    assert result.exit_code == 0
    assert result.output.replace('\n', '') == __version__


class TestCommandServer(TestCase):
    def setUp(self):
        self.runner = CliRunner()
        pass

    @patch('recce.cli.uvicorn.run')
    def test_cmd_server(self, mock_run):
        from recce.server import app
        self.runner.invoke(cli_command_server, ['--host', 'unittest', '--port', 5566])
        mock_run.assert_called_once_with(app, host='unittest', port=5566, lifespan='on')

    @patch('recce.cli.uvicorn.run')
    def test_cmd_server_with_cloud_without_password(self, mock_run):
        # Should fail if no password is provided
        result = self.runner.invoke(cli_command_server, ['--cloud'])
        assert result.exit_code == 1

    @patch('recce.cli.uvicorn.run')
    def test_cmd_server_with_cloud_without_token(self, mock_run):
        # Should fail if no token is provided
        result = self.runner.invoke(cli_command_server, ['--cloud', '--password', 'unittest'])
        assert result.exit_code == 1

    @patch('recce.cli.uvicorn.run')
    @patch('recce.cli.RecceStateLoader')
    def test_cmd_server_with_cloud(self, mock_state_loader_class, mock_run):
        mock_state_loader = MagicMock(spec=RecceStateLoader)
        mock_state_loader.verify.return_value = True
        mock_state_loader.review_mode = True

        mock_state_loader_class.return_value = mock_state_loader
        self.runner.invoke(cli_command_server, ['--cloud', '--password', 'unittest', '--cloud-token', 'unittest'])
        mock_state_loader_class.assert_called_once()
        mock_run.assert_called_once()
