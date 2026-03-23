# @datarecce/ui Dependency Reference

This document describes the dependency contract for consumers of `@datarecce/ui`.

## Peer Dependencies (you must provide)

These must be installed in your project. `@datarecce/ui` does not bundle them.

| Package | Required Range | Notes |
|---------|---------------|-------|
| `react` | `^18.0.0 \|\| ^19.0.0` | |
| `react-dom` | `^18.0.0 \|\| ^19.0.0` | |
| `@sentry/react` | `^10.0.0` | **Optional.** Error boundary integration. |

## Transitive Dependencies (installed automatically)

These are declared in `@datarecce/ui`'s `dependencies` and installed automatically by your package manager. You do not need to install them manually, but if your project also uses these packages, the version ranges below must be satisfiable.

### UI Framework

| Package | Range | Category |
|---------|-------|----------|
| `@emotion/react` | `^11.14.0` | CSS-in-JS |
| `@emotion/styled` | `^11.14.0` | CSS-in-JS |
| `@mui/material` | `^7.3.9` | Component library |
| `@mui/system` | `^7.3.9` | MUI system utilities |
| `@xyflow/react` | `^12.10.1` | Lineage graph |
| `@hello-pangea/dnd` | `^18.0.0` | Drag and drop |
| `next-themes` | `^0.4.0` | Theme switching |

### Data Grid & Charts

| Package | Range | Category |
|---------|-------|----------|
| `ag-grid-community` | `^35.1.0` | Data grid |
| `ag-grid-react` | `^35.1.0` | Data grid React bindings |
| `chart.js` | `^4.5.0` | Charts |
| `react-chartjs-2` | `^5.3.0` | Chart.js React bindings |

### Code Editor

| Package | Range | Category |
|---------|-------|----------|
| `@codemirror/lang-sql` | `^6.10.0` | SQL language support |
| `@codemirror/lang-yaml` | `^6.1.0` | YAML language support |
| `@codemirror/merge` | `^6.12.0` | Diff/merge view |
| `@codemirror/state` | `^6.5.0` | Editor state |
| `@codemirror/view` | `^6.39.16` | Editor view |
| `@uiw/codemirror-theme-github` | `^4.25.7` | GitHub theme |
| `@uiw/react-codemirror` | `^4.25.7` | React wrapper |

### Analytics

| Package | Range | Notes |
|---------|-------|-------|
| `@amplitude/analytics-core` | `^2.41.2` | Analytics core |
| `@amplitude/unified` | `1.0.1` | **Pinned.** Exact version required. |

### Utilities

| Package | Range | Category |
|---------|-------|----------|
| `@dagrejs/dagre` | `^1.1.0` | Graph layout |
| `@tanstack/react-query` | `^5.0.0` | Data fetching |
| `axios` | `^1.0.0` | HTTP client |
| `common-tags` | `^1.8.0` | Template literals |
| `date-fns` | `^4.1.0` | Date utilities |
| `file-saver` | `^2.0.5` | File download |
| `html-to-image` | `^1.11.11` | Screenshot capture |
| `html2canvas-pro` | `^1.5.0` | HTML to canvas |
| `js-cookie` | `^3.0.5` | Cookie management |
| `lodash` | `^4.17.21` | Utility library |
| `react-icons` | `^5.6.0` | Icon library |
| `react-markdown` | `^10.1.0` | Markdown rendering |
| `react-split` | `^2.0.14` | Split panes |
| `react-syntax-highlighter` | `^16.1.1` | Code highlighting |
| `remark-gfm` | `^4.0.0` | GFM markdown |
| `usehooks-ts` | `^3.1.1` | React hooks |
| `write-excel-file` | `^3.0.0` | Excel export |
| `yaml` | `^2.8.0` | YAML parser |

## Version Range Policy

- **`@datarecce/ui` dependencies use wide `^` ranges** to give consumers maximum flexibility. The minimum version listed is the oldest version we are compatible with.
- **The monorepo root `js/package.json`** pins narrower ranges and the `pnpm-lock.yaml` locks exact versions for CI/dev. These do not affect consumers.
- **`pnpm.overrides`** in the root resolve version conflicts within the monorepo only. They do not propagate to published packages.
- **Dependabot updates** should bump versions in the root `js/package.json` and lockfile, NOT in `@datarecce/ui`'s `dependencies`, unless a new minimum version is actually required by API changes.

## For Maintainers

When updating dependencies:

1. **Root `js/package.json`**: Bump freely. Controls what the monorepo installs and tests with.
2. **`js/packages/ui/package.json` dependencies**: Only raise the floor when `@datarecce/ui` code actually requires a feature/fix from the newer version. Consumers must satisfy these ranges.
3. **`js/packages/ui/package.json` devDependencies**: Bump freely. Not consumer-facing.
4. **`js/packages/storybook/package.json`**: Bump freely. Not published.
