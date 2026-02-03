# Frontend Structure

## Monorepo Layout

```
js/
├── app/                   # OSS Next.js shell (routes/layouts only)
├── src/                   # OSS tests + test utilities (Vitest)
│   ├── components/        # Test suites for UI behavior
│   ├── lib/               # Test helpers for data grid + adapters
│   └── testing-utils/     # Shared test harnesses and fixtures
├── packages/
│   ├── ui/                # @datarecce/ui package source
│   │   ├── src/
│   │   │   ├── api/        # Shared API clients
│   │   │   ├── components/ # Shared UI + OSS variants (*Oss)
│   │   │   ├── contexts/   # Shared React contexts
│   │   │   ├── hooks/      # Shared hooks
│   │   │   ├── lib/        # Shared lib utilities
│   │   │   └── styles/     # Shared styles
│   │   └── dist/          # Built package outputs
│   └── storybook/         # Component stories and visual tests
│       ├── stories/        # Component stories
│       ├── .storybook/     # Storybook configuration
│       └── tests/          # Visual regression tests (Playwright)
├── biome.json             # Biome linter & formatter config
├── vitest.config.mts      # Vitest test configuration
└── package.json
```

## Package Separation

### @datarecce/ui (js/packages/ui/)

Source of truth for shared UI:
- Components, contexts, hooks, API clients
- OSS-specific variants suffixed `*Oss`
- Exported via public paths (`@datarecce/ui`, `@datarecce/ui/components/...`)

### OSS App (js/app/)

Thin shell only:
- Next.js App Router routes and layouts
- Composes `@datarecce/ui` exports
- No business logic or component definitions

### Test Code (js/src/)

Test-only directory:
- Vitest test suites
- Test utilities and fixtures
- Should not contain runtime app code

## Import Rules

### Allowed

- `js/app/` → `@datarecce/ui` (public exports)
- `js/packages/ui/` → within its own package
- Test files → `@datarecce/ui` and test utilities

### Forbidden

- `js/app/` → `js/packages/ui/src/*` (deep imports)
- `js/packages/ui/` → `js/app/` or `js/src/`
- Runtime code → test utilities

## Build Process

1. **Development**: `pnpm dev` runs Next.js with Turbopack
2. **Production Build**: `pnpm run build`
   - Next.js builds to `js/out/` (static export)
   - Build script moves files to `recce/data/`
3. **Backend Serving**: FastAPI serves `recce/data/` at runtime

## Node Version Management

Required version specified in `js/.nvmrc`.

```bash
# Option 1: nave (preferred)
nave auto pnpm install

# Option 2: nvm
nvm use
pnpm install
```

## Package Manager

**pnpm ONLY** - Do not use npm or yarn.

```bash
pnpm install     # Install dependencies
pnpm dev         # Development server
pnpm build       # Production build
pnpm lint:fix    # Lint and auto-fix
pnpm type:check  # TypeScript checking
pnpm test        # Run tests
```
