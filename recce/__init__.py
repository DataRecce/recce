import os
import sys


def is_ci_env():
    # some CI service puts the "CI" var
    if os.environ.get('CI', 'false') == 'true':
        return True

    # For CiecleCI exceptions
    if os.environ.get('CIRCLECI', 'false') == 'true':
        return True

    # if not tty, it probably runs automatically
    if not sys.stdout.isatty():
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
