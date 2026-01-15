# Design: `recce-cloud login` and Project Binding

**Date:** 2026-01-14
**Author:** Even Wei
**Status:** Approved
**Linear Project:** [Recce Cloud Universal CLI](https://linear.app/recce/project/recce-cloud-universal-cli-c7b192574b31)

---

## Overview

Add authentication and project binding capabilities to the `recce-cloud` CLI, enabling users to:
1. Authenticate with Recce Cloud via browser OAuth
2. Bind a local directory to a Recce Cloud organization/project
3. Run commands without specifying `--org`/`--project` repeatedly

## Goals

- **User-friendly onboarding**: Single `login` + `init` flow to get started
- **Standalone CLI**: Duplicate auth logic from Recce OSS for future repo split
- **Shared credentials**: Use same `~/.recce/profile.yml` as Recce OSS
- **Flexible configuration**: Support CLI flags, env vars, and local config with clear priority

---

## Design

### 1. Authentication (`recce-cloud login`)

#### Command Interface

```bash
# Primary: Browser OAuth
recce-cloud login

# Fallback: Manual token entry (for headless/SSH)
recce-cloud login --token

# Check current auth status
recce-cloud login --status

# Remove stored credentials
recce-cloud logout
```

#### Browser OAuth Flow

```
User runs: recce-cloud login
    │
    ├─► CLI generates RSA-2048 key pair
    │
    ├─► Opens browser to:
    │   https://cloud.datarecce.io/connect?_key={base64_public_key}&_port={random_port}
    │
    ├─► Starts one-time callback server on localhost:{10000-15000}
    │
    ├─► User authenticates in browser (GitHub/GitLab OAuth)
    │
    ├─► Recce Cloud sends encrypted token via callback:
    │   http://localhost:{port}/?code={RSA_encrypted_token}
    │
    ├─► CLI decrypts token using private key (RSA-OAEP-SHA1)
    │
    ├─► Verifies token: GET /api/v1/verify-token
    │
    └─► Saves to ~/.recce/profile.yml
```

#### Credential Storage

Shared with Recce OSS for unified experience:

```yaml
# ~/.recce/profile.yml
user_id: "abc123-uuid"
api_token: "rct-xxxxxxxxxxxx"
anonymous_tracking: true
```

#### Behavior Matrix

| Scenario | Behavior |
|----------|----------|
| No existing token | Opens browser, runs OAuth flow |
| Valid token exists | Shows "Already logged in as X" with option to re-auth |
| Invalid/expired token | Clears old token, runs new OAuth flow |
| `--token` flag | Prompts for manual token entry |
| `--status` flag | Shows current auth state without modifying |

#### CLI Output

```
$ recce-cloud login
Opening browser to authenticate...
✓ Logged in as user@example.com
  Credentials saved to ~/.recce/profile.yml

$ recce-cloud login --status
✓ Logged in as user@example.com
  Token: rct-xxxx...xxxx (valid)
```

---

### 2. Project Binding (`recce-cloud init`)

#### Command Interface

```bash
# Interactive: Select org → project from list
recce-cloud init

# Explicit: Direct binding (for scripts/CI)
recce-cloud init --org myorg --project my-dbt-project

# Show current binding
recce-cloud init --status

# Remove binding
recce-cloud init --clear
```

#### Interactive Flow

```
$ recce-cloud init

? Select organization:
  › infuseai (3 projects)
    acme-corp (7 projects)
    personal (1 project)

? Select project:
  › jaffle-shop
    ecommerce-analytics
    marketing-data

✓ Bound current directory to infuseai/jaffle-shop
  Config saved to .recce/config

? Add .recce/ to .gitignore? (Y/n)
```

#### Local Config Storage

```yaml
# ./.recce/config (in project directory)
version: 1
cloud:
  org: infuseai
  project: jaffle-shop
  bound_at: 2026-01-14T10:30:00Z
  bound_by: user@example.com
```

---

### 3. Configuration Resolution

#### Priority Order (Highest to Lowest)

```
1. CLI flags         --org myorg --project myproject
         ↓
2. Environment vars  RECCE_ORG, RECCE_PROJECT
         ↓
3. Local config      ./.recce/config (from recce-cloud init)
         ↓
4. Error             "No project configured. Run: recce-cloud init"
```

#### Impact on Existing Commands

Commands (`upload`, `download`, `delete`) will auto-resolve org/project:

```bash
# Before (verbose, requires UUIDs)
recce-cloud upload --session-id abc123-def456-...

# After (simple, uses binding + session name)
cd my-dbt-project/
recce-cloud init --org infuseai --project jaffle-shop

recce-cloud upload --session-name "pr-123"
recce-cloud upload --type prod
recce-cloud download --session-name "pr-123"
```

#### Error Messages

```bash
# No auth
$ recce-cloud upload
Error: Not logged in. Run: recce-cloud login

# No project binding
$ recce-cloud upload
Error: No project configured. Run: recce-cloud init
```

---

## Implementation

### New Files

```
recce_cloud/
├── auth/
│   ├── __init__.py
│   ├── login.py           # Browser OAuth flow (RSA encryption)
│   ├── profile.py         # ~/.recce/profile.yml read/write
│   └── callback_server.py # One-time HTTP server for OAuth callback
├── config/
│   ├── __init__.py
│   ├── project_config.py  # .recce/config read/write
│   └── resolver.py        # Priority-based config resolution
└── cli.py                 # Add: login, logout, init commands
```

### New Commands

| Command | Description |
|---------|-------------|
| `recce-cloud login` | Browser OAuth authentication |
| `recce-cloud login --token` | Manual token entry |
| `recce-cloud login --status` | Show auth status |
| `recce-cloud logout` | Clear credentials |
| `recce-cloud init` | Interactive project binding |
| `recce-cloud init --org X --project Y` | Explicit binding |
| `recce-cloud init --status` | Show current binding |
| `recce-cloud init --clear` | Remove binding |

### Dependencies

```toml
# pyproject.toml
dependencies = [
    "cryptography>=3.4",  # For RSA encryption
    # existing deps...
]
```

### Backend Requirements

All required APIs already exist:

| Endpoint | Purpose |
|----------|---------|
| `/connect` | OAuth callback page |
| `/api/v1/verify-token` | Token validation |
| `/api/v2/organizations` | List organizations |
| `/api/v2/organizations/{org}/projects` | List projects |

**No backend changes required.**

---

## Testing

### Unit Tests

- `test_login.py`: OAuth flow, token storage, status checks
- `test_init.py`: Project binding, config read/write
- `test_resolver.py`: Priority-based resolution logic

### Integration Tests

- Full login flow with mock callback server
- Project binding with mock API responses
- Command execution with various config combinations

---

## Rollout

1. Implement `login`/`logout` commands
2. Implement `init` command
3. Add config resolver to existing commands
4. Update documentation
5. Release as part of `recce-cloud` CLI update
