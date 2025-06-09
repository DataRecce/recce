import os
import tempfile
import yaml
import pytest
from click.testing import CliRunner
from recce.cli import cli, init, validate

@pytest.fixture
def runner():
    return CliRunner()

@pytest.fixture
def temp_profiles_dir(tmp_path):
    return str(tmp_path)

@pytest.fixture
def temp_project_dir(tmp_path):
    return str(tmp_path)

def test_init_command(runner, temp_profiles_dir, temp_project_dir):
    """Test the init command creates a valid profiles.yml file."""
    result = runner.invoke(init, [
        '--database-type', 'snowflake',
        '--profiles-dir', temp_profiles_dir,
        '--project-dir', temp_project_dir
    ])
    assert result.exit_code == 0
    assert "Created profiles.yml" in result.output

    # Verify the file was created
    profiles_path = os.path.join(temp_profiles_dir, 'profiles.yml')
    assert os.path.exists(profiles_path)

    # Verify the content
    with open(profiles_path, 'r') as f:
        config = yaml.safe_load(f)
        assert 'your_project_name' in config
        assert 'outputs' in config['your_project_name']
        assert 'dev' in config['your_project_name']['outputs']
        assert 'prod' in config['your_project_name']['outputs']

def test_validate_command(runner, temp_profiles_dir, temp_project_dir):
    """Test the validate command with different scenarios."""
    # First create a valid configuration
    runner.invoke(init, [
        '--database-type', 'snowflake',
        '--profiles-dir', temp_profiles_dir,
        '--project-dir', temp_project_dir
    ])

    # Test validation without connection testing
    result = runner.invoke(validate, [
        '--database-type', 'snowflake',
        '--profiles-dir', temp_profiles_dir,
        '--project-dir', temp_project_dir
    ])
    assert result.exit_code == 0
    assert "Configuration validation failed" in result.output
    assert "Missing or using default values for required fields" in result.output

def test_validate_command_missing_profiles(runner, temp_profiles_dir):
    """Test validate command with missing profiles.yml."""
    result = runner.invoke(validate, [
        '--database-type', 'snowflake',
        '--profiles-dir', temp_profiles_dir
    ])
    assert result.exit_code == 0
    assert "profiles.yml not found" in result.output

def test_validate_command_invalid_profiles(runner, temp_profiles_dir):
    """Test validate command with invalid profiles.yml."""
    # Create an invalid profiles.yml
    profiles_path = os.path.join(temp_profiles_dir, 'profiles.yml')
    with open(profiles_path, 'w') as f:
        f.write('invalid: yaml: content:')

    result = runner.invoke(validate, [
        '--database-type', 'snowflake',
        '--profiles-dir', temp_profiles_dir
    ])
    assert result.exit_code == 0
    assert "Failed to load profiles.yml" in result.output

def test_validate_command_auto_detect_db_type(runner, temp_profiles_dir):
    """Test validate command with auto-detection of database type."""
    # Create a valid profiles.yml with Snowflake configuration
    profiles_path = os.path.join(temp_profiles_dir, 'profiles.yml')
    config = {
        'test_project': {
            'outputs': {
                'dev': {
                    'type': 'snowflake',
                    'schema': 'dev',
                    'account': 'test',
                    'user': 'test',
                    'password': 'test',
                    'warehouse': 'test',
                    'role': 'test'
                },
                'prod': {
                    'type': 'snowflake',
                    'schema': 'prod',
                    'account': 'test',
                    'user': 'test',
                    'password': 'test',
                    'warehouse': 'test',
                    'role': 'test'
                }
            }
        }
    }
    with open(profiles_path, 'w') as f:
        yaml.dump(config, f)

    result = runner.invoke(validate, [
        '--profiles-dir', temp_profiles_dir
    ])
    assert result.exit_code == 0
    assert "Detected database type: snowflake" in result.output

def test_init_command_validation(runner, temp_profiles_dir, temp_project_dir):
    """Test init command with validation flag."""
    result = runner.invoke(init, [
        '--database-type', 'snowflake',
        '--validate',
        '--profiles-dir', temp_profiles_dir,
        '--project-dir', temp_project_dir
    ])
    assert result.exit_code == 0
    assert "Missing or using default values for required fields" in result.output
    assert "Please fix the configuration issues" in result.output

def test_validate_command_missing_env(runner, temp_profiles_dir):
    """Test validate command with missing environment configuration."""
    # Create profiles.yml with only dev environment
    profiles_path = os.path.join(temp_profiles_dir, 'profiles.yml')
    config = {
        'test_project': {
            'outputs': {
                'dev': {
                    'type': 'snowflake',
                    'schema': 'dev',
                    'account': 'test',
                    'user': 'test',
                    'password': 'test',
                    'warehouse': 'test',
                    'role': 'test'
                }
            }
        }
    }
    with open(profiles_path, 'w') as f:
        yaml.dump(config, f)

    result = runner.invoke(validate, [
        '--database-type', 'snowflake',
        '--test-connection',
        '--profiles-dir', temp_profiles_dir
    ])
    assert result.exit_code == 0
    assert "Missing dev environment configuration" in result.output 