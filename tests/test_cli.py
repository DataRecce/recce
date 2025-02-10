from unittest import TestCase
from unittest.mock import patch, MagicMock

from click.testing import CliRunner

from recce.cli import server as cli_command_server, run as cli_command_run
from recce.core import RecceContext
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

    @patch.object(RecceContext, 'verify_required_artifacts')
    @patch('recce.cli.uvicorn.run')
    def test_cmd_server(self, mock_run, mock_verify_required_artifacts):
        from recce.server import app
        mock_verify_required_artifacts.return_value = True, None
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

    @patch.object(RecceContext, 'verify_required_artifacts')
    @patch('recce.util.recce_cloud.get_recce_cloud_onboarding_state')
    @patch('recce.cli.uvicorn.run')
    @patch('recce.cli.RecceStateLoader')
    def test_cmd_server_with_cloud(self, mock_state_loader_class, mock_run, mock_get_recce_cloud_onboarding_state,
                                   mock_verify_required_artifacts):
        mock_state_loader = MagicMock(spec=RecceStateLoader)
        mock_state_loader.verify.return_value = True
        mock_state_loader.review_mode = True
        mock_get_recce_cloud_onboarding_state.return_value = 'completed'
        mock_verify_required_artifacts.return_value = True, None

        mock_state_loader_class.return_value = mock_state_loader
        self.runner.invoke(cli_command_server, ['--cloud', '--password', 'unittest', '--cloud-token', 'unittest'])
        mock_state_loader_class.assert_called_once()
        mock_run.assert_called_once()

    @patch.object(RecceContext, 'verify_required_artifacts')
    @patch('os.path.isdir', side_effect=lambda path: True if path == 'existed_folder' else False)
    @patch('recce.cli.uvicorn.run')
    @patch('recce.server.AppState')
    def test_cmd_server_with_single_env(self,
                                        mock_app_state, mock_run, mock_isdir, mock_verify_required_artifacts):
        mock_verify_required_artifacts.return_value = True, None
        self.runner.invoke(cli_command_server,
                           [
                               '--target-path', 'existed_folder',
                               '--target-base-path', 'non_existed_folder',
                           ])
        mock_run.assert_called_once()

        # Onboarding mode should be set to True
        app_state_call_args = mock_app_state.call_args
        app_state_flag = app_state_call_args.kwargs['flag']
        assert 'single_env_onboarding' in app_state_flag
        assert app_state_flag['single_env_onboarding'] is True
        assert 'show_relaunch_hint' in app_state_flag
        assert app_state_flag['show_relaunch_hint'] is True

        # The target_base_path should be set to the same as target_path
        verify_required_artifacts_args = mock_verify_required_artifacts.call_args
        assert verify_required_artifacts_args.kwargs['target_path'] == verify_required_artifacts_args.kwargs[
            'target_base_path']

    @patch.object(RecceContext, 'verify_required_artifacts')
    @patch('os.path.isdir', side_effect=lambda path: True if path == 'existed_folder' else False)
    @patch('recce.cli.uvicorn.run')
    @patch('recce.server.AppState')
    def test_cmd_server_with_single_env_but_review_mode_enabled(self,
                                                                mock_app_state, mock_run, mock_isdir,
                                                                mock_verify_required_artifacts):
        mock_verify_required_artifacts.return_value = True, None
        self.runner.invoke(cli_command_server,
                           [
                               'existed_state_file',
                               '--review',
                               '--target-path', 'existed_folder',
                               '--target-base-path', 'non_existed_folder',
                           ])
        mock_run.assert_called_once()
        app_state_call_args = mock_app_state.call_args
        app_state_flag = app_state_call_args.kwargs['flag']
        assert 'single_env_onboarding' in app_state_flag
        assert app_state_flag['single_env_onboarding'] is False


class TestCommandRun(TestCase):
    def setUp(self):
        self.runner = CliRunner()
        pass

    @patch.object(RecceContext, 'verify_required_artifacts')
    @patch('recce.cli.cli_run')
    def test_cmd_run(self, mock_cli_run, mock_verify_required_artifacts):
        mock_verify_required_artifacts.return_value = True, None

        self.runner.invoke(cli_command_run, [])
        mock_cli_run.assert_called_once()
