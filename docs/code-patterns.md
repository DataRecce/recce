# Code Patterns

## Separation of Concerns

```
recce/
├── models/          # Pure data structures (Pydantic), NO business logic
├── apis/            # FastAPI routes, minimal logic (delegate to *_func.py)
│   ├── *_api.py     # Route definitions only
│   └── *_func.py    # Business logic for routes
├── tasks/           # Pure execution logic, NO API awareness
├── adapter/         # Platform abstraction, implements BaseAdapter
├── state/           # Persistence layer, abstracts local vs cloud
└── core.py          # RecceContext - central state coordinator
```

## Dependency Rules

### What Can Import What

| Module | Can Import From |
|--------|-----------------|
| `apis/` | `models/`, `tasks/`, `adapter/`, `state/` |
| `tasks/` | `models/`, `adapter/` (NOT `apis/`) |
| `adapter/` | `models/` (NOT `tasks/` or `apis/`) |
| `state/` | `models/` only |

### Cross-Boundary Rules

- Backend (`recce/`) NEVER imports from frontend (`js/`)
- Frontend uses API clients (`lib/api/`) NEVER direct backend imports
- `js/app/` imports from `@datarecce/ui` (components, contexts, hooks, lib)
- `js/packages/ui/` can import within its own package only
- `js/packages/ui/` NEVER imports from `js/app/` or `js/src/`

## Why This Matters

- **Keeps task execution testable** without spinning up FastAPI server
- **Allows adapter swapping** without breaking existing tasks
- **Enables frontend builds** without Python environment
- **Makes state persistence flexible** (local file vs cloud S3)
- **Prevents circular dependencies** that cause import errors

## Adding New Code

### New Check Type

1. Create task class in `recce/tasks/` extending `Task`
2. Implement `execute()` method with check logic
3. Add run type enum to `recce/models/types.py`
4. Add API handler in `recce/apis/run_func.py`
5. Create frontend UI in `js/packages/ui/src/components/`
6. Add API client in `js/packages/ui/src/api/`
7. Update validation in `recce/config.py` for `recce.yml` support

### New Adapter

1. Create adapter file in `recce/adapter/` extending `BaseAdapter`
2. Implement all abstract methods (get_lineage, get_model, get_node_by_name, etc.)
3. Add CLI flag in `recce/cli.py` to load new adapter
4. Update `RecceContext` initialization for new adapter type
5. Add integration tests in `integration_tests/`

### New API Endpoint

1. Add route in `recce/apis/*_api.py`
2. Implement business logic in `recce/apis/*_func.py`
3. Add Pydantic models in `recce/models/` if needed
4. Add frontend API client method
5. Write tests in `tests/`

## Code Style

### Python

- **Black** (line length 120) + **isort** (profile: black) + **flake8**
- Pre-commit hooks in `.pre-commit-config.yaml`
- Always run `make format` before `make check`

### TypeScript/React

- **Biome 2.3** - Linter and formatter
- Double quotes for strings
- Space indentation
- React 19 JSX transform (no React import needed)
- Key rules: `noExplicitAny`, `useExhaustiveDependencies`, `noUnusedVariables`
- Git hooks: `.husky/pre-commit` runs `pnpm lint:staged` and `pnpm type:check`
