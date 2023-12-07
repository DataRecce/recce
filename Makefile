dev-requires:
	pip install -e .[dev]

flake8:
	@flake8
	@echo "Passed"

test: dev-requires
	@python3 -m pytest tests
	@tox
