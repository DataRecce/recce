# Recce Cloud CLI

Lightweight command-line tool for uploading dbt artifacts to Recce Cloud in CI/CD environments.

## Overview

The Recce Cloud CLI (`recce-cloud`) is a standalone tool designed for CI/CD pipelines that need to upload dbt artifacts (manifest.json and catalog.json) to Recce Cloud without the full `recce` package dependencies.

**Key Features:**

- 🚀 Lightweight - minimal dependencies for fast CI/CD execution
- 🤖 Auto-detection - automatically detects CI platform, repository, and PR/MR context
- 🔄 Dual workflows - supports both auto-session creation and existing session uploads
- 🔐 Flexible authentication - works with CI tokens or explicit API tokens
- ✅ Platform-specific - optimized for GitHub Actions and GitLab CI

## Installation

```bash
pip install recce-cloud
```

Or in your CI/CD workflow:

```yaml
# GitHub Actions
- name: Install recce-cloud
  run: pip install recce-cloud

# GitLab CI
install:
  script:
    - pip install recce-cloud
```

## Quick Start

### GitHub Actions

```yaml
- name: Upload to Recce Cloud
  run: recce-cloud upload
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    RECCE_API_TOKEN: ${{ secrets.RECCE_API_TOKEN }}
```

### GitLab CI

```yaml
recce-upload:
  script:
    - recce-cloud upload
  variables:
    RECCE_API_TOKEN: $RECCE_API_TOKEN
```

## Upload Workflows

The `recce-cloud upload` command supports two workflows:

### 1. Platform-Specific Workflow (Recommended)

**For GitHub Actions and GitLab CI**

Automatically creates Recce Cloud sessions using platform-specific APIs. No session ID required.

**Features:**

- ✅ Auto-creates session with `touch-recce-session` API
- ✅ Auto-detects PR/MR context and links session
- ✅ Notifies upload completion
- ✅ Works with CI-provided tokens (GITHUB_TOKEN, CI_JOB_TOKEN)

**Usage:**

```bash
# GitHub Actions
recce-cloud upload

# GitLab CI
recce-cloud upload

# With custom target path
recce-cloud upload --target-path custom-target

# With manual overrides
recce-cloud upload --cr 123 --type cr
```

**Requirements:**

- Running in GitHub Actions or GitLab CI environment
- RECCE_API_TOKEN or CI-provided token (GITHUB_TOKEN/CI_JOB_TOKEN)
- dbt artifacts in target directory

### 2. Generic Workflow

**For other CI platforms or existing sessions**

Uploads to a pre-existing Recce Cloud session using session ID.

**Usage:**

```bash
# With session ID parameter
recce-cloud upload --session-id abc123

# With environment variable
export RECCE_SESSION_ID=abc123
recce-cloud upload

# With custom target path
recce-cloud upload --session-id abc123 --target-path my-target
```

**Requirements:**

- Pre-created session ID (from Recce Cloud web app or API)
- RECCE_API_TOKEN
- dbt artifacts in target directory

## Command Reference

### `recce-cloud upload`

Upload dbt artifacts to Recce Cloud session.

**Options:**

| Option          | Type    | Default  | Description                                   |
| --------------- | ------- | -------- | --------------------------------------------- |
| `--target-path` | path    | `target` | Path to dbt target directory                  |
| `--session-id`  | string  | -        | Session ID for generic workflow (optional)    |
| `--cr`          | integer | -        | Override PR/MR number                         |
| `--type`        | choice  | -        | Override session type: `cr`, `prod`, `dev`    |
| `--dry-run`     | flag    | false    | Show what would be uploaded without uploading |

**Environment Variables:**

| Variable           | Required      | Description                     |
| ------------------ | ------------- | ------------------------------- |
| `RECCE_API_TOKEN`  | Recommended   | Recce Cloud API token           |
| `RECCE_SESSION_ID` | Optional      | Session ID for generic workflow |
| `GITHUB_TOKEN`     | Auto-detected | GitHub authentication (Actions) |
| `CI_JOB_TOKEN`     | Auto-detected | GitLab authentication (CI)      |

