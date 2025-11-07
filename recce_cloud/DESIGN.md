# Recce Cloud Package Design

## Overview

The `recce-cloud` package is a lightweight CLI tool designed for CI/CD environments to upload dbt artifacts (manifest.json and catalog.json) to Recce Cloud sessions. It replaces the heavy `recce upload-session` command with a minimal-dependency alternative.

## Current Implementation Status

### ✅ Completed (M1 - Basic Upload)
- **CLI Framework**: Click-based CLI with `upload` command
- **API Client**: Lightweight RecceCloudClient with 3 essential methods
- **Artifact Validation**: Verify manifest.json and catalog.json exist
- **Adapter Detection**: Extract adapter type from manifest metadata
- **Upload Workflow**: Complete 10-step upload process to Recce Cloud sessions
- **Authentication**: Support for RECCE_CLOUD_API_TOKEN
- **Test Coverage**: Comprehensive test suite for API client

### ✅ Completed (M2 - CI Auto-Detection)
- **CI Platform Detection**: Automatic detection for GitHub Actions and GitLab CI
- **CR Number Detection**: Extract change request (PR/MR) numbers from CI environment
- **CR URL Construction**: Build PR/MR URLs for session linking (GitHub and self-hosted GitLab support)
- **Access Token Detection**: Auto-detect GITHUB_TOKEN and CI_JOB_TOKEN as fallback authentication
- **Session Type Detection**: Intelligently determine session type (cr, prod, dev)
- **Commit SHA Detection**: Auto-detect commit SHA with git fallback
- **Base Branch Detection**: Extract target branch with configurable default
- **Manual Overrides**: CLI flags to override all auto-detected values
- **Platform-aware Display**: Show "PR" or "MR" based on detected platform
- **Logging**: Transparent logging of detected vs overridden values
- **Test Coverage**: 34 comprehensive tests for CI detection

### 🚧 Future Milestones
- **M3**: PR/MR linking and session metadata enrichment
- **M4**: Download and sync commands

## Design Principles

1. **Minimal Dependencies**: Only 3 packages (click, requests, rich)
2. **Session-Focused**: Uploads artifacts to specific Recce Cloud sessions
3. **CI/CD Optimized**: Fast installation, environment-aware
4. **Lightweight API**: Only essential API methods, no heavy wrappers

## Architecture

### Current Module Structure

```
recce_cloud/
├── __init__.py                    # Package initialization, version management
├── cli.py                         # Main CLI entry point with upload command
├── api/                           # Cloud API client
│   ├── __init__.py
│   └── client.py                 # RecceCloudClient for API calls
├── artifact.py                    # Artifact validation utilities
└── ci_providers/                  # CI/CD provider detection (M2)
    ├── __init__.py
    ├── base.py                   # BaseCIProvider and CIInfo dataclass
    ├── github_actions.py         # GitHubActionsProvider
    ├── gitlab_ci.py              # GitLabCIProvider
    └── detector.py               # CIDetector orchestration

tests/
└── recce_cloud/
    ├── __init__.py
    ├── test_client.py            # API client tests (16 tests)
    └── test_ci_providers.py      # CI provider tests (34 tests)
```

### Future Module Structure (M3+)

```
recce_cloud/
├── __init__.py
├── cli.py
├── api/
│   ├── __init__.py
│   └── client.py
├── artifact.py
├── ci_providers/                  # ✅ M2 - Implemented
│   ├── __init__.py
│   ├── base.py                   # BaseCIProvider and CIInfo
│   ├── github_actions.py         # GitHubActionsProvider
│   ├── gitlab_ci.py              # GitLabCIProvider
│   └── detector.py               # CIDetector orchestration
└── metadata/                      # M3 - Session metadata enrichment
    ├── __init__.py
    ├── pr_link_builder.py        # Build PR/MR URLs for session linking
    └── enricher.py               # Enrich session with CI metadata
```

## Component Design

### 1. CLI (`cli.py`)

**Current Implementation:**

```python
@cloud_cli.command()
@click.option("--target-path", type=click.Path(exists=True), default="target")
@click.option("--session-id", envvar="RECCE_SESSION_ID")
def upload(target_path, session_id):
    """Upload dbt artifacts to Recce Cloud session."""
```

**Upload Workflow (10 Steps):**

