# Story Categories

Stories are organized by functional category rather than source file structure.

## Categories

### `timeline/`

Components for displaying check activity and comments.

- **TimelineEvent** - Individual timeline entries (comments, approvals, changes)
- **CommentInput** - Comment composer with markdown support

### `data/` (planned)

Components for data visualization and profiling.

- **HistogramChart** - Distribution visualization
- **TopKBarChart** - Top K values bar chart

### `lineage/` (planned)

Components for data lineage visualization.

- **LineageNode** - Individual node in lineage graph
- **LineageView** - Complete lineage graph container
- **LineageEdge** - Connection between nodes

### `ui/` (planned)

Generic UI primitives used across the application.

- **Split** - Resizable split panes
- **MarkdownContent** - Markdown renderer

## Adding a New Category

1. Create directory: `stories/<category>/`
2. Add `fixtures.ts` for shared test data
3. Add component stories
4. Update this README
