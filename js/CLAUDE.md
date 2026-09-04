# CLAUDE.md (Frontend)

Frontend-specific instructions for the `js/` monorepo. Applies to `js/app/` (OSS Next.js shell), `js/packages/ui/` (`@datarecce/ui`), and `js/packages/storybook/`.

> **Working directory:** every command in this document assumes you are in the `js/` directory (i.e., `cd js` first, or equivalently use `pnpm --dir js …` from the repo root). There is no root `package.json` — running pnpm from the repo root will fail.

For repo-wide guidance see `../CLAUDE.md` and `../AGENTS.md`.

## Package Manager & Tooling

- This monorepo uses **pnpm** — never npm or npx for install/test/lint/build.
- Node.js 26.5.0: use `nave use $(cat .nvmrc)` (not `nvm`); `.nvmrc` is the source of truth.
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

1. **Node.js 26:** `nave use $(cat .nvmrc)` for all commands.
2. **Version check:** Compare local vs published (`npm view @datarecce/ui version`).
3. **Verify:** Run all quality checks from `js/` (`pnpm lint:fix && pnpm type:check && pnpm test && pnpm run build`).
4. **Publish:** `cd packages/ui && npm publish --access public`.
5. **Confirm:** `npm view @datarecce/ui version`.

## Dependency Updates (frontend)

When updating frontend deps:

1. **Audit:** `pnpm audit && pnpm outdated`.
2. **Apply:** Update root `js/package.json`; add `pnpm.overrides` for shared packages.
3. **Verify:** `pnpm install && pnpm lint && pnpm type:check && pnpm test && pnpm run build`.

Packages requiring overrides (exist in multiple `package.json`): `@emotion/react`, `@mui/material`, `@tanstack/react-query`, `@xyflow/react`, `axios`, `date-fns`, `lodash`, `tailwindcss`, `typescript`, `vitest`.

## pnpm v12 — strictDepBuilds + allowBuilds

The repo runs on pnpm v12.0.0 (since 2026-08-27). Five non-obvious behaviors:

1. **`strictDepBuilds: true` is on by default.** Any transitive package with a `postinstall` script that isn't explicitly listed in `pnpm-workspace.yaml#allowBuilds` will cause `pnpm install --frozen-lockfile` to hard-fail in CI with `ERR_PNPM_IGNORED_BUILDS`. When a new dep triggers this, add it to `allowBuilds` as `true` (run its postinstall) or `false` (acknowledge it exists, do NOT run postinstall).

2. **Local repro requires CI parity.** Use `CI=true pnpm install --frozen-lockfile` to match CI exactly. The `--ignore-scripts` flag will MASK this failure — do not use it as a verification path.

3. **Never accept generated `allowBuilds` placeholders.** If a non-TTY install discovers an ignored build, inspect `pnpm-workspace.yaml#allowBuilds` for `<pkg>: set this to true or false`. Always run `git status` after an install and replace any placeholder with a reviewed boolean decision before committing.

4. **`packageManager` must be exact semver.** Do not use ranges or dist-tags such as `pnpm@12`, `latest`, or `next-12`. Pin the full `pnpm@12.x.y+sha512.<integrity>` via `corepack use pnpm@12.x.y` (note the `.` separator between `sha512` and the hash — not `:`).

5. **The lockfile pins pnpm's platform executables.** Changing `packageManager` requires regenerating `pnpm-lock.yaml` so its leading `packageManagerDependencies` document records pnpm and every supported platform package with integrity hashes. CI's frozen install rejects a mismatched pin. GitHub Actions must read the version from `js/package.json` through the SHA-pinned `pnpm/setup` action rather than duplicate the version in workflow YAML.

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
| Tests fail with no obvious cause | Check Node.js 26 is active: `nave use $(cat .nvmrc)` |