1. **Auto-detect CI environment** - Detect platform, CR, commit SHA, branches, access token (M2)
2. **Validate artifacts** - Ensure manifest.json and catalog.json exist in target path
3. **Extract adapter type** - Parse adapter type from manifest.json metadata
4. **Get authentication token** - Priority: RECCE_CLOUD_API_TOKEN → GITHUB_TOKEN/CI_JOB_TOKEN (fallback)
5. **Initialize API client** - Create RecceCloudClient instance
6. **Get session info** - Fetch org_id and project_id for the session
7. **Get presigned URLs** - Request S3 presigned URLs for manifest and catalog
8. **Upload manifest.json** - PUT to S3 using presigned URL
9. **Upload catalog.json** - PUT to S3 using presigned URL
10. **Update session metadata** - PATCH session with adapter type

**Authentication Priority**:
1. `RECCE_CLOUD_API_TOKEN` environment variable (explicit, preferred)
2. CI-detected tokens (automatic fallback):
   - GitHub Actions: `GITHUB_TOKEN`
   - GitLab CI: `CI_JOB_TOKEN`
3. Error if no token available

**Exit Codes:**
- `0` - Success
- `1` - Environment detection error (future)
- `2` - Authentication error (no token, invalid token, permission denied)
- `3` - File validation error (missing or invalid artifacts)
- `4` - Upload error (presigned URL failure, S3 upload failure, metadata update failure)

### 2. API Client (`api/client.py`)

**Current Implementation:**

```python
class RecceCloudClient:
    """Lightweight Recce Cloud API client with minimal dependencies."""

    def __init__(self, token: str, base_url: str = None):
        """
        Initialize client with token.

        Args:
            token: RECCE_CLOUD_API_TOKEN (rct-*) or GITHUB_TOKEN (ghp_*, gho_*, etc.)
            base_url: Override default https://cloud.datarecce.io
        """
        self.token = token
        self.token_type = "github_token" if token.startswith(("ghp_", "gho_", "ghu_", "ghs_", "ghr_")) else "api_token"
        self.base_url_v2 = f"{base_url or RECCE_CLOUD_API_HOST}/api/v2"

    def get_session(self, session_id: str) -> dict:
        """
        GET /api/v2/sessions/{session_id}

        Returns:
            {
                "id": "session-123",
                "org_id": "org-456",
                "project_id": "project-789",
                ...
            }
        """

    def get_upload_urls_by_session_id(
        self, org_id: str, project_id: str, session_id: str
    ) -> dict:
        """
        GET /api/v2/organizations/{org_id}/projects/{project_id}/sessions/{session_id}/upload-url

        Returns:
            {
                "manifest_url": "https://s3.amazonaws.com/...",
                "catalog_url": "https://s3.amazonaws.com/..."
            }
        """

    def update_session(
        self, org_id: str, project_id: str, session_id: str, adapter_type: str
    ) -> dict:
        """
        PATCH /api/v2/organizations/{org_id}/projects/{project_id}/sessions/{session_id}

        Body: {"adapter_type": "postgres"}
        """
```

**Error Handling:**

```python
class RecceCloudException(Exception):
    """Exception raised for Recce Cloud API errors."""

    def __init__(self, message: str, reason: str, status_code: int):
        self.message = message
        self.reason = reason  # Parsed from JSON {"detail": "..."} or plain text
        self.status_code = status_code
```

**Special Handling:**
- **403 Forbidden**: Returns `{"status": "error", "message": "..."}` instead of raising exception
- **Docker Internal URLs**: Replaces `localhost` with `host.docker.internal` when `RECCE_INSTANCE_ENV=docker`

### 3. CI Provider Detection (`ci_providers/`) - M2

**Purpose**: Automatically detect CI platform and extract environment information.

**Architecture**:
```python
@dataclass
class CIInfo:
    """Information extracted from CI environment."""
    platform: Optional[str]        # "github-actions", "gitlab-ci", None
    cr_number: Optional[int]       # Change request number (PR/MR unified)
    cr_url: Optional[str]          # Change request URL (for session linking)
    session_type: Optional[str]    # "cr", "prod", "dev"
    commit_sha: Optional[str]      # Full commit SHA
    base_branch: Optional[str]     # Target/base branch
    source_branch: Optional[str]   # Source/head branch
    repository: Optional[str]      # Repository path
    access_token: Optional[str]    # CI-provided access token (GITHUB_TOKEN, CI_JOB_TOKEN)

class BaseCIProvider(ABC):
    """Abstract base for CI provider implementations."""
    @abstractmethod
    def can_handle(self) -> bool:
        """Check if this provider can handle current environment."""

    @abstractmethod
    def extract_ci_info(self) -> CIInfo:
        """Extract CI information from environment variables."""

class CIDetector:
    """Orchestrates provider detection and info extraction."""

    @classmethod
    def detect(cls) -> CIInfo:
        """Try each provider, fallback to git commands."""

    @classmethod
    def apply_overrides(cls, ci_info, cr, session_type, base_branch) -> CIInfo:
        """Apply manual overrides from CLI flags."""
```

