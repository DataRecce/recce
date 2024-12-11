install-dev:
	pip install -e .[dev]

install:
	pip install .

.help:
	@echo "test - run tests"
	@echo "flake8 - run flake8"
	@echo "install - install requirements"
	@echo "install-dev - install dev requirements"
	@echo "dev - run the frontend in dev mode"

flake8:
	@flake8
	@echo "Passed"

test: install-dev
	@python3 -m pytest --cov=recce --cov-report html tests

test-tox: install-dev
	@tox

install-frontend-requires:
# Install pnpm if not installed
	@command -v pnpm || npm install -g pnpm
	@cd js && pnpm install

dev: install-frontend-requires
	@cd js && pnpm dev
