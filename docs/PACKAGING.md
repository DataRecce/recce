# Recce Packaging Guide

This document explains how `recce` and `recce-cloud` packages are structured, built, and published.

## Overview

The Recce repository contains two separate Python packages:

1. **`recce`** - Full-featured CLI for local development and review
2. **`recce-cloud`** - Lightweight CLI for CI/CD environments

Both packages share the same version number from `recce/VERSION`.

## Package Structure

```
recce/
├── recce/                    # Main package (full-featured)
│   ├── VERSION              # Single source of truth for both packages
│   └── ...
├── recce_cloud/             # Lightweight cloud package
│   ├── VERSION              # Synced from recce/VERSION during build
│   ├── __init__.py          # Reads VERSION with fallback
│   └── ...
├── setup.py                 # Build config for 'recce' package
├── setup_cloud.py           # Build config for 'recce-cloud' package
├── pyproject.toml           # Modern Python build system config
└── Makefile                 # Build automation
```

## Version Management

### Single Source of Truth

All version information comes from `recce/VERSION`:

```
1.24.0
```

### How Versioning Works

1. **Build time**: `setup.py` and `setup_cloud.py` read `recce/VERSION`
2. **Build process**: `make build-cloud` copies `recce/VERSION` to `recce_cloud/VERSION`
3. **Runtime**: `recce_cloud/__init__.py` reads VERSION with fallback logic:
   - First tries `recce_cloud/VERSION` (for installed package)
   - Falls back to `../recce/VERSION` (for development)

### Updating Version

To release a new version:

```bash
# 1. Update the version file
echo "1.25.0" > recce/VERSION

# 2. Commit the change
git add recce/VERSION
git commit -m "chore: bump version to 1.25.0"

# 3. Tag the release
git tag v1.25.0
git push && git push --tags
```

## Development Workflow

### Installing for Development

**Install recce (full package):**
```bash
make install-dev
# OR
pip install -e .[dev]
```

**Install recce-cloud (lightweight package):**
```bash
make install-cloud-dev
# OR
cd /path/to/recce
python setup_cloud.py develop
```

**Install both packages:**
```bash
make install-dev
make install-cloud-dev
```

### Running Tests

```bash
# Test recce
make test

# Test recce-cloud
pytest tests/recce_cloud/

# Test with coverage
make test-coverage
```

### Code Quality

```bash
# Format code (both packages)
make format
make format-cloud

# Check code quality (both packages)
make check
make check-cloud

# Lint (both packages)
make flake8
make flake8-cloud
```

## Build Process

### Building Packages

**Build recce only:**
```bash
make build
```
This will:
1. Clean build artifacts
2. Build frontend (pnpm install + pnpm build)
3. Build Python package (python setup.py sdist bdist_wheel)

**Build recce-cloud only:**
```bash
make build-cloud
```
This will:
1. Clean build artifacts
2. Sync VERSION file to recce_cloud/
3. Build Python package (python setup_cloud.py sdist bdist_wheel)

**Build both packages:**
```bash
make build-all
```
This will:
1. Clean build artifacts
2. Build frontend
3. Build both recce and recce-cloud packages

**Build frontend only:**
```bash
make build-frontend
```

**Clean build artifacts:**
```bash
make clean-build
```

This creates packages in `dist/`:
- `recce-1.24.0.tar.gz` (source distribution)
- `recce-1.24.0-py3-none-any.whl` (wheel)
- `recce-cloud-1.24.0.tar.gz` (source distribution)
- `recce_cloud-1.24.0-py3-none-any.whl` (wheel)

## Publishing to PyPI

### Prerequisites

1. Install publishing tools:
   ```bash
   pip install twine
   ```

2. Configure PyPI credentials:
   ```bash
   # Create ~/.pypirc with:
   [pypi]
   username = __token__
   password = pypi-<your-token>
   ```

### Publishing Workflow

**1. Build both packages:**
```bash
make build-all
```

**2. Check packages:**
```bash
twine check dist/*
```

**3. Upload to TestPyPI (optional):**
```bash
twine upload --repository testpypi dist/*
```

**4. Upload to PyPI:**
```bash
# Upload recce-cloud first
twine upload dist/recce-cloud-*

# Then upload recce
twine upload dist/recce-*
```

**Note:** Always publish `recce-cloud` before `recce` to ensure the dependency is available.

### Future: Add recce → recce-cloud Dependency

When ready, update `setup.py`:

```python
install_requires=[
    "recce-cloud",  # Add this line
    "boto3",
    # ... other deps
]
```

This makes `pip install recce` automatically install `recce-cloud`.

## Installation Scenarios

### Scenario 1: Lightweight (CI/CD)

```bash
pip install recce-cloud
```

**Result:**
- Only `recce-cloud` installed
- 3 dependencies (click, requests, rich)
- ~5MB installed size
- Only `recce-cloud` command available

### Scenario 2: Full (Development)

```bash
pip install recce
```

**Result:**
- Only `recce` installed (currently)
- 20+ dependencies
- ~50MB+ installed size
- Only `recce` command available

**Future (when dependency added):**
- Both `recce` and `recce-cloud` installed
- `recce-cloud` downloaded automatically from PyPI
- Both commands available

## Troubleshooting

### VERSION file not found

**Error:**
```
FileNotFoundError: [Errno 2] No such file or directory: 'VERSION'
```

**Solution:**
Ensure you're running build commands from the repository root, or use Makefile targets.

### recce-cloud command not found after install

**Cause:** Package not installed correctly or not in PATH

**Solution:**
```bash
# Verify installation
pip show recce-cloud

# Check entry point
pip show -f recce-cloud | grep recce-cloud

# Reinstall
pip uninstall recce-cloud
pip install recce-cloud
```

### Development install doesn't work

**Issue:** `python setup_cloud.py develop` fails with path errors

**Solution:**
Run from repository root:
```bash
cd /path/to/recce
python setup_cloud.py develop
```

Or use Makefile:
```bash
make install-cloud-dev
```

## Reference

### Makefile Targets

| Command | Description |
|---------|-------------|
| `make install` | Install recce package |
| `make install-dev` | Install recce with dev dependencies |
| `make install-cloud` | Install recce-cloud package |
| `make install-cloud-dev` | Install recce-cloud in development mode |
| `make build` | Build recce package |
| `make build-cloud` | Build recce-cloud package |
| `make build-all` | Build both packages |
| `make clean-build` | Clean build artifacts |
| `make test` | Run tests |
| `make format` | Format code (recce) |
| `make format-cloud` | Format code (recce-cloud) |
| `make check` | Check code quality (recce) |
| `make check-cloud` | Check code quality (recce-cloud) |

### Package Dependencies

**recce-cloud:**
- `click>=7.1`
- `requests>=2.28.1`
- `rich>=12.0.0`

**recce:**
- All recce-cloud dependencies (when dependency added)
- Plus: boto3, fastapi, uvicorn, pydantic, dbt, etc.

## Best Practices

1. **Always build both packages together** using `make build-all`
2. **Test installation** in a clean virtual environment before publishing
3. **Publish recce-cloud first** to ensure dependency is available
4. **Use Makefile targets** for consistent builds
5. **Keep VERSION in sync** by only editing `recce/VERSION`
6. **Run tests** before publishing: `make test && pytest tests/recce_cloud/`