**Supported Platforms**:

**GitHub Actions**:
- Detection: `GITHUB_ACTIONS == 'true'`
- CR Number: Parse `GITHUB_EVENT_PATH` JSON → `pull_request.number`
- CR URL: `https://github.com/{GITHUB_REPOSITORY}/pull/{cr_number}`
- Access Token: `GITHUB_TOKEN` (automatically provided by GitHub Actions)
- Commit SHA: `GITHUB_SHA` → `git rev-parse HEAD`
- Base Branch: `GITHUB_BASE_REF` → default `main`
- Source Branch: `GITHUB_HEAD_REF` → `GITHUB_REF_NAME` → `git branch --show-current`

**GitLab CI**:
- Detection: `GITLAB_CI == 'true'`
- CR Number: `CI_MERGE_REQUEST_IID`
- CR URL: `{CI_SERVER_URL}/{CI_PROJECT_PATH}/-/merge_requests/{cr_number}`
  - Supports self-hosted GitLab instances
  - Defaults to `https://gitlab.com` if `CI_SERVER_URL` not set
- Access Token: `CI_JOB_TOKEN` (automatically provided by GitLab CI)
- Commit SHA: `CI_COMMIT_SHA` → `git rev-parse HEAD`
- Base Branch: `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` → default `main`
- Source Branch: `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` → `CI_COMMIT_REF_NAME` → `git branch --show-current`

**Session Type Logic**:
- If CR number detected → `cr`
- If source branch is `main` or `master` → `prod`
- Otherwise → `dev`

**Manual Overrides** (CLI flags take precedence):
- `--cr <number>` - Override CR number (PR/MR)
- `--type <cr|prod|dev>` - Override session type
- `--base-branch <name>` - Override base branch

**Logging**:
```
INFO: CI Platform: github-actions
INFO: Detected PR number: 123
INFO: Detected commit SHA: abc123de...
INFO: Detected base branch: main
INFO: Detected source branch: feature-branch
INFO: Session type: cr
INFO: Using manual override: --cr 456 (detected: 123)
```

**URL Construction**:
- **GitHub**: `https://github.com/{owner}/{repo}/pull/{cr_number}`
- **GitLab**: `{server_url}/{group}/{project}/-/merge_requests/{cr_number}`
  - Example (gitlab.com): `https://gitlab.com/mygroup/myproject/-/merge_requests/42`
  - Example (self-hosted): `https://gitlab.company.com/team/project/-/merge_requests/15`

**Platform-aware Display**:
- CLI displays "PR Number" for GitHub Actions and "MR Number" for GitLab CI
- Internal representation uses unified `cr_number` and `cr_url` fields
- Session type is always `cr` when change request is detected

### 4. Artifact Utilities (`artifact.py`)

**Current Implementation:**

```python
def verify_artifacts_path(target_path: str) -> bool:
    """
    Verify if the target path contains valid dbt artifacts.

    Args:
        target_path: Path to directory containing artifacts

    Returns:
        True if both manifest.json and catalog.json exist
    """
    required_artifacts_files = ["manifest.json", "catalog.json"]
    return all(f in os.listdir(target_path) for f in required_artifacts_files)

def get_adapter_type(manifest_path: str) -> str:
    """
    Extract adapter type from manifest.json.

    Args:
        manifest_path: Path to manifest.json file

    Returns:
        Adapter type string (e.g., "postgres", "snowflake", "bigquery")

    Raises:
        Exception: If adapter type cannot be found in manifest
    """
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest_data = json.load(f)
        adapter_type = manifest_data.get("metadata", {}).get("adapter_type")
        if adapter_type is None:
            raise Exception("Failed to parse adapter type from manifest.json")
        return adapter_type
```

## Environment Variables

### Core Variables (M1)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `RECCE_SESSION_ID` | Target session ID for upload | Yes* | None |
| `RECCE_CLOUD_API_TOKEN` | Recce Cloud API token | No** | None |
| `RECCE_CLOUD_API_HOST` | Custom API host | No | `https://cloud.datarecce.io` |
| `RECCE_INSTANCE_ENV` | Docker environment flag | No | None |

