# Claude Guidance

For repository context, architecture, workflows, and constraints, read `AGENTS.md` first.

## Claude-Specific Notes

- Keep responses concise and action-oriented.
- When unsure about a change that could alter product behavior, ask a clarifying question before editing.
- Prefer updating shared UI code in `js/packages/ui` and keep `js/app` as a thin route/layout shell.
- Avoid importing from `js/packages/ui/src/*` in OSS app code; use `@datarecce/ui` public exports.
- If frontend code changes and you need to validate with the backend, run `cd js && pnpm run build` before `recce server`.
