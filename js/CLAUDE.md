# CLAUDE.md (Frontend)

Frontend-specific instructions for the `js/` monorepo. Applies to `js/app/` (OSS Next.js shell), `js/packages/ui/` (`@datarecce/ui`), and `js/packages/storybook/`.

> **Working directory:** every command in this document assumes you are in the `js/` directory (i.e., `cd js` first, or equivalently use `pnpm --dir js …` from the repo root). There is no root `package.json` — running pnpm from the repo root will fail.

For repo-wide guidance see `../CLAUDE.md` and `../AGENTS.md`.

## Package Manager & Tooling

- This monorepo uses **pnpm** — never npm or npx for install/test/lint/build.
- Node version: use `nave use $(cat .nvmrc)` (not `nvm`).
- Linter/formatter: **Biome 2.4** — run `pnpm lint:fix` for autofix and `pnpm lint` for verification.
- Type checking: `pnpm type:check`.
- Tests: `pnpm test` (Vitest + React Testing Library).
- Run all checks from `js/`: `pnpm lint:fix && pnpm type:check && pnpm test`.

## Build Before Backend Validation

Run `pnpm run build` before launching `recce server` whenever frontend changes need to be validated end-to-end — the Python package serves the static build from `recce/data/`.

## Style Conventions

- **Storybook imports:** Never import from `ui/src` internal paths (e.g., `../../../ui/src/...`). Always use `@datarecce/ui/components` or other `@datarecce/ui` package exports. This keeps the package boundary intact.
- **CSS color format:** Use space-separated `rgb()` syntax: `rgb(255 173 21)`, `rgb(0 0 0 / 0.45)`. Do not use comma-separated legacy format (`rgba(0, 0, 0, 0.45)`).
- **Font sizes:** Use `rem`, not `px`. When touching changed code that uses `px` for font-size, convert it.
- **Shell vs shared:** Keep `js/app/` thin (routes/layouts only). Shared components, hooks, and API clients live in `js/packages/ui/src/`.

## Publishing @datarecce/ui

When asked to "publish ui" or "release ui package":

1. **Node version:** `nave use $(cat .nvmrc)` for all commands.
2. **Version check:** Compare local vs published (`npm view @datarecce/ui version`).
3. **Verify:** Run all quality checks from `js/` (`pnpm lint:fix && pnpm type:check && pnpm test && pnpm run build`).
4. **Publish:** `cd packages/ui && npm publish --access public`.
5. **Confirm:** `npm view @datarecce/ui version`.

## Dependency Updates (frontend)

When updating frontend deps:

1. **Audit:** `pnpm audit && pnpm outdated`.
2. **Apply:** Update root `js/package.json`; add `pnpm.overrides` for shared packages.
3. **Verify:** `pnpm install && pnpm lint && pnpm type:check && pnpm test && pnpm build`.

Packages requiring overrides (exist in multiple `package.json`): `@emotion/react`, `@mui/material`, `@tanstack/react-query`, `@xyflow/react`, `axios`, `date-fns`, `lodash`, `tailwindcss`, `typescript`, `vitest`.

## pnpm v11 — strictDepBuilds + allowBuilds

The repo runs on pnpm v11.1.1 (since DRC-3439, 2026-05-13). Four non-obvious behaviors:

1. **`strictDepBuilds: true` is on by default.** Any transitive package with a `postinstall` script that isn't explicitly listed in `pnpm-workspace.yaml#allowBuilds` will cause `pnpm install --frozen-lockfile` to hard-fail in CI with `ERR_PNPM_IGNORED_BUILDS`. When a new dep triggers this, add it to `allowBuilds` as `true` (run its postinstall) or `false` (acknowledge it exists, do NOT run postinstall).

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
| Frontend changes not appearing in `recce server` | `pnpm run build` then restart `recce server` |
| Biome lint failures | `pnpm lint:fix` |
| Type errors | `pnpm type:check` for details |
| Tests fail with no obvious cause | Check Node version: `nave use $(cat .nvmrc)` |
