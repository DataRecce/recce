# Recce Cloud CLI

A lightweight, standalone CLI for managing Recce Cloud operations in CI/CD environments.

## Overview

The `recce-cloud` package provides a minimal CLI tool specifically designed for cloud operations, without the heavy dependencies of the full `recce` package. This makes it ideal for CI/CD pipelines where installation speed matters.

## Dependency Comparison

**recce-cloud** (3 dependencies):
- click
- requests
- rich

**recce** (20+ dependencies):
- boto3, click, deepdiff, fastapi, GitPython, itsdangerous, jinja2, packaging, portalocker, py-markdown-table, pydantic, PyGithub, python-dateutil, python-multipart, pytz, requests, rich, ruamel.yaml, sentry-sdk, sqlglot, uvicorn, watchdog, websockets

## Installation

### Development Mode

From the repository root:

```bash
python setup_cloud.py develop
```

### Production Install (when published to PyPI)

```bash
pip install recce-cloud
```

## Usage

```bash
# Check version
recce-cloud --version

# Get help
recce-cloud --help
```

## Package Structure

```
recce_cloud/
├── __init__.py          # Package initialization and version
├── cli.py              # Main CLI entry point
└── VERSION             # Version file (synced with main recce)
```

## CI/CD Integration Example

```yaml
# GitHub Actions example
- name: Install recce-cloud
  run: pip install recce-cloud

- name: Use recce-cloud
  run: recce-cloud --version
```

## Development

The `recce-cloud` package is developed within the same repository as `recce` but is packaged and distributed separately:

- **Main package**: `setup.py` → installs `recce` command
- **Cloud package**: `setup_cloud.py` → installs `recce-cloud` command

Both packages share the same VERSION file to keep versions synchronized.

## Future Commands

The CLI is designed to be extended with cloud-specific commands such as:
- `recce-cloud list-sessions` - List Recce Cloud sessions
- `recce-cloud purge` - Purge cloud state files
- `recce-cloud upload` - Upload state files to cloud

Currently, only the basic CLI structure with version command is implemented.
