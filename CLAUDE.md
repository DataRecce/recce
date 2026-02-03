# CLAUDE.md

@AGENTS.md

<!-- Above imports universal agent instructions. Claude-specific extensions below. -->

## Quick Reference

For detailed documentation beyond AGENTS.md essentials:

→ `docs/KNOWLEDGE_BASE.md` - Architecture, code patterns, frontend structure, testing, debugging

## Claude-Specific Notes

- Keep responses concise and action-oriented
- Ask clarifying questions before changes that alter product behavior
- Prefer updating shared UI code in `js/packages/ui`; keep `js/app` thin
- Run `cd js && pnpm run build` before `recce server` when validating frontend changes

## AI Agent Documentation

Use gitignored directories for temporary working documents:
- `docs/plans/` - Implementation plans and design docs
- `docs/tasks/` - Task lists and tracking
- `docs/summaries/` - Status reports and progress updates

## Dependency Update Workflow

When asked to "update deps" or "check for updates":

1. **Audit:** `cd js && pnpm audit && pnpm outdated`
2. **Present:** Group by SECURITY/MAJOR/MINOR with numbered list
3. **Apply:** Update root `js/package.json`; add `pnpm.overrides` for shared packages
4. **Verify:** `pnpm install && pnpm lint && pnpm type:check && pnpm test && pnpm build`

Packages requiring overrides (exist in multiple package.json): @emotion/react, @mui/material, @tanstack/react-query, @xyflow/react, axios, date-fns, lodash, tailwindcss, typescript, vitest

## Publishing @datarecce/ui

When asked to "publish ui" or "release ui package":

1. **Node version:** Use `nave use $(cat js/.nvmrc)` for all commands
2. **Version check:** Compare local vs published (`npm view @datarecce/ui version`)
3. **Verify:** Run all quality checks from `js/` directory
4. **Publish:** `cd js/packages/ui && npm publish --access public`
5. **Confirm:** `npm view @datarecce/ui version`

## Commit and PR Workflow

**Commits:** Always use `--signoff` and include `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`

**PRs:** Follow `.github/PULL_REQUEST_TEMPLATE.md`:
- PR checklist (tests, DCO)
- Type, description, linked issues
- Reviewer notes, user-facing changes

## Individual Preferences

- @~/.claude/recce.md
