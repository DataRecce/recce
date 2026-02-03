# Knowledge Base

Quick reference to detailed documentation. Each section has a 1-2 line summary.

---

## Architecture

Monolithic client-server app: FastAPI backend serves static Next.js frontend. Pluggable adapter pattern for dbt/SQLMesh, task-based async check execution, and dual state persistence (local/cloud).

→ `docs/architecture.md`

## Code Patterns

Separation of concerns across models, APIs, tasks, adapters, and state. Import rules prevent circular dependencies and maintain testability.

→ `docs/code-patterns.md`

## Frontend Structure

Monorepo with `@datarecce/ui` shared package. OSS app (`js/app/`) stays thin; shared components, hooks, and API clients live in `js/packages/ui/`.

→ `docs/frontend.md`

## Testing

pytest for Python, Vitest + React Testing Library for frontend, Playwright for visual regression, tox for multi-version testing (dbt 1.6-1.9, Python 3.9-3.13).

→ `docs/testing.md`

## Debugging

Server logs, React DevTools, `recce server --debug` for verbose output, `recce debug` for artifact/connection issues.

→ `docs/debugging.md`

## Cloud Features

Check events timeline (GitHub PR-style comments), approval workflows, and state sync to Recce Cloud. Only available with cloud connection.

→ `docs/cloud-features.md`

---

## Additional References

- `docs/PACKAGING.md` - Python package distribution details
