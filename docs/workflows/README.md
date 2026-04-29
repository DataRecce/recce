# Workflows

This directory is the canonical home for plain-text Spacedock workflows in this repository. Each subdirectory is a workflow with its own `README.md` (the workflow's frontmatter, stages, and entity schema), zero or more `_mods/` (lifecycle hooks), and per-entity markdown files. New workflows commissioned via `/spacedock:commission` should land here.

## Workflows

- [`linear-delivery/`](./linear-delivery/) — Take a Linear issue from triage through to merged code, end-to-end.

## Cross-references

The following workflow lives outside `docs/workflows/` for historical reasons and is not being relocated. It is listed here for discoverability only:

- [`../claude-skill-refinement/`](../claude-skill-refinement/) — Refine and integrate Claude skills under `.claude/skills/` into Spacedock primitives.