\* Can also be provided via `--session-id` flag
\** Falls back to CI-provided tokens (GITHUB_TOKEN, CI_JOB_TOKEN)

### CI Detection Variables (M2 - Implemented)

**GitHub Actions** (auto-detected when `GITHUB_ACTIONS=true`):
- `GITHUB_ACTIONS` - Detection flag (must be `true`)
- `GITHUB_EVENT_PATH` - Event JSON path (contains PR number)
- `GITHUB_TOKEN` - Access token (automatically provided, used as auth fallback)
- `GITHUB_SHA` - Commit SHA
- `GITHUB_BASE_REF` - PR target branch
- `GITHUB_HEAD_REF` - PR source branch
- `GITHUB_REF_NAME` - Branch name (fallback)
- `GITHUB_REPOSITORY` - Repository (`owner/repo`)

**GitLab CI** (auto-detected when `GITLAB_CI=true`):
- `GITLAB_CI` - Detection flag (must be `true`)
- `CI_MERGE_REQUEST_IID` - Merge request number
- `CI_JOB_TOKEN` - Access token (automatically provided, used as auth fallback)
- `CI_COMMIT_SHA` - Commit SHA
- `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` - MR target branch
- `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` - MR source branch
- `CI_COMMIT_REF_NAME` - Branch name (fallback)
- `CI_PROJECT_PATH` - Repository (`group/project`)
- `CI_SERVER_URL` - GitLab instance URL (defaults to `https://gitlab.com`)

## Recce Cloud Sessions

### What are Sessions?

Recce Cloud sessions are comparison environments that:
- Store artifacts from **base** (production) and **current** (PR) environments
- Enable team collaboration on dbt changes
- Link to PRs/MRs for automated review workflows
- Provide lineage visualization and impact analysis

### Session Upload Flow

```
Developer/CI
    ↓ (1) dbt build → target/manifest.json, target/catalog.json
    ↓ (2) recce-cloud upload --session-id abc123
    ↓
RecceCloudClient
    ↓ (3) GET /sessions/{session_id} → org_id, project_id
    ↓ (4) GET /sessions/{session_id}/upload-url → presigned S3 URLs
    ↓ (5) PUT manifest.json → S3 (presigned URL)
    ↓ (6) PUT catalog.json → S3 (presigned URL)
    ↓ (7) PATCH /sessions/{session_id} → update adapter_type
    ↓
Recce Cloud
    ↓ (8) Session updated with new artifacts
    ↓ (9) Frontend displays comparison results
```

### Session Metadata (Current)

```json
{
  "id": "session-123",
  "org_id": "org-456",
  "project_id": "project-789",
  "adapter_type": "snowflake",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T01:00:00Z"
}
```

### Session Metadata (Future - M3)

Additional metadata from SCM/CI providers:

```json
{
  "id": "session-123",
  "org_id": "org-456",
  "project_id": "project-789",
  "adapter_type": "snowflake",
  "branch": "feature/new-models",
  "pr_link": "https://github.com/owner/repo/pull/123",
  "commit_hash": "abc123def456",
  "ci_platform": "github-actions",
  "ci_build_url": "https://github.com/owner/repo/actions/runs/789",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T01:00:00Z"
}
```

### PR/MR to Session Mapping (M3)

**Purpose**: Link Recce Cloud sessions to PRs/MRs for automated review workflows

**Database Model:**
```python
class RecceSession:
    pr_link = Column(String(512), nullable=True)  # ← The mapping key
```

**Mapping Process:**
1. Extract PR/MR URL from SCM provider (e.g., GitHub, GitLab)
2. Store URL in `pr_link` field during upload
3. Frontend fetches PRs/MRs and looks up sessions by URL
4. Display session status on PR/MR list

**URL Format Requirements:**

| Provider | URL Format | Example |
|----------|-----------|---------|
| **GitHub** | `https://github.com/{owner}/{repo}/pull/{number}` | `https://github.com/DataRecce/recce/pull/123` |
| **GitLab** | `https://gitlab.com/{group}/{project}/-/merge_requests/{iid}` | `https://gitlab.com/mygroup/myproject/-/merge_requests/45` |
| **Bitbucket** | `https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}` | `https://bitbucket.org/myworkspace/myrepo/pull-requests/78` |

