# Recce Cloud CLI

Lightweight command-line tool for managing dbt artifacts with Recce Cloud in CI/CD environments.

## Overview

The Recce Cloud CLI (`recce-cloud`) is a standalone tool designed for CI/CD pipelines that need to upload and download dbt artifacts (manifest.json and catalog.json) to/from Recce Cloud without the full `recce` package dependencies.

**Key Features:**

- 🚀 Lightweight - minimal dependencies for fast CI/CD execution
- 🤖 Auto-detection - automatically detects CI platform, repository, and PR/MR context
- ⬆️ Upload - push dbt artifacts to Recce Cloud sessions
- ⬇️ Download - pull dbt artifacts from Recce Cloud sessions
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

**Upload artifacts:**

```yaml
- name: Upload to Recce Cloud
  run: recce-cloud upload
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Download artifacts:**

```yaml
- name: Download from Recce Cloud
  run: recce-cloud download --prod --target-path target-base
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GitLab CI

**Upload artifacts:**

```yaml
recce-upload:
  script:
    - recce-cloud upload
```

**Download artifacts:**

```yaml
recce-download:
  script:
    - recce-cloud download --prod --target-path target-base
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

## Download Workflows

The `recce-cloud download` command supports two workflows:

### 1. Platform-Specific Workflow (Recommended)

**For GitHub Actions and GitLab CI**

Automatically finds and downloads artifacts from Recce Cloud sessions using platform-specific APIs. No session ID required.

**Features:**

- ✅ Auto-detects PR/MR context
- ✅ Supports downloading production/base session with `--prod` flag
- ✅ Works with CI-provided tokens (GITHUB_TOKEN, CI_JOB_TOKEN)

**Usage:**

```bash
# GitHub Actions - Download current PR session
recce-cloud download

# GitLab CI - Download current MR session
recce-cloud download

# Download production/base session
recce-cloud download --prod

# Download to custom target path
recce-cloud download --target-path target-base

# Force overwrite existing files
recce-cloud download --force
```

**Requirements:**

- Running in GitHub Actions or GitLab CI environment
- CI-provided token (GITHUB_TOKEN/CI_JOB_TOKEN)
- Session must exist in Recce Cloud

### 2. Generic Workflow

**For other CI platforms or specific sessions**

Downloads from a specific Recce Cloud session using session ID.

**Usage:**

```bash
# With session ID parameter
recce-cloud download --session-id abc123

# With environment variable
export RECCE_SESSION_ID=abc123
recce-cloud download

# With custom target path
recce-cloud download --session-id abc123 --target-path my-target

# Force overwrite
recce-cloud download --session-id abc123 --force
```

**Requirements:**

- Session ID (from Recce Cloud web app or API)
- RECCE_API_TOKEN
- Session must exist in Recce Cloud

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
| `GITHUB_TOKEN`     | Explicit set  | GitHub authentication (Actions) |
| `CI_JOB_TOKEN`     | Auto-detected | GitLab authentication (CI)      |

**Exit Codes:**

| Code | Description                                         |
| ---- | --------------------------------------------------- |
| 0    | Success                                             |
| 1    | Platform not supported (platform-specific workflow) |
| 2    | Authentication error                                |
| 3    | File validation error                               |
| 4    | Upload error                                        |

### `recce-cloud download`

Download dbt artifacts (manifest.json, catalog.json) from Recce Cloud session.

**Options:**

| Option          | Type   | Default  | Description                                          |
| --------------- | ------ | -------- | ---------------------------------------------------- |
| `--target-path` | path   | `target` | Path to directory where artifacts will be downloaded |
| `--session-id`  | string | -        | Session ID for generic workflow (optional)           |
| `--prod`        | flag   | false    | Download production/base session                     |
| `--dry-run`     | flag   | false    | Show what would be downloaded without downloading    |
| `--force`, `-f` | flag   | false    | Overwrite existing files without prompting           |

**Environment Variables:**

| Variable           | Required      | Description                     |
| ------------------ | ------------- | ------------------------------- |
| `RECCE_API_TOKEN`  | Recommended   | Recce Cloud API token           |
| `RECCE_SESSION_ID` | Optional      | Session ID for generic workflow |
| `GITHUB_TOKEN`     | Explicit set  | GitHub authentication (Actions) |
| `CI_JOB_TOKEN`     | Auto-detected | GitLab authentication (CI)      |

**Exit Codes:**

| Code | Description                                         |
| ---- | --------------------------------------------------- |
| 0    | Success                                             |
| 1    | Platform not supported (platform-specific workflow) |
| 2    | Authentication error                                |
| 3    | File validation error                               |
| 4    | Download error                                      |

**Common Examples:**

```bash
# Auto-find and download current PR/MR session
recce-cloud download

