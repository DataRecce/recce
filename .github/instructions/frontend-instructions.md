---
applyTo: "js/**/*.ts,js/**/*.tsx,js/**/*.js,js/**/*.jsx,js/**/*.json,js/**/*.mjs"
---

# Frontend Build Instructions (js/ Directory)

## Critical Frontend Build Requirements

**MANDATORY BUILD PROCESS - Frontend changes are NOT visible until this is run:**
```bash
cd js
pnpm run build
# This process:
# 1. Cleans ../recce/data/ directory
# 2. Builds Next.js to js/out/
# 3. Moves js/out/ to ../recce/data/
# YOU MUST restart 'recce server' after this completes
```

**When to rebuild:**
- After ANY TypeScript/React/CSS changes in js/ directory
- Before testing changes with `recce server`
- Before committing frontend changes
- If changes don't appear in the browser (common mistake)

## Package Manager - MUST use pnpm

```bash
# CORRECT - Always use pnpm (version 10)
pnpm install
pnpm dev
pnpm run build
pnpm lint

# WRONG - Never use npm or yarn
npm install  # ❌ Will break dependencies
yarn install # ❌ Will break dependencies
```

**If pnpm not installed:**
```bash
npm install -g corepack@latest
corepack enable
corepack install
```

## Development Workflow

**1. Install dependencies (first time or after package.json changes):**
```bash
cd js
pnpm install --frozen-lockfile  # Use frozen-lockfile in CI/CD
```

**2. Development server (for live coding):**
```bash
cd js
pnpm dev
# Runs on http://localhost:3000 with Turbopack
# Python backend should run separately on http://localhost:8000
```

**3. Linting (run before committing):**
```bash
cd js
pnpm lint           # Check for issues
pnpm lint:fix       # Auto-fix issues
pnpm type:check     # TypeScript compiler check
```

**4. Building (REQUIRED before testing with recce server):**
```bash
cd js
pnpm run build
# After this completes, restart recce server from root:
cd ..
recce server
```

## Common Errors & Solutions

**Error: "Changes not showing up in recce server"**
- **Cause:** Forgot to rebuild frontend
- **Fix:** `cd js && pnpm run build` then restart `recce server`

**Error: "pnpm: command not found"**
- **Fix:** `npm install -g corepack@latest && corepack enable`

**Error: "Module not found" after adding dependency**
- **Fix:** `cd js && pnpm install`

**Error: Build fails with type errors**
- **Check:** `cd js && pnpm type:check` for full error details
- **Common cause:** Missing type definitions or incorrect imports

**Error: "Lockfile is out of date"**
- **Fix:** `cd js && pnpm install` (regenerates lock file)

**Error: Next.js cache issues**
- **Fix:** `cd js && rm -rf .next && pnpm run build`

## Frontend Stack & Key Dependencies

**Core:**
- **Next.js 16** - React framework with App Router, static export mode
- **React 19.2** - UI library
- **TypeScript 5.9** - Type safety
- **pnpm 10** - Package manager (REQUIRED)

**UI Framework:**
- **Chakra UI 3** - Component library
- **@xyflow/react** - Lineage/DAG visualization
- **Monaco Editor** - Code editor for SQL

**State & Data:**
- **@tanstack/react-query** - Server state management
- **axios** - HTTP client for `/api` calls

**Build Tools:**
- **Turbopack** - Fast dev server bundler
- **Tailwind CSS 4** - Utility-first CSS
- **ESLint** - Linting with Next.js config
- **TypeScript ESLint** - Type-aware linting

## File Structure (js/ directory)

