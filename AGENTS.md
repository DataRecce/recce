# AGENTS.md

Instructions for AI coding agents working with this repository.

Recce is a data validation and review tool for dbt projects: lineage visualization,
data diffing, collaborative review. Python backend (FastAPI CLI) + React frontend
(Next.js static build) embedded in the Python package.

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

## Non-obvious conventions

Things you would not infer from reading the tree:

- **Frontend:** pnpm only — never npm or npx. There is no root `package.json`;
  run pnpm from `js/`.
- **Python:** Black + isort + flake8 via the Makefile. There is **no Ruff config**
  in this repo, despite Ruff being the norm elsewhere.
- **Integration tests** need dbt artifacts at `integration_tests/dbt/target/manifest.json`
  and `integration_tests/dbt/target-base/manifest.json`. Unit tests do not.
- **`make test` can fail before pytest runs.** It depends on `install-dev`, whose
  `git config --unset-all core.hooksPath` exits 5 when the key is unset. Check for
  `make: *** [install-dev] Error` before believing a green result, or run
  `python -m pytest tests/ -q` directly.
- **A biome version change aborts the commit.** `js/.husky/pre-commit` pins
  `@biomejs/biome` (DRC-3460) and requires a deliberate ack; the hook prints the
  exact steps.
- **`core.hooksPath` decides which hooks run, and the two states are not equal.**
  `cd js && pnpm install` sets it to `js/.husky/_`: husky runs the biome guard,
  `pnpm lint:staged`, **and** chains into the Python `pre-commit` framework
  (`js/.husky/pre-commit`, the templated block at the end) — everything runs.
  `make install-dev` unsets it, so `.git/hooks/pre-commit` wins and the biome
  guard plus frontend lint are silently lost; `.git/hooks/pre-commit` does not
  chain back to husky. Check `git config --get core.hooksPath` before trusting a
  clean commit; if it prints nothing, restore with
  `git config core.hooksPath js/.husky/_`. Never "repair" the husky state by
  running `make install-dev` — that is the strictly weaker configuration.
- **New MCP tools:** `list_tools` is one shared registry serving both local and
  cloud backends, so a tool description obliges both implementations. See the
  `recce-mcp-dev` skill.

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

Targeted Python coverage:
```bash
python -m pytest tests/test_foo.py --cov=recce.module --cov-report=term-missing
```

Other Makefile targets are discoverable with `make help` or by reading the
`Makefile`; frontend scripts with `cd js && pnpm run`.

---

## Commit Conventions

```bash
git commit -s -m "feat(check): add timeline component"
```

**Format:** `<type>(<scope>): <description>` with sign-off (DCO required)

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Branches:** `feature/`, `fix/`, `hotfix/` from `main`

---

## Where things live

`recce/` backend (`tasks/` = check types, `apis/` = endpoints, `models/` =
Pydantic, `adapter/` = platform adapters, `state/` = state loaders).
`recce/data/` is generated — never edit. `js/app/` is the thin OSS shell;
`js/packages/ui/` is `@datarecce/ui`, where shared components, hooks, and API
clients belong.

## Common Pitfalls

| Problem | Fix |
|---------|-----|
| Frontend changes not appearing | `cd js && pnpm run build` then restart `recce server` |
| dbt artifact issues | Check `integration_tests/dbt/target` |

---

## Additional Resources

- **[CLAUDE.md](./CLAUDE.md)** - Claude-specific workflows and deep dives
- **[js/CLAUDE.md](./js/CLAUDE.md)** - Frontend-specific instructions (pnpm, Biome, @datarecce/ui, style conventions)
- **`docs/KNOWLEDGE_BASE.md`** - Architecture, code patterns, testing, debugging
