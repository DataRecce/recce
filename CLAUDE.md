# Claude Guidance

For repository context, architecture, workflows, and constraints, read `AGENTS.md` first.

## Claude-Specific Notes

- Keep responses concise and action-oriented.
- When unsure about a change that could alter product behavior, ask a clarifying question before editing.
- Prefer updating shared UI code in `js/packages/ui` and keep `js/app` as a thin route/layout shell.
- Avoid importing from `js/packages/ui/src/*` in OSS app code; use `@datarecce/ui` public exports.
- If frontend code changes and you need to validate with the backend, run `cd js && pnpm run build` before `recce server`.

## Dependency Update Workflow

When the user asks to "update deps", "check for updates", or similar:

### Phase 1: Audit and Discovery

```bash
cd js
pnpm audit
pnpm outdated
```

### Phase 2: Present Updates

Show a numbered list grouped by priority:

```
SECURITY (update recommended):
  1. [package] current → target (vulnerability)

MAJOR:
  2. [package] current → target

MINOR/PATCH:
  3. [package] current → target

Enter numbers to update (e.g., "1, 3-5" or "all" or "security only"):
```

### Phase 3: Apply Updates

For each selected package:

1. Update version in root `js/package.json` (dependencies or devDependencies)
2. If package exists in `packages/ui/package.json` or `packages/storybook/package.json`, add/update `pnpm.overrides` in root

### Phase 4: Verify

```bash
cd js
pnpm install
pnpm lint
pnpm type:check
pnpm test
pnpm build
```

Only proceed to commit if ALL steps pass.

### Packages Requiring Overrides

These packages exist in multiple package.json files and MUST have overrides when updated:

**From UI package:** @emotion/react, @emotion/styled, @mui/material, @mui/system, @tanstack/react-query, @xyflow/react, axios, date-fns, file-saver, html-to-image, html2canvas-pro, js-cookie, lodash, next-themes, react-icons, react-split, usehooks-ts, tailwindcss, postcss, @tailwindcss/postcss, typescript

**From Storybook package:** @testing-library/jest-dom, @testing-library/react, @vitejs/plugin-react, vitest, @vitest/coverage-v8

## Publishing @datarecce/ui to npm

When the user asks to "publish ui", "release ui package", or similar:

### Phase 1: Version Check

```bash
cd js/packages/ui

# Get the published version from npm
PUBLISHED_VERSION=$(npm view @datarecce/ui version 2>/dev/null || echo "0.0.0")

# Get the local version from package.json
LOCAL_VERSION=$(node -p "require('./package.json').version")

echo "Published version: $PUBLISHED_VERSION"
echo "Local version: $LOCAL_VERSION"
```

Compare versions using semver rules. **STOP with an error** if:
- Local version equals published version
- Local version is less than published version

Only proceed if local version is strictly greater than published version.

### Phase 2: Pre-publish Verification

Run all checks from the `js` directory:

```bash
cd js
pnpm install
pnpm lint
pnpm type:check
pnpm test
pnpm build
```

Then build the UI package specifically:

```bash
cd js/packages/ui
pnpm build
```

**STOP if any step fails.** Do not publish a broken package.

### Phase 3: Publish

```bash
cd js/packages/ui
npm publish --access public
```

### Phase 4: Verify Publication

```bash
# Confirm the new version is live
npm view @datarecce/ui version
```

### Version Bump Guidelines

Before publishing, ensure the version in `js/packages/ui/package.json` has been bumped appropriately:

- **Patch** (0.2.0 → 0.2.1): Bug fixes, documentation updates
- **Minor** (0.2.0 → 0.3.0): New features, non-breaking changes
- **Major** (0.2.0 → 1.0.0): Breaking API changes

### Authentication

Ensure you are logged into npm with publish permissions:

```bash
npm whoami
# Should show a user with publish access to @datarecce scope
```

If not authenticated, run `npm login` first.

## Commit and PR Workflow

### Commits

> **REQUIRED: All commits MUST use `--signoff` (or `-s`).** This is non-negotiable and absolutely required. Commits without sign-off will be rejected.

```bash
git commit -s -m "Your commit message"
# OR
git commit --signoff -m "Your commit message"
```

- Write clear, concise commit messages describing what changed and why
- Include `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` at the end

### Pull Requests

When creating a PR, the description MUST follow `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
**PR checklist**
- [ ] Ensure you have added or ran the appropriate tests for your PR.
- [ ] DCO signed

**What type of PR is this?**
(bug fix, feature, refactor, docs, chore, etc.)

**What this PR does / why we need it**:
(Clear explanation of the changes)

**Which issue(s) this PR fixes**:
(Fixes #123 or "N/A")

**Special notes for your reviewer**:
(Any context, trade-offs, or areas to focus on)

**Does this PR introduce a user-facing change?**:
(If no, write "NONE". If yes, describe the change for release notes.)
```