**Critical**: URLs must be **web-accessible** (not API URLs) for frontend navigation.

## Usage Examples

### Basic Usage

```bash
# Set authentication
export RECCE_CLOUD_API_TOKEN=rct-your-token-here

# Upload artifacts to session (auto-detects CI environment)
cd my-dbt-project
dbt build
recce-cloud upload --session-id abc123

# Or use environment variable
export RECCE_SESSION_ID=abc123
recce-cloud upload

# Custom target path
recce-cloud upload --target-path custom-target --session-id abc123

# Manual override examples (M2)
recce-cloud upload --session-id abc123 --pr 456  # Override PR number
recce-cloud upload --session-id abc123 --type prod  # Override session type
recce-cloud upload --session-id abc123 --base-branch develop  # Override base branch
```

### GitHub Actions

```yaml
- name: Upload to Recce Cloud
  env:
    RECCE_CLOUD_API_TOKEN: ${{ secrets.RECCE_CLOUD_API_TOKEN }}
    RECCE_SESSION_ID: ${{ steps.create-session.outputs.session-id }}
  run: |
    pip install recce-cloud
    recce-cloud upload
    # Automatically detects:
    # - PR number from GitHub event
    # - Commit SHA from GITHUB_SHA
    # - Base branch from GITHUB_BASE_REF
    # - Session type: pr
```

### GitLab CI

```yaml
upload-to-recce-cloud:
  script:
    - pip install recce-cloud
    - recce-cloud upload
  variables:
    RECCE_CLOUD_API_TOKEN: $RECCE_CLOUD_API_TOKEN
    RECCE_SESSION_ID: $SESSION_ID
  # Automatically detects:
  # - MR number from CI_MERGE_REQUEST_IID
  # - Commit SHA from CI_COMMIT_SHA
  # - Base branch from CI_MERGE_REQUEST_TARGET_BRANCH_NAME
  # - Session type: mr
```

## Testing Strategy

### Current Tests

**API Client Tests** (`tests/recce_cloud/test_client.py`) - 16 tests:
- Client initialization (API token, GitHub token, None token)
- `get_session()` - Success, 404, 403, API errors
- `get_upload_urls_by_session_id()` - Success, no URLs, failures
- `update_session()` - Success, forbidden, failures
- `RecceCloudException` - JSON detail parsing and plain text
- Docker internal URL replacement

**CI Provider Tests** (`tests/recce_cloud/test_ci_providers.py`) - 31 tests (M2):
- **GitHub Actions Provider** (12 tests):
  - Detection (`can_handle()`)
  - PR number extraction from event JSON
  - PR URL construction
  - Commit SHA extraction with fallback
  - Base/source branch extraction
  - Full CI info extraction (PR and main branch contexts)
- **GitLab CI Provider** (9 tests):
  - Detection (`can_handle()`)
  - MR number extraction
  - MR URL construction (gitlab.com and self-hosted)
  - Commit SHA, base/source branch extraction
  - Full CI info extraction (MR context)
- **CI Detector** (10 tests):
  - Platform detection (GitHub, GitLab, fallback)
  - Manual override application (PR, MR, type, base branch)
  - Override mutual exclusivity (PR/MR)
  - Fallback detection with git commands

**Coverage**: 100% for CI provider methods

### Future Tests (M3+)

**SCM Provider Tests:**
- Provider detection (`can_handle()`)
- Git info extraction from environment variables
- PR/MR info extraction
- Fallback to generic provider

**CI Provider Tests:**
- Provider detection
- CI info extraction
- Build URL construction

**Integration Tests:**
- End-to-end upload workflow
- Mock API calls with `responses` library
- Provider chain fallback logic

## Performance & Dependencies

### Current Dependencies

```python
install_requires=[
    "click>=7.1",      # CLI framework
    "requests>=2.28.1", # HTTP client
    "rich>=12.0.0",    # Console output
]
```

**Installation Time**: <5 seconds
**Package Size**: <100KB (excluding dependencies)

### No Heavy Dependencies

✅ **S3 upload via presigned URLs** (no boto3 - saves ~50MB, 10+ seconds install time)
✅ **Git info from environment or subprocess** (no GitPython - saves ~2MB)
✅ **Simple JSON parsing** (no pydantic - saves ~5MB)
✅ **Direct HTTP with requests** (no SDKs - minimal overhead)

## Future Enhancements

### M2: SCM/CI Provider Auto-Detection

**Goal**: Automatically detect and extract git, PR/MR, and CI/CD information from environment