```
js/
├── package.json         # Dependencies (Node >=20 required)
├── tsconfig.json        # TypeScript config
├── next.config.mjs      # Next.js config (output: 'export')
├── eslint.config.mjs    # ESLint config
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── layout.tsx   # Root layout
│   │   └── page.tsx     # Home page
│   ├── lib/
│   │   ├── api/         # API client functions (axios)
│   │   └── hooks/       # Custom React hooks
│   ├── components/      # React components
│   │   ├── lineage/     # DAG/lineage visualization
│   │   ├── check/       # Check management UI
│   │   └── run/         # Run execution UI
│   ├── constants/       # App constants
│   └── utils/           # Utility functions
├── .husky/              # Git hooks (pre-commit)
├── .next/               # Next.js build cache (gitignored)
└── out/                 # Build output (moved to ../recce/data/)
```

## Configuration Files

**package.json:**
- Requires Node.js >=20
- Uses pnpm@10 as package manager
- Scripts: `dev`, `build`, `lint`, `type:check`, `clean`

**tsconfig.json:**
- Target: ESNext
- Module: esnext, bundler resolution
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`, `@theme/*` → `./theme/*`

**next.config.mjs:**
- Output mode: `export` (static site generation)
- Exports to `./out` directory
- Build script moves to `../recce/data/`

**eslint.config.mjs:**
- Extends Next.js and Prettier configs
- TypeScript ESLint for type-aware rules
- Import rules, React hooks rules, JSX a11y

## Code Style

**Enforced by ESLint + Prettier:**
- No semicolons (Prettier default)
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line
- React 19 JSX transform (no React import needed)

**Git Hooks (.husky/):**
- Pre-commit: Runs `pnpm lint:staged` and `pnpm type:check` on staged files
- Only triggers for TypeScript/JavaScript files in js/ directory

## Testing

**Test Framework:**
- Jest 30 with jsdom environment
- React Testing Library
- Setup file: `jest.setup.js` (imports @testing-library/jest-dom)

**Run tests:**
```bash
cd js
pnpm test  # Watch mode
```

## API Integration

**Backend API:** `http://localhost:8000/api`

**Key API endpoints:**
- `/api/checks` - Check CRUD operations
- `/api/runs` - Run execution and polling
- `/api/lineage` - DAG data for visualization
- `/api/models` - Model metadata

**API Client:** Located in `src/lib/api/`, uses axios with error handling

## Build Output

**Where frontend is served from:**
- Development: `http://localhost:3000` (pnpm dev)
- Production: `../recce/data/` (served by Python FastAPI server)

**Build process details:**
1. `pnpm run clean` removes old `../recce/data/`
2. `next build` creates static site in `./out/`
3. Script moves `./out/` to `../recce/data/`
4. Python package includes `recce/data/**` in package_data

## CI/CD - Frontend Validation

**GitHub Actions workflow:** `.github/workflows/tests-js.yaml`

**What it checks:**
1. Node.js 24 setup
2. pnpm 10 installation
3. Dependency install with frozen lockfile
4. ESLint linting (`pnpm lint`)
5. Production build (`pnpm run build`)

**To replicate CI locally:**
```bash
cd js
pnpm install --frozen-lockfile
pnpm lint
pnpm run build
```

## Critical Reminders

1. **Always run `pnpm run build` after frontend changes** - Most common mistake
2. **Never edit `../recce/data/` directly** - It's auto-generated
3. **Use pnpm, not npm/yarn** - Different package managers have incompatibilities
4. **Restart `recce server` after builds** - Server doesn't hot-reload static files
5. **Run `pnpm lint` before committing** - CI will fail if linting fails
6. **Check `pnpm type:check` for type errors** - Catches issues early

## Quick Reference Commands

```bash
# Install dependencies
cd js && pnpm install

# Development
cd js && pnpm dev

# Lint & type check
cd js && pnpm lint && pnpm type:check

# Build for production
cd js && pnpm run build

# After build, test with Python server
cd .. && recce server

# Clean build artifacts
cd js && pnpm run clean
```

**Trust these instructions.** The frontend build process has specific requirements that differ from typical React apps because the output must integrate with the Python package. Only search for additional information if these instructions are incomplete or incorrect.
