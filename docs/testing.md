# Testing

## Test Suites

| Suite | Framework | Location | Command |
|-------|-----------|----------|---------|
| Python Unit | pytest | `tests/` | `make test` |
| Frontend Unit | Vitest + RTL | `js/src/` | `pnpm test` |
| Component Stories | Storybook | `js/packages/storybook/` | `pnpm storybook` |
| Visual Regression | Playwright | `js/packages/storybook/stories/*.visual.ts` | `pnpm test:visual` |
| Integration | pytest | `integration_tests/` | CI only |
| Multi-Version | tox | - | `make test-tox` |

## Python Testing

```bash
# Run all tests
make test
pytest tests -v

# Run with coverage
make test-coverage

# Test across dbt versions (1.6-1.9)
make test-tox

# Test across Python versions (3.9-3.13)
make test-tox-python-versions
```

### Writing Python Tests

- Place tests in `tests/` mirroring `recce/` structure
- Use pytest fixtures for common setup
- Mock external dependencies (dbt adapters, file I/O)

## Frontend Testing

```bash
cd js

# Run tests
pnpm test

# Run with coverage
pnpm test:cov

# Watch mode
pnpm test --watch
```

### Test Stack

- **Vitest 4** - Test runner (Jest-compatible)
- **React Testing Library** - Component testing
- **happy-dom** - DOM environment
- **fast-check** - Property-based testing (data grid utilities)

### Writing Frontend Tests

- Place tests in `js/src/` alongside test utilities
- Use `@testing-library/react` for component tests
- Mock API calls with MSW or manual mocks
- Test behavior, not implementation

## Storybook Testing

```bash
cd js/packages/storybook

# Run Storybook
pnpm storybook

# Run interaction tests
pnpm test
```

### Visual Regression

```bash
# Update snapshots
pnpm test:visual --update-snapshots

# Run visual tests
pnpm test:visual
```

## CI/CD Workflows

| Workflow | Trigger | Tests |
|----------|---------|-------|
| `tests-python.yaml` | PR/push | Python unit tests (3.9-3.13) |
| `tests-js.yaml` | PR/push | Frontend lint + tests |
| `integration-tests.yaml` | PR/push | Full dbt project tests |
| `nightly.yaml` | Schedule | Full matrix |

## Test Requirements

### Before Commit

```bash
# Backend
make format && make flake8 && make test

# Frontend
cd js && pnpm lint:fix && pnpm type:check && pnpm test
```

### For Adapter Changes

Must test across dbt versions:
```bash
make test-tox
```

### For Integration Changes

Ensure dbt artifacts exist:
```bash
ls integration_tests/dbt/target
```