# Download project's production/base session
recce-cloud download --prod

# Download from specific session ID
recce-cloud download --session-id abc123

# Download prod session to target-base
recce-cloud download --prod --target-path target-base

# Force overwrite existing files
recce-cloud download --force

# Dry run - preview what would be downloaded
recce-cloud download --dry-run
```

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

- Available as `${{ secrets.GITHUB_TOKEN }}` in Actions
- Must be explicitly set in `env:` section of your workflow

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

### GitHub Actions - Upload Workflow

```yaml
name: Recce CI - Upload

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
```

### GitHub Actions - Download Workflow

```yaml
name: Recce CI - Download

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

      # Download production/base artifacts
      - name: Download base artifacts from Recce Cloud
        run: recce-cloud download --prod --target-path target-base
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Build current PR version
      - name: Build dbt project (current)
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

### GitLab CI - Upload Workflow

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
  dependencies:
    - dbt-build
  only:
    - merge_requests
    - main
```

### GitLab CI - Download Workflow

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
    - pip install dbt-core dbt-postgres
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

For other CI platforms, use the generic workflow with session ID:

```yaml
# Upload
- name: Upload to Recce Cloud
  script:
    - pip install recce-cloud
    - recce-cloud upload --session-id ${SESSION_ID}
  environment:
    RECCE_API_TOKEN: ${RECCE_API_TOKEN}
    SESSION_ID: ${SESSION_ID}

# Download
- name: Download from Recce Cloud
  script:
    - pip install recce-cloud
    - recce-cloud download --session-id ${SESSION_ID}
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

**Solution:** Token requirements depend on your workflow type:

**For Generic Workflow (with `--session-id`):**
- Always requires explicit `RECCE_API_TOKEN`

```bash
# Set token and use session ID
export RECCE_API_TOKEN=your_token_here
recce-cloud upload --session-id abc123
recce-cloud download --session-id abc123
```

**For Platform-Specific Workflow:**

_GitHub CI_
- Use `GITHUB_TOKEN` (explicitly set)

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
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
```

**6. Target path already exists (download)**

```
Error: Target path already exists: target
Use --force to overwrite existing directory
```

**Solution:** Use `--force` flag to overwrite existing files, or choose a different target path.

```bash
recce-cloud download --force
# OR
recce-cloud download --target-path target-new
```

**7. No production session available**

```
Error: No production session found for this project
```

**Solution:** Upload a production session first, or use a specific session ID.

```bash
# Upload production session (on main branch)
recce-cloud upload --type prod

# Or download from specific session
recce-cloud download --session-id abc123
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

### Download Process

**Platform-Specific Workflow:**

1. Detect CI platform and extract context
2. Authenticate with Recce Cloud API
3. Call download API with PR/MR context
4. Get presigned download URLs and session ID
5. Create target directory (if needed)
6. Download manifest.json from S3
7. Download catalog.json from S3

**Generic Workflow (Session ID):**

1. Authenticate with Recce Cloud API
2. Get session info (org_id, project_id)
3. Get presigned download URLs by session ID
4. Create target directory (if needed)
5. Download manifest.json from S3
6. Download catalog.json from S3

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
