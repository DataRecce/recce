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

**3. Linting and formatting (run before committing):**
```bash
cd js
pnpm lint           # Check for issues (Biome)
pnpm lint:fix       # Auto-fix issues (Biome)
pnpm type:check     # TypeScript compiler check
```

**4. Build for production:**
```bash
cd js
pnpm run build
# MUST do this after frontend changes
# Then restart: cd .. && recce server
```

**5. Clean build artifacts:**
```bash
cd js
pnpm run clean
# Removes ../recce/data/ directory
```

## Tech Stack

- **Node.js >=20** - JavaScript runtime (required)
- **pnpm 10** - Package manager (NOT npm or yarn)
- **Next.js 16** - React framework with App Router
- **React 19.2** - UI library with new JSX transform
- **React DOM 19.2** - React renderer
- **TypeScript 5.9** - Type safety
- **Chakra UI 3** - Component library
- **Biome 2.3** - Fast linter and formatter (replaces ESLint + Prettier)
- **Turbopack** - Fast dev server bundler
- **Tailwind CSS 4** - Utility-first CSS

## File Structure (js/ directory)

```
js/
├── package.json         # Dependencies (Node >=20 required)
├── tsconfig.json        # TypeScript config
├── next.config.mjs      # Next.js config (output: 'export')
├── biome.json           # Biome linter & formatter config
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
- Uses pnpm@10.22.0 as package manager
- Key scripts:
  - `dev`: Start development server with Turbopack
  - `build`: Clean, build Next.js, move to ../recce/data
  - `lint`: Run Biome checks (error level only)
  - `lint:fix`: Run Biome with auto-fix
  - `lint:staged`: Run Biome on staged files only
  - `type:check`: TypeScript compilation check
  - `clean`: Remove ../recce/data/

**tsconfig.json:**
- Target: ESNext
- Module: esnext, bundler resolution
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`, `@theme/*` → `./theme/*`

**next.config.mjs:**
- Output mode: `export` (static site generation)
- Exports to `./out` directory
- Build script moves to `../recce/data/`

**biome.json:**
- Schema: https://biomejs.dev/schemas/2.3.5/schema.json
- VCS integration: Git with useIgnoreFile enabled
- Formatter: Space indentation, double quotes for JavaScript
- Linter: Custom rule configuration (not using recommended preset)
- Key rules enforced:
  - `noExplicitAny`: Disallow explicit `any` types
  - `useExhaustiveDependencies`: Enforce React Hook dependencies
  - `useHookAtTopLevel`: React Hooks must be at top level
  - `noUnusedVariables`: No unused variables
  - Many more correctness, style, and suspicious pattern checks
- Includes: All files except `.next/`, `.swc/`, `node_modules/`, `out/`, etc.
- CSS parser: Tailwind directives enabled

## Code Style

**Enforced by Biome:**
- Double quotes for strings (JavaScript/TypeScript)
- Space indentation (configured in biome.json)
- React 19 JSX transform (no React import needed)
- Comprehensive linting for:
  - Complexity issues (useless code, optional chains)
  - Correctness errors (undefined variables, unreachable code)
  - Style consistency (array types, type definitions)
  - Suspicious patterns (explicit any, duplicate keys, debugger statements)

**Git Hooks (.husky/):**
- Pre-commit: Runs `pnpm lint:staged` and `pnpm type:check` on staged files
- Only triggers for TypeScript/JavaScript files in js/ directory
- Uses Biome's `--staged` flag for efficient checking

## Testing

**Test Framework:**
- Jest 30 with jsdom environment
- React Testing Library 16.3
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
4. Biome linting (`pnpm lint`)
5. Production build (`pnpm run build`)

**To replicate CI locally:**
```bash
cd js
pnpm install --frozen-lockfile
pnpm lint
pnpm run build
```

## Common Errors & Fixes

**Error: Changes not appearing in browser**
- **Cause:** Forgot to rebuild after frontend changes
- **Fix:** `cd js && pnpm run build` then restart `recce server`

**Error: `pnpm: command not found`**
- **Cause:** pnpm not installed
- **Fix:** `npm install -g corepack@latest && corepack enable`

**Error: Build fails with Node version error**
- **Cause:** Node.js version too old
- **Fix:** Upgrade to Node.js 20 or later (`node --version` to check)

**Error: Biome lint failures**
- **Cause:** Code doesn't meet Biome rules
- **Fix:** Run `pnpm lint:fix` to auto-fix, then manually fix remaining issues

**Error: Type errors during build**
- **Cause:** TypeScript compilation errors
- **Fix:** Run `pnpm type:check` to see detailed error messages, fix type issues

**Error: Dependencies out of sync**
- **Cause:** package.json changed but not reinstalled
- **Fix:** `cd js && pnpm install`

**Error: Import resolution issues**
- **Cause:** TypeScript path aliases not configured
- **Fix:** Check `tsconfig.json` paths configuration

## Migration Notes: ESLint → Biome

**What changed:**
- Replaced ESLint + Prettier with Biome for faster, unified tooling
- Configuration moved from `eslint.config.mjs` to `biome.json`
- Commands remain the same (`pnpm lint`, `pnpm lint:fix`) but now run Biome
- Biome provides both linting AND formatting in one tool
- Significantly faster than ESLint (written in Rust vs JavaScript)

**Key differences:**
- Biome uses `biome.json` instead of `.eslintrc` or `eslint.config.mjs`
- Biome rules are organized into categories: complexity, correctness, style, suspicious
- Biome has opinionated defaults but allows customization
- No separate Prettier config needed - formatting is built-in
- Git hooks updated to use `biome check --staged`

## Critical Reminders

1. **Always run `pnpm run build` after frontend changes** - Most common mistake
2. **Never edit `../recce/data/` directly** - It's auto-generated
3. **Use pnpm, not npm/yarn** - Different package managers have incompatibilities
4. **Restart `recce server` after builds** - Server doesn't hot-reload static files
5. **Run `pnpm lint` before committing** - CI will fail if Biome checks fail
6. **Check `pnpm type:check` for type errors** - Catches issues early
7. **Use `pnpm lint:fix` for auto-fixable issues** - Saves time on formatting

## Quick Reference Commands

```bash
# Install dependencies
cd js && pnpm install

# Development
cd js && pnpm dev

# Lint, fix, & type check
cd js && pnpm lint          # Check with Biome
cd js && pnpm lint:fix      # Auto-fix with Biome
cd js && pnpm type:check    # TypeScript check

# Build for production
cd js && pnpm run build

# After build, test with Python server
cd .. && recce server

# Clean build artifacts
cd js && pnpm run clean
```

**Trust these instructions.** The frontend build process has specific requirements that differ from typical React apps because the output must integrate with the Python package. Only search for additional information if these instructions are incomplete or incorrect.
