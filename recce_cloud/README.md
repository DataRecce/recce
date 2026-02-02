# Recce Cloud CLI

Lightweight command-line tool for managing dbt artifacts with Recce Cloud in
CI/CD environments.

## Overview

The Recce Cloud CLI (`recce-cloud`) is a standalone tool designed for CI/CD
pipelines that need to upload and download dbt artifacts (manifest.json and
catalog.json) to/from Recce Cloud without the full `recce` package dependencies.

**Key Features:**

- Lightweight - minimal dependencies for fast CI/CD execution
- Auto-detection - automatically detects CI platform, repository, and PR/MR
  context
- Upload/Download - push and pull dbt artifacts to/from Recce Cloud sessions
- Flexible authentication - browser-based login, token-based auth, or CI tokens
- Platform-specific - optimized for GitHub Actions and GitLab CI

## Installation

### Quick Run (no install needed)

Using [uv](https://github.com/astral-sh/uv), you can run `recce-cloud` directly
without installation:

```bash
# Run with uvx (creates temporary isolated environment)
uvx recce-cloud upload --type prod
uvx recce-cloud download --prod --target-path target-base

# Short alias also available
uvx --from recce-cloud rcc upload --type prod
```

### Permanent Install

```bash
# With uv (recommended)
uv tool install recce-cloud

# With pip
pip install recce-cloud

# With pipx
pipx install recce-cloud
```

## Quick Start

### Local Development

```bash
# Login to Recce Cloud (opens browser for authentication)
recce-cloud login

# Initialize project binding (interactive)
recce-cloud init

# Check current status
recce-cloud init --status

# Logout
recce-cloud logout
```

### GitHub Actions

```yaml
- name: Upload to Recce Cloud
  run: recce-cloud upload
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Download from Recce Cloud
  run: recce-cloud download --prod --target-path target-base
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GitLab CI

```yaml
recce-upload:
  script:
    - recce-cloud upload

recce-download:
  script:
    - recce-cloud download --prod --target-path target-base
```

## CI/CD Workflows

### Upload Workflow

The `recce-cloud upload` command automatically creates sessions in supported CI
environments.

```bash
# Basic upload (auto-detects CI context)
recce-cloud upload

# Custom target path
recce-cloud upload --target-path custom-target

# Override PR number or session type
recce-cloud upload --pr 123 --type pr

# Generic workflow with session name (for other CI platforms)
recce-cloud upload --session-name "PR-123" --yes
```

**Options:**

| Option           | Description                                      |
| ---------------- | ------------------------------------------------ |
| `--target-path`  | Path to dbt target directory (default: `target`) |
| `--session-id`   | Session ID for generic workflow                  |
| `--session-name` | Session name for human-readable workflow         |
| `--pr`           | Override PR/MR number                            |
| `--type`         | Override session type: `pr`, `prod`, `dev`       |
| `--yes`          | Auto-confirm session creation                    |
| `--dry-run`      | Preview without uploading                        |

### Download Workflow

The `recce-cloud download` command retrieves artifacts from Recce Cloud
sessions.

```bash
# Download current PR/MR session
recce-cloud download

# Download production/base session
recce-cloud download --prod

# Download to custom path
recce-cloud download --prod --target-path target-base

# Force overwrite existing files
recce-cloud download --force

# Generic workflow with session ID
recce-cloud download --session-id abc123
```

**Options:**

| Option          | Description                              |
| --------------- | ---------------------------------------- |
| `--target-path` | Download destination (default: `target`) |
| `--session-id`  | Session ID for generic workflow          |
| `--prod`        | Download production/base session         |
| `--force`, `-f` | Overwrite existing files                 |
| `--dry-run`     | Preview without downloading              |

## Authentication

The CLI supports multiple authentication methods (in priority order):

1. **RECCE_API_TOKEN** - Environment variable (recommended for CI)
2. **GITHUB_TOKEN** - GitHub Actions (must be explicitly set)
3. **CI_JOB_TOKEN** - GitLab CI (auto-detected)
4. **Stored credentials** - From `recce-cloud login`

### Getting API Tokens

**Recce Cloud API Token:**

1. Log in to [Recce Cloud](https://cloud.datarecce.io)
2. Go to Settings → API Tokens

## CI/CD Integration Examples

### GitHub Actions - Complete Workflow

```yaml
name: Recce CI

on:
  pull_request:
    branches: [main]

jobs:
  recce:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install dbt-core dbt-snowflake recce-cloud

      # Download production artifacts for comparison
      - name: Download base artifacts
        run: recce-cloud download --prod --target-path target-base
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Build current PR
      - name: Build dbt project
        run: |
          dbt deps
          dbt build
          dbt docs generate

      # Upload current PR artifacts
      - name: Upload to Recce Cloud
        run: recce-cloud upload
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GitLab CI - Complete Workflow

```yaml
stages:
  - download
  - build
  - upload

recce-download-base:
  stage: download
  image: python:3.11-slim
  script:
    - pip install recce-cloud
    - recce-cloud download --prod --target-path target-base
  artifacts:
    paths:
      - target-base/
  only:
    - merge_requests

dbt-build:
  stage: build
  image: python:3.11-slim
  script:
    - pip install dbt-core dbt-snowflake
    - dbt deps
    - dbt build
    - dbt docs generate
  artifacts:
    paths:
      - target/
  only:
    - merge_requests

recce-upload:
  stage: upload
  image: python:3.11-slim
  script:
    - pip install recce-cloud
    - recce-cloud upload
  dependencies:
    - dbt-build
  only:
    - merge_requests
```

### Generic CI Platform

For other CI platforms, use session name workflow with your PR/MR number:

```bash
export RECCE_API_TOKEN=your_token_here

# Upload PR artifacts (creates session if not exists)
recce-cloud upload --session-name "PR-${PR_NUMBER}" --yes

# Upload production artifacts (in CD pipeline after merge)
recce-cloud upload --type prod --yes
```

The `--session-name` option creates a human-readable session that's easy to
track. Use `--yes` to auto-confirm session creation in CI environments.

## Environment Variables

| Variable           | Description                              |
| ------------------ | ---------------------------------------- |
| `RECCE_API_TOKEN`  | Recce Cloud API token                    |
| `RECCE_SESSION_ID` | Default session ID for generic workflows |
| `GITHUB_TOKEN`     | GitHub authentication (Actions)          |
| `CI_JOB_TOKEN`     | GitLab CI job token (auto-detected)      |

## Additional Commands

Beyond upload and download, the CLI provides:

```bash
# List sessions in your project
recce-cloud list

# Delete a session
recce-cloud delete --session-id abc123

# Generate AI review for a session
recce-cloud review --session-id abc123

# Generate PR metrics report
recce-cloud report --since 30d

# Diagnose setup issues
recce-cloud doctor

# Show version
recce-cloud version
```

Run `recce-cloud <command> --help` for detailed options.

## Troubleshooting

### Quick Diagnosis

```bash
recce-cloud doctor
```

This validates login status, project binding, and session availability.

### Common Issues

**Missing dbt artifacts:**

```bash
dbt build
dbt docs generate  # Required before upload
recce-cloud upload
```

**Authentication failed:**

- For GitHub Actions: Set `GITHUB_TOKEN` in env
- For GitLab CI: `CI_JOB_TOKEN` is auto-detected
- For generic CI: Set `RECCE_API_TOKEN`

**Platform not supported:**

```bash
# Use session name workflow for unsupported CI platforms
recce-cloud upload --session-name "PR-${PR_NUMBER}" --yes
```

### Debug Mode

```bash
export RECCE_LOG_LEVEL=DEBUG
recce-cloud upload
```

## Support

- **Documentation:** [docs.reccehq.com](https://docs.reccehq.com)
- **Issues:** [GitHub Issues](https://github.com/DataRecce/recce/issues)
- **Community:** [Recce Slack](https://getdbt.slack.com/archives/C05C28V7CPP)
- **Email:** <support@reccehq.com>

## License

Apache License 2.0 - See [LICENSE](../LICENSE) file for details.
