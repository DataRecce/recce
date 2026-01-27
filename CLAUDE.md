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