**Exit Codes:**

| Code | Description                                         |
| ---- | --------------------------------------------------- |
| 0    | Success                                             |
| 1    | Platform not supported (platform-specific workflow) |
| 2    | Authentication error                                |
| 3    | File validation error                               |
| 4    | Upload error                                        |

### `recce-cloud version`

Display the version of recce-cloud.

```bash
recce-cloud version
```

## Authentication

The CLI supports multiple authentication methods with the following priority:

1. **RECCE_API_TOKEN** (explicit token) - Recommended for production
2. **CI-provided tokens** - GITHUB_TOKEN (Actions) or CI_JOB_TOKEN (GitLab CI)
3. Error if no token available

### Getting API Tokens

**Recce Cloud API Token:**

1. Log in to [Recce Cloud](https://cloud.datarecce.io)
2. Go to Settings → API Tokens
3. Create a new token
4. Add to CI/CD secrets as `RECCE_API_TOKEN`

**GitHub Token:**

- Automatically available as `${{ secrets.GITHUB_TOKEN }}` in Actions
- No additional configuration needed

**GitLab Token:**

- Automatically available as `$CI_JOB_TOKEN` in GitLab CI
- No additional configuration needed

## Auto-Detection

The CLI automatically detects your CI environment:

### Detected Information

| Information   | GitHub Actions        | GitLab CI                                |
| ------------- | --------------------- | ---------------------------------------- |
| Platform      | ✅ `github-actions`   | ✅ `gitlab-ci`                           |
| Repository    | ✅ `owner/repo`       | ✅ `group/project`                       |
| PR/MR Number  | ✅ From event payload | ✅ From `CI_MERGE_REQUEST_IID`           |
| PR/MR URL     | ✅ Constructed        | ✅ Constructed (self-hosted support)     |
| Commit SHA    | ✅ `GITHUB_SHA`       | ✅ `CI_COMMIT_SHA`                       |
| Source Branch | ✅ `GITHUB_HEAD_REF`  | ✅ `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` |
| Base Branch   | ✅ `GITHUB_BASE_REF`  | ✅ `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` |
| Session Type  | ✅ Auto-determined    | ✅ Auto-determined                       |
| Access Token  | ✅ `GITHUB_TOKEN`     | ✅ `CI_JOB_TOKEN`                        |

### Manual Overrides

You can override auto-detected values:

```bash
# Override PR/MR number
recce-cloud upload --cr 456

# Override session type
recce-cloud upload --type prod

# Multiple overrides
recce-cloud upload --cr 789 --type cr

# Dry run - preview what would be uploaded
recce-cloud upload --dry-run
```

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
        run: |
          pip install dbt-core dbt-postgres recce-cloud

      - name: Build dbt project
        run: |
          dbt deps
          dbt build
          dbt docs generate

      - name: Upload to Recce Cloud
        run: recce-cloud upload
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          RECCE_API_TOKEN: ${{ secrets.RECCE_API_TOKEN }}
```

### GitLab CI - Complete Workflow

```yaml
stages:
  - build
  - upload

dbt-build:
  stage: build
  image: python:3.11-slim
  script:
    - pip install dbt-core dbt-postgres
    - dbt deps
    - dbt build
    - dbt docs generate
  artifacts:
    paths:
      - target/

recce-upload:
  stage: upload
  image: python:3.11-slim
  script:
    - pip install recce-cloud
    - recce-cloud upload
  variables:
    RECCE_API_TOKEN: $RECCE_API_TOKEN
  dependencies:
    - dbt-build
  only:
    - merge_requests
    - main
```

### Generic CI Platform

For other CI platforms, use the generic workflow with session ID:

```yaml
- name: Upload to Recce Cloud
  script:
    - pip install recce-cloud
    - recce-cloud upload --session-id ${SESSION_ID}
  environment:
    RECCE_API_TOKEN: ${RECCE_API_TOKEN}
    SESSION_ID: ${SESSION_ID}
```

## Troubleshooting

### Common Issues

**1. Missing dbt artifacts**

```
Error: Invalid target path: target
Please provide a valid target path containing manifest.json and catalog.json.
```

**Solution:** Ensure `dbt docs generate` has been run successfully before upload.

```bash
dbt build
dbt docs generate  # Required!
recce-cloud upload
```

**2. Authentication failed**

```
Error: No authentication token provided
Set RECCE_API_TOKEN environment variable or ensure CI token is available
```

**Solution:** Set `RECCE_API_TOKEN` in your CI/CD secrets or ensure CI token permissions.

```yaml
# GitHub Actions
env:
  RECCE_API_TOKEN: ${{ secrets.RECCE_API_TOKEN }}

# GitLab CI
variables:
  RECCE_API_TOKEN: $RECCE_API_TOKEN
```

**3. Platform not supported**

```
Error: Platform-specific upload requires GitHub Actions or GitLab CI environment
Detected platform: unknown
```

**Solution:** Use generic workflow with session ID, or run in supported CI platform.

```bash
recce-cloud upload --session-id abc123
```

**4. Session not found**

```
Error: Session ID abc123 does not belong to any organization.
```

**Solution:** Verify session ID is correct and accessible with your API token.

**5. GitLab self-hosted instance**

The CLI automatically detects self-hosted GitLab instances using `CI_SERVER_URL`.

```yaml
# No additional configuration needed
recce-upload:
  script:
    - recce-cloud upload
  variables:
    RECCE_API_TOKEN: $RECCE_API_TOKEN
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Set log level to DEBUG
export RECCE_LOG_LEVEL=DEBUG
recce-cloud upload
```

## Architecture

### Platform-Specific APIs

The CLI uses platform-specific API endpoints for auto-session creation:

**GitHub Actions:**

- `POST /api/v2/github/{repository}/touch-recce-session`
- `POST /api/v2/github/{repository}/upload-completed`

**GitLab CI:**

- `POST /api/v2/gitlab/{project_path}/touch-recce-session`
- `POST /api/v2/gitlab/{project_path}/upload-completed`

### Upload Process

**Platform-Specific Workflow:**

1. Detect CI platform and extract context
2. Validate dbt artifacts
3. Extract adapter type from manifest
4. Authenticate with Recce Cloud API
5. Call `touch-recce-session` (creates or updates session)
6. Upload manifest.json to presigned S3 URL
7. Upload catalog.json to presigned S3 URL
8. Call `upload-completed` (notifies Recce Cloud)

**Generic Workflow:**

1. Detect CI platform (optional)
2. Validate dbt artifacts
3. Extract adapter type from manifest
4. Authenticate with Recce Cloud API
5. Get session info (org_id, project_id)
6. Get presigned upload URLs
7. Upload manifest.json to S3
8. Upload catalog.json to S3
9. Update session metadata

## Development

### Running Tests

```bash
# Install development dependencies
pip install -e .[dev]

# Run tests
pytest tests/recce_cloud/

# Run with coverage
pytest --cov=recce_cloud --cov-report=html tests/recce_cloud/

# Run specific test file
pytest tests/recce_cloud/test_platform_clients.py
```

### Code Quality

```bash
# Format code
make format

# Run quality checks
make check

# Run all checks and tests
make test
```

## Support

- **Documentation:** [docs.reccehq.com](https://docs.reccehq.com)
- **Issues:** [GitHub Issues](https://github.com/DataRecce/recce/issues)
- **Community:** [Recce Slack](https://getdbt.slack.com/archives/C05C28V7CPP)
- **Email:** <support@reccehq.com>

## License

Apache License 2.0 - See [LICENSE](../LICENSE) file for details.
