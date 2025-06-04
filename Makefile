.PHONY: help format lint check test clean install dev-install

# Default target executed when no arguments are given to make.
default: help

install-dev:
	pip install -e .[dev]
	pre-commit install

install:
	pip install .

help:
	@echo "Available commands:"
	@echo "  make help         - Show this help message"
	@echo "  make format       - Format code with Black and isort"
	@echo "  make flake8       - Run flake8 linting"
	@echo "  make mypy         - Run type checking with mypy"
	@echo "  make check        - Run all code quality checks without modifying files"
	@echo "  make install      - Install requirements"
	@echo "  make install-dev  - Install dev requirements"
	@echo "  make dev          - Run the frontend in dev mode"

format:
	@echo "Formatting with Black..."
	black ./recce ./tests
	@echo "Sorting imports with isort..."
	isort ./recce ./tests

flake8:
	@echo "Linting with flake8..."
	flake8 ./recce ./tests

# Run all code quality checks without modifying files
check:
	@echo "Checking code formatting with Black..."
	black --check ./recce ./tests
	@echo "Checking import order with isort..."
	isort --check ./recce ./tests
	@echo "Checking code style with flake8..."
	flake8 ./recce ./tests

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
