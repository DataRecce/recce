# AGENTS.md

Instructions for AI coding agents working with this repository.

## Project Overview

Recce is a data validation and review tool for dbt projects. It helps data teams preview, validate, and ship data changes with confidence via lineage visualization, data diffing, and collaborative review.

**Architecture:** Python backend (FastAPI CLI) + React frontend (Next.js static build) embedded in Python package.

---

## Critical Constraints

### Do NOT:
- Commit state files (`recce_state.json`, `state.json`)
- Edit files in `recce/data/` (auto-generated from frontend build)
- Break adapter interface (all adapters must implement ALL `BaseAdapter` methods)
- Skip Python 3.10+ compatibility for dependencies
- Bypass frontend build (run `cd js && pnpm run build` before testing with `recce server`)
- Use interactive git commands (`git rebase -i`, `git add -i`)
- Create worktrees in subdirectories (only at repo root)
- Import from `js/packages/ui/src/*` in OSS app (use `@datarecce/ui` exports)
- Skip pre-commit hooks (never use `--no-verify`)

### Always:
- Build frontend before backend testing: `cd js && pnpm run build`
- Test across dbt versions for adapter changes: `make test-tox`
- Maintain state loader abstraction (FileStateLoader/CloudStateLoader)
- Keep OSS shell thin (`js/app/` = routes only; `@datarecce/ui` = shared code)
- Sign off commits: `git commit -s`

---

## Essential Commands

| Task | Command |
|------|---------|
| **Install Dev** | `make install-dev` |
| **Run Server** | `recce server` |
| **Format Python** | `make format` |
| **Lint Python** | `make flake8` |
| **Test Python** | `make test` |
| **Frontend Dev** | `cd js && pnpm dev` |
| **Frontend Build** | `cd js && pnpm run build` |
| **Frontend Lint** | `cd js && pnpm lint:fix` |
| **Frontend Test** | `cd js && pnpm test` |
| **Type Check** | `cd js && pnpm type:check` |
| **Deps Check (Python)** | `make deps-check-python` |
| **Deps Check (Frontend)** | `make deps-check-frontend` |
| **Deps Check (All)** | `make deps-check` |
| **Coverage (targeted)** | `python -m pytest tests/test_foo.py --cov=recce.module --cov-report=term-missing` |

---

## Repository Layout

| Directory | Purpose |
|-----------|---------|
| `recce/` | Backend (Python): APIs, adapters, models, tasks, state |
| `recce/data/` | GENERATED - embedded frontend (do not edit) |
| `js/` | Frontend monorepo (Next.js + React) |
| `js/app/` | OSS Next.js shell (routes/layouts only) |
| `js/packages/ui/` | `@datarecce/ui` shared components/hooks/api |
| `js/packages/storybook/` | Component stories and visual tests |
| `tests/` | Python unit tests |
| `integration_tests/` | dbt/SQLMesh integration tests |
| `.claude/skills/` | Project-level Claude Code skills |

## Where to Add Code

| Change Type | Location |
|-------------|----------|
| New check type | `recce/tasks/` (extend Task class) |
| API endpoint | `recce/apis/*_api.py` + `*_func.py` |
| Data model | `recce/models/` (Pydantic) |
| Platform adapter | `recce/adapter/` (extend BaseAdapter) |
| State storage | `recce/state/` (extend RecceStateLoader) |
| UI component (shared) | `js/packages/ui/src/components/` |
| UI component (OSS-only) | `js/app/` |
| API client | `js/packages/ui/src/api/` |

---

## Development Workflow

**Before committing:** Run quality checks. Never skip pre-commit hooks.

### Backend (Python)
```bash
make format && make flake8 && make test
```

### Frontend (TypeScript)
```bash
cd js && pnpm lint:fix && pnpm type:check && pnpm test
```

### Full Stack
```bash
make format && make flake8 && make test
cd js && pnpm lint:fix && pnpm type:check && pnpm test && pnpm run build
recce server  # Test integration
```

---

## Commit Conventions

```bash
git commit -s -m "feat(check): add timeline component"
```

**Format:** `<type>(<scope>): <description>` with sign-off (DCO required)

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Branches:** `feature/`, `fix/`, `hotfix/` from `main`

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python 3.10-3.13, FastAPI, Click, Pydantic, dbt adapters, uv (package manager) |
| Frontend | Node.js 20+, Next.js 16, React 19, TypeScript 5.9, MUI 7, Biome 2.4, Tailwind 4 |
| Testing | pytest, Vitest, React Testing Library, Playwright |

---

## pnpm v11 — strictDepBuilds + allowBuilds

The repo runs on pnpm v11.1.1 (since DRC-3439, 2026-05-13). Four non-obvious behaviors to know:

1. **`strictDepBuilds: true` is on by default.** Any transitive package with a `postinstall` script that isn't explicitly listed in `js/pnpm-workspace.yaml#allowBuilds` will cause `pnpm install --frozen-lockfile` to hard-fail in CI with `ERR_PNPM_IGNORED_BUILDS`. When a new dep is added that triggers this, add it to `allowBuilds` as `true` (run its postinstall) or `false` (acknowledge it exists, do NOT run postinstall).

2. **Local repro requires CI parity.** Use `CI=true pnpm install --frozen-lockfile` to match CI exactly. The `--ignore-scripts` flag will MASK this failure — do not use it as a verification path.

3. **pnpm 11 silently appends placeholder lines.** If you run `pnpm install` in a non-TTY context and it hits an ignored build, pnpm appends `<pkg>: set this to true or false` to `pnpm-workspace.yaml#allowBuilds`. Always `git status` after running install — never commit these placeholders.

4. **`packageManager` must be exact semver.** Corepack rejects ranges like `pnpm@11`. Pin the full `pnpm@11.x.y+sha512.<integrity>` via `corepack use pnpm@11.x.y` (note the `.` separator between `sha512` and the hash — not `:`).

Canonical `allowBuilds` examples live in recce-cloud-infra:
- `recce-cloud-infra/recce-cloud/pnpm-workspace.yaml`
- `recce-cloud-infra/recce_instance_launcher/recce_agent/pnpm-workspace.yaml`

Cross-reference those for prior decisions on shared transitive deps (e.g., `protobufjs: false`).

## Common Pitfalls

| Problem | Fix |
|---------|-----|
| Frontend changes not appearing | `cd js && pnpm run build` then restart `recce server` |
| Python import errors | `make install-dev` (uses uv) |
| Biome lint failures | `pnpm lint:fix` |
| Type errors | `pnpm type:check` for details |
| dbt artifact issues | Check `integration_tests/dbt/target` |

---

## Additional Resources

- **[CLAUDE.md](./CLAUDE.md)** - Claude-specific workflows and deep dives
