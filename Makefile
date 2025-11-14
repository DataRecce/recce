.PHONY: help format lint check test clean install dev-install install-cloud install-cloud-dev build build-cloud build-all clean-build

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
	@echo "  make help              - Show this help message"
	@echo "  make format            - Format code with Black and isort"
	@echo "  make format-cloud      - Format recce-cloud code"
	@echo "  make flake8            - Run flake8 linting"
	@echo "  make flake8-cloud      - Run flake8 on recce-cloud"
	@echo "  make mypy              - Run type checking with mypy"
	@echo "  make check             - Run all code quality checks without modifying files"
	@echo "  make check-cloud       - Run code quality checks on recce-cloud"
	@echo "  make install           - Install recce package"
	@echo "  make install-dev       - Install recce with dev requirements"
	@echo "  make install-cloud     - Install recce-cloud package"
	@echo "  make install-cloud-dev - Install recce-cloud in dev mode"
	@echo "  make dev               - Run the frontend in dev mode"
	@echo "  make build             - Build recce package"
	@echo "  make build-cloud       - Build recce-cloud package"
	@echo "  make build-all         - Build both packages"
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

flake8:
	@echo "Linting with flake8..."
	flake8 ./recce ./tests

flake8-cloud:
	@echo "Linting recce-cloud with flake8..."
	flake8 ./recce_cloud

# Run all code quality checks without modifying files
check:
	@echo "Checking code formatting with Black..."
	black --check ./recce ./tests
	@echo "Checking import order with isort..."
	isort --check ./recce ./tests
	@echo "Checking code style with flake8..."
	flake8 ./recce ./tests

check-cloud:
	@echo "Checking recce-cloud code formatting with Black..."
	black --check ./recce_cloud
	@echo "Checking recce-cloud import order with isort..."
	isort --check ./recce_cloud
	@echo "Checking recce-cloud code style with flake8..."
	flake8 ./recce_cloud

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