**Providers to Support:**
- **SCM**: GitHub, GitLab, Bitbucket, Generic (git subprocess)
- **CI**: GitHub Actions, GitLab CI, Bitbucket Pipelines, CircleCI, Generic

**Data Models:**

```python
@dataclass
class GitInfo:
    repository: str              # "owner/repo"
    branch: str                  # "feature/new-models"
    commit_hash: str            # Full SHA
    commit_hash_short: str      # 7-char SHA
    remote_url: str             # Git remote URL
    scm_provider: str           # "github", "gitlab", etc.

@dataclass
class PullRequestInfo:
    id: Optional[int] = None           # PR/MR number
    title: Optional[str] = None        # PR/MR title
    url: Optional[str] = None          # PR/MR URL (for session mapping)
    source_branch: Optional[str] = None
    target_branch: Optional[str] = None

@dataclass
class CIInfo:
    platform: str                      # "github-actions", etc.
    build_id: Optional[str] = None     # Build ID
    job_id: Optional[str] = None       # Job ID
    build_url: Optional[str] = None    # Build URL
    build_number: Optional[int] = None # Build number
```

### M3: Session Metadata Enrichment

**Goal**: Enrich session metadata with git, PR/MR, and CI/CD information

**API Changes:**
- Update `update_session()` to accept additional metadata fields
- Store PR link for session mapping
- Store commit hash, branch, CI build info

### M4: Download and Sync Commands

**Goal**: Support downloading artifacts and syncing state between environments

**Commands:**
- `recce-cloud download --session-id abc123` - Download artifacts from session
- `recce-cloud sync --from-session abc123 --to-session def456` - Sync between sessions

## Extension Guide

### Adding a New SCM Provider (M2+)

1. Create `scm_providers/newscm.py`
2. Implement `BaseSCMProvider` interface:
   - `can_handle()` - Detection logic
   - `extract_git_info()` - Extract GitInfo
   - `extract_pr_info()` - Extract PullRequestInfo
3. Register in `SCMExtractor.SCM_PROVIDERS` list

### Adding a New CI Provider (M2+)

1. Create `ci_providers/newci.py`
2. Implement `BaseCIProvider` interface:
   - `can_handle()` - Detection logic
   - `extract_ci_info()` - Extract CIInfo
3. Register in `CIExtractor.CI_PROVIDERS` list

## Development

### Installation

```bash
# Install in development mode
make install-cloud-dev

# Or directly
python setup_cloud.py develop
```

**Note**: Uses `setup_cloud.py` directly for now. Will be restructured for pip-based installation in the future.

### Running Tests

```bash
# Run all tests
pytest tests/recce_cloud/

# Run with coverage
pytest --cov=recce_cloud --cov-report=html tests/recce_cloud/
```

### Code Quality

```bash
# Format code
make format-cloud

# Lint code
make flake8-cloud

# Check code quality (no modifications)
make check-cloud
```

## Distribution

### Current (Development)

```bash
# Local installation
python setup_cloud.py develop

# Or via Makefile
make install-cloud-dev
```

### Future (PyPI)

```bash
# End users will install from PyPI
pip install recce-cloud

# Usage
recce-cloud upload --session-id abc123
```

**Package Name**: `recce-cloud`
**Entry Point**: `recce-cloud` command → `recce_cloud.cli:cloud_cli`
**Versioning**: Shares version with main `recce` package (from `recce/VERSION`)

## Migration from recce upload-session

### Comparison

| Feature | `recce upload-session` | `recce-cloud upload` |
|---------|----------------------|---------------------|
| **Dependencies** | 20+ packages (boto3, dbt-core, etc.) | 3 packages (click, requests, rich) |
| **Install Time** | ~30-60 seconds | ~5 seconds |
| **Package Size** | ~200MB | <100KB |
| **S3 Upload** | boto3 library | Presigned URLs |
| **Target** | Full recce installation | CI/CD pipelines |
| **Use Case** | Development, manual uploads | Automated CI/CD |

### Migration Guide

**Before (recce):**
```bash
pip install recce
recce upload-session --session-id abc123
```

**After (recce-cloud):**
```bash
pip install recce-cloud
recce-cloud upload --session-id abc123
```

**Benefits:**
- ✅ Faster CI/CD pipeline execution
- ✅ Smaller Docker images
- ✅ Reduced dependency conflicts
- ✅ Simpler environment setup

## License

Apache-2.0 (same as main recce package)
