.PHONY: help format lint check ruff mypy mypy-report test clean install dev-install install-cloud install-cloud-dev build build-cloud build-all clean-build

# Default target executed when no arguments are given to make.
default: help

install-dev:
	pip install -e .[dev,mcp]
	pre-commit install

install:
	pip install .

install-cloud:
	# Using setup_cloud.py directly for now until we restructure the monorepo
	# Users will install from PyPI with: pip install recce-cloud
	python setup_cloud.py install

install-cloud-dev:
	# Using setup_cloud.py directly for now until we restructure the monorepo
	python setup_cloud.py develop

help:
	@echo "Available commands:"
	@echo ""
	@echo "Code Quality:"
	@echo "  make format            - Format code with Black and Ruff"
	@echo "  make format-cloud      - Format recce-cloud code"
	@echo "  make check             - Run all code quality checks"
	@echo "  make check-cloud       - Run code quality checks on recce-cloud"
	@echo "  make ruff              - Run Ruff linter"
	@echo "  make ruff-fix          - Run Ruff with auto-fix"
	@echo "  make ruff-cloud        - Run Ruff on recce-cloud"
	@echo "  make mypy              - Run type checking with mypy"
	@echo "  make mypy-cloud        - Run type checking on recce-cloud"
	@echo "  make mypy-report       - Generate HTML type coverage report"
	@echo ""
	@echo "Installation:"
	@echo "  make install           - Install recce package"
	@echo "  make install-dev       - Install recce with dev dependencies"
	@echo "  make install-cloud     - Install recce-cloud package"
	@echo "  make install-cloud-dev - Install recce-cloud in dev mode"
	@echo ""
	@echo "Testing:"
	@echo "  make test              - Run tests"
	@echo "  make test-coverage     - Run tests with coverage report"
	@echo "  make test-tox          - Run multi-version tests"
	@echo ""
	@echo "Build:"
	@echo "  make build             - Build recce package"
	@echo "  make build-cloud       - Build recce-cloud package"
	@echo "  make clean-build       - Clean build artifacts"

format:
	@echo "Formatting with Black..."
	black ./recce ./tests
	@echo "Sorting imports with isort..."
	isort ./recce ./tests

format-cloud:
	@echo "Formatting recce-cloud with Black..."
	black ./recce_cloud
	@echo "Sorting imports with isort..."
	isort ./recce_cloud

ruff:
	@echo "Linting with Ruff..."
	ruff check ./recce ./tests

ruff-fix:
	@echo "Linting and fixing with Ruff..."
	ruff check --fix ./recce ./tests

ruff-cloud:
	@echo "Linting recce-cloud with Ruff..."
	ruff check ./recce_cloud

ruff-fix-cloud:
	@echo "Linting and fixing recce-cloud with Ruff..."
	ruff check --fix ./recce_cloud

mypy:
	@echo "Type checking with mypy..."
	mypy recce

mypy-cloud:
	@echo "Type checking recce-cloud with mypy..."
	mypy recce_cloud

mypy-report:
	@echo "Generating mypy HTML report..."
	mypy recce --html-report ./mypy-report
	@echo "Report generated at: ./mypy-report/index.html"

# Run all code quality checks without modifying files
check:
	@echo "Running all code quality checks..."
	@echo ""
	@echo "1. Checking code formatting with Black..."
	@black --check ./recce ./tests
	@echo "✓ Black check passed"
	@echo ""
	@echo "2. Checking import order with isort..."
	@isort --check ./recce ./tests
	@echo "✓ isort check passed"
	@echo ""
	@echo "3. Checking code style with flake8..."
	@flake8 ./recce ./tests
	@echo "✓ flake8 check passed"
	@echo ""
	@echo "4. Type checking with mypy..."
	@mypy recce
	@echo "✓ mypy check passed"
	@echo ""
	@echo "✓ All checks passed!"

check-cloud:
	@echo "Running recce-cloud code quality checks..."
	@echo ""
	@echo "1. Checking code formatting with Black..."
	@black --check ./recce_cloud
	@echo "✓ Black check passed"
	@echo ""
	@echo "2. Checking import order with isort..."
	@isort --check ./recce_cloud
	@echo "✓ isort check passed"
	@echo ""
	@echo "3. Checking code style with flake8..."
	@flake8 ./recce_cloud
	@echo "✓ flake8 check passed"
	@echo ""
	@echo "4. Type checking with mypy..."
	@mypy recce_cloud
	@echo "✓ mypy check passed"
	@echo ""
	@echo "✓ All checks passed!"
test: install-dev
	@echo "Running tests..."
	@python3 -m pytest tests

test-coverage: install-dev
	@echo "Running tests with coverage..."
	@python3 -m pytest --cov=recce --cov-report=html --cov-report=term tests
	@echo "Coverage report generated in htmlcov/index.html"

test-tox: install-dev
	@echo "Running tests with Tox based on DBT versions..."
	@tox run-parallel

test-tox-python-versions:
	@echo "Running tests with Tox for specific Python versions..."
	@tox run-parallel -e 3.9,3.10,3.11,3.12,3.13

install-frontend-requires:
# Install pnpm if not installed
	@command -v pnpm || npm install -g pnpm
	@cd js && pnpm install

dev: install-frontend-requires
	@cd js && pnpm dev

# Build targets
clean-build:
	@echo "Cleaning build artifacts..."
	@rm -rf build/ dist/ *.egg-info recce_cloud.egg-info
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name '*.pyc' -delete

build-frontend:
	@echo "Building frontend static files..."
	@cd js && pnpm install --frozen-lockfile && pnpm build

build: clean-build build-frontend
	@echo "Building recce package..."
	@pip install -q wheel
	@python setup.py sdist bdist_wheel

build-cloud: clean-build
	@echo "Syncing VERSION file to recce_cloud..."
	@cp recce/VERSION recce_cloud/VERSION
	@echo "Building recce-cloud package..."
	@pip install -q wheel
	@python setup_cloud.py sdist bdist_wheel

build-all: clean-build build-frontend
	@echo "Building both packages..."
	@pip install -q wheel
	@cp recce/VERSION recce_cloud/VERSION
	@python setup.py sdist bdist_wheel
	@python setup_cloud.py sdist bdist_wheel
	@echo "Build complete!"
	@echo "Packages in dist/:"
	@ls -lh dist/
