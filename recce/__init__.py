import os


def is_ci_env():
    # List of CI environment variables and their expected values
    ci_environments = {
        'CI': 'true',                   # Generic CI indicator
        'CIRCLECI': 'true',             # CircleCI
        'GITHUB_ACTIONS': 'true',       # GitHub Actions
        'GITLAB_CI': 'true',            # GitLab CI
        'JENKINS_URL': None,            # Jenkins (just needs to exist)
        'TRAVIS': 'true',               # Travis CI
        'APPVEYOR': 'true',             # AppVeyor
        'DRONE': 'true',                # Drone CI
        'TEAMCITY_VERSION': None,       # TeamCity
        'BITBUCKET_COMMIT': None,       # Bitbucket Pipelines
        'BUILDKITE': 'true',            # Buildkite
        'CODEBUILD_BUILD_ID': None,     # AWS CodeBuild
        'AZURE_PIPELINES': 'true',      # Azure Pipelines
    }

    for env_var, expected_value in ci_environments.items():
        env_value = os.environ.get(env_var)
        if env_value is not None:
            # If we just need the variable to exist
            if expected_value is None:
                return True
            # If we need to match a specific value (case-insensitive)
            if env_value.lower() == expected_value.lower():
                return True

    return False


def get_runner():
    # GitHub Action
    if os.environ.get('GITHUB_ACTIONS', 'false') == 'true':
        return 'github actions'

    # GitHub Codespace
    if os.environ.get('CODESPACES', 'false') == 'true':
        return 'github codespaces'

    # CircleCI
    if os.environ.get('CIRCLECI', 'false') == 'true':
        return 'circleci'

    return None


def get_version():
    version_file = os.path.normpath(os.path.join(os.path.dirname(__file__), 'VERSION'))
    with open(version_file) as fh:
        version = fh.read().strip()
        return version


__version__ = get_version()
