# MCP Apps Widgets — Iter 1 Developer Guide

## Overview

Recce exposes two MCP servers that work in tandem when the MCP Apps widget
feature is enabled. The primary `recce mcp-server` handles all data-retrieval
and check-management tools. A secondary `recce mcp-widget-server` serves a
small set of "widget tools" — tools whose responses Claude Desktop renders as
interactive HTML panels rather than plain text. The two servers are coordinated
through the `RECCE_MCP_WIDGETS=1` environment variable: when that flag is set,
`mcp-server` silently omits the widget tools from its `tools/list` response so
that Claude Desktop routes those calls exclusively to `mcp-widget-server`, which
annotates each tool with `_meta.ui.resourceUri` pointing at an HTML resource.

Phase A ships five widgets: `row_count_diff`, `schema_diff`, `get_server_info`,
`list_checks`, and `get_model`. Phase B iter 1 adds `query`, `query_diff`,
`value_diff`, `value_diff_detail`, and `top_k_diff` (five tier-3 data-table/list
widgets). Phase C adds two tier-4 chart widgets: `histogram_diff` (hand-rolled SVG
bar chart) and `profile_diff` (per-column statistical profile card grid). Phase D
adds two tier-5 (mini graph) widgets: `get_cll` — column-level lineage rendered as
a hand-rolled SVG mini-DAG — and `impact_analysis` — model-level blast-radius
dashboard with per-model impact badges, row-count/value-diff chips, SVG mini-DAG
(up to 15 nodes), and an actionable "What to investigate next" list.
Total: **14 of 20 planned widgets** (70% coverage). All run in
**local mode only** — cloud/session mode is not supported until iter 2.

---

## File Layout

```
recce/
  mcp_server.py              # Existing primary server.
                             # WIDGET_TOOLS set + _widgets_enabled() filter live here.
  widget_server.py           # FastMCP widget server (Phase A + Phase B).
                             # @mcp.tool delegates + @mcp.resource handlers.
  cli.py                     # mcp-widget-server CLI subcommand added here.
  data/
    mcp/                     # Widget HTML asset directory (gitignored via per-extension
      row_count_diff.html    # allowlist — see .gitignore). Self-contained HTML files.
      schema_diff.html
      get_server_info.html
      list_checks.html
      get_model.html
      query.html             # Phase B tier-3: scrollable SQL result table
      query_diff.html        # Phase B tier-3: two-env comparison with status pills + filters
      value_diff.html        # Phase B tier-3: column-level match stats
      value_diff_detail.html # Phase B tier-3: row-level diff table with filter pills
      top_k_diff.html        # Phase B tier-3: side-by-side ranked lists with inline bars
      histogram_diff.html    # Phase C tier-4: hand-rolled SVG bar chart (base vs current bins)
      profile_diff.html      # Phase C tier-4: per-column profile card grid (count/null/distinct/min/max/avg/median)
tests/
  test_widget_server.py      # 35 tests covering WIDGET_TOOLS coordination + widget server.
docs/
  mcp-widgets.md             # This file.
```

---

## Claude Desktop Configuration

Register both servers in `~/Library/Application Support/Claude/claude_desktop_config.json`.
Both entries need `RECCE_MCP_WIDGETS=1` — without it, `mcp-server` keeps the
widget tools in its own `tools/list` and `mcp-widget-server` sees them routed
to the wrong server.

```json
{
  "mcpServers": {
    "recce": {
      "command": "recce",
      "args": ["mcp-server", "--project-dir", "/path/to/your/dbt/project"],
      "env": {
        "RECCE_MCP_WIDGETS": "1"
      }
    },
    "recce-widgets": {
      "command": "recce",
      "args": ["mcp-widget-server", "--project-dir", "/path/to/your/dbt/project"],
      "env": {
        "RECCE_MCP_WIDGETS": "1"
      }
    }
  }
}
```

Replace `/path/to/your/dbt/project` with the directory containing
`dbt_project.yml`. Both entries must point at the same project directory.

---

## Add a Widget — Step-by-Step Walkthrough

The worked reference throughout is `row_count_diff`. Add a new widget called
`<tool>` by following these steps in order.

### Step 1 — Register the tool name in `WIDGET_TOOLS`

File: `recce/mcp_server.py`, near line 56.

```python
WIDGET_TOOLS = {"row_count_diff", "schema_diff", "get_server_info", "list_checks", "get_model", "query", "<tool>"}
```

This single change makes `mcp-server` omit `<tool>` from `tools/list` when
`RECCE_MCP_WIDGETS=1`, and raises an explanatory error if the agent calls it
on the wrong server.

### Step 2 — Write the widget HTML at `recce/data/mcp/<tool>.html`

Create a single self-contained HTML file. Import the MCP Apps SDK from unpkg
— **pin this exact version**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My Tool</title>
</head>
<body>
  <div id="root">Loading…</div>
  <script type="module">
    import {
      App,
      applyDocumentTheme,
      applyHostStyleVariables,
      applyHostFonts,
    } from "https://unpkg.com/@modelcontextprotocol/ext-apps@0.4.0/app-with-deps";

    const app = new App({ name: "My Tool", version: "1.0.0" });

    // Apply host theme on every context change (theme switch, font change, etc.)
    app.onhostcontextchanged = (ctx) => {
      if (ctx.theme) applyDocumentTheme(ctx.theme);
      if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
      if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
    };

    app.ontoolresult = ({ structuredContent }) => {
      const models = structuredContent?.models ?? {};
      document.getElementById("root").textContent = JSON.stringify(models, null, 2);
    };

    app.onteardown = async () => { return {}; };

    await app.connect();

    // Apply theme from initial context if available before first change event
    const initialCtx = app.getHostContext?.();
    if (initialCtx) {
      if (initialCtx.theme) applyDocumentTheme(initialCtx.theme);
      if (initialCtx.styles?.variables) applyHostStyleVariables(initialCtx.styles.variables);
      if (initialCtx.styles?.css?.fonts) applyHostFonts(initialCtx.styles.css.fonts);
    }
  </script>
</body>
</html>
```

`structuredContent` comes from the `CallToolResult.structuredContent` set in the
Python handler (see "structuredContent contract" below). The `models` key is the
wrapping convention this codebase uses — your render function reads from
`structuredContent.models`.

SDK theme helpers (`applyDocumentTheme`, `applyHostStyleVariables`,
`applyHostFonts`) actively apply design tokens from the host context via
`postMessage`. Use `var(--token, fallback)` in CSS as a defensive layer in case
the helper hasn't fired yet (race condition on first load).

Add the HTML file to git normally — it escapes the broad `recce/data` gitignore
via per-extension rules in `.gitignore` (see "Gotchas").

### Step 3 — Add a `@mcp.tool` delegate in `recce/widget_server.py`

Define Pydantic input and output models first, then the tool handler:

```python
from pydantic import BaseModel, Field
from mcp.types import CallToolResult, TextContent

class MyToolInput(BaseModel):
    select: Optional[str] = Field(
        default=None,
        description="dbt selector syntax",
    )
    exclude: Optional[str] = Field(
        default=None,
        description="dbt selector syntax for exclusion",
    )

class MyToolModel(BaseModel):
    # ... fields matching the data shape for one model
    pass

class MyToolOutput(BaseModel):
    models: Dict[str, MyToolModel]

@mcp.tool(
    name="<tool>",
    annotations={
        "title": "My Tool (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
    meta={
        "ui": {"resourceUri": "ui://recce/<tool>.html"},
        "ui/resourceUri": "ui://recce/<tool>.html",
    },
)
async def <tool>(args: MyToolInput) -> CallToolResult:
    """One-line summary.

    Use when: ...
    Don't use when: ...
    Returns: CallToolResult with structuredContent: MyToolOutput shape.
    """
    result = await _recce_server._tool_<tool>(args.model_dump(exclude_none=True))
    output = MyToolOutput(
        models={name: MyToolModel(**v) for name, v in result.items()},
    )
    return CallToolResult(
        content=[TextContent(type="text", text="<Tool> rendered in widget.")],
        structuredContent=output.model_dump(),
    )
```

Key requirements:
- Use a **Pydantic BaseModel input** (`MyToolInput`) with `Field(description=...)`
  on every param. FastMCP infers the JSON `inputSchema` from the model schema.
  Without a schema the tool is uncallable from Claude Desktop.
- Use a **Pydantic BaseModel output** (`MyToolOutput`). This generates a clean
  `outputSchema` and prevents FastMCP's `{result: ...}` wrapping that occurs
  with bare `Dict[str, Any]` returns.
- **Return `CallToolResult` explicitly** with a one-sentence `content` string.
  The agent reads only the short content text; the widget reads `structuredContent`.
- `annotations` dict is required: `readOnlyHint`, `destructiveHint`,
  `idempotentHint`, `openWorldHint`, `title`.
- `meta` needs **both** the nested key (`"ui": {"resourceUri": ...}`) and the
  flat key (`"ui/resourceUri": ...`) — the qr-server reference pattern. Dropping
  either key breaks widget attachment in some Claude Desktop versions.

### Step 4 — Add a `@mcp.resource` handler in `recce/widget_server.py`

```python
@mcp.resource(
    uri="ui://recce/<tool>.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,  # widget manages its own padding/border
        },
    },
)
def <tool>_resource() -> str:
    return _read_widget_html("<tool>")
```

`mime_type="text/html;profile=mcp-app"` is required — it tells Claude Desktop
this resource is a widget panel, not a document. `resourceDomains` in the CSP
`meta` must list every external origin the HTML loads: at minimum `https://unpkg.com`
for the SDK, plus any chart libraries or CDN assets.

### Step 5 — Extract a helper if the existing tool response shape doesn't fit

If `_tool_<tool>` in `mcp_server.py` returns a shape that the widget HTML
cannot render (e.g., a flat `DataFrame.model_dump()` dict), extract a shared
computation helper:

```python
# In recce/mcp_server.py, inside RecceMCPServer:
def _compute_<tool>_data(self, lineage_diff, **kwargs) -> Dict[str, Any]:
    """Return rich nested dict for widget consumption."""
    ...

async def _tool_<tool>(self, arguments) -> ...:
    """Existing method — must NOT change its return type."""
    rich = self._compute_<tool>_data(...)
    # flatten to existing format:
    return DataFrame.from_data(rich).model_dump()
```

The widget delegate in `widget_server.py` calls `_compute_<tool>_data` directly.
The existing `_tool_<tool>` calls the same helper then flattens — preserving
the existing `mcp-server` response contract exactly. See `_compute_schema_changes`
as the worked example.

### Step 6 — Restart Claude Desktop and verify

1. Quit Claude Desktop fully (Cmd+Q).
2. Reopen. Both MCP server entries will restart.
3. Ask Claude: "Run <tool> and show me the widget."
4. You should see the HTML panel render inline in the chat.

---

## structuredContent Contract

When a `@mcp.tool` handler returns a `CallToolResult` explicitly, it controls
exactly what goes into `content` (for non-widget MCP clients) and
`structuredContent` (for widget-capable clients like Claude Desktop):

```python
return CallToolResult(
    content=[TextContent(type="text", text="Tool rendered in widget.")],
    structuredContent=output.model_dump(),   # Pydantic BaseModel → clean dict
)
```

- `content`: a short one-sentence string the agent reads. Never a JSON dump of
  the full data — that would cause the agent to re-render the data as a text
  table ("dual-render"), defeating the widget.
- `structuredContent`: the Pydantic output model dumped to a dict. Widget HTML
  reads this in the `app.ontoolresult` callback.

The widget HTML receives `structuredContent` directly:

```js
app.ontoolresult = ({ structuredContent }) => {
  const models = structuredContent?.models ?? {};
  // render models
};
```

This codebase always puts model data under a `models` key in the Pydantic output
model. This keeps all widget HTML uniform — every widget reads from
`structuredContent.models`, regardless of the underlying tool's native shape.

**Why Pydantic models, not bare `Dict[str, Any]`:** FastMCP wraps bare `Dict`
returns in a `{result: ...}` envelope at the protocol level. Pydantic return
types (or explicit `CallToolResult`) bypass this and emit the clean dict shape
directly. Always use Pydantic models for widget tool outputs.

---

## Gotchas

- **SDK version — pin `@modelcontextprotocol/ext-apps@0.4.0/app-with-deps`.**
  Version 1.7.2 was tested in the Day 0 spike and found incompatible. Do not
  float the version or use `@latest`.

- **`@mcp.tool` input must be a Pydantic BaseModel — never bare `**kwargs` or
  bare typed params.** Using a Pydantic input model gives each parameter a
  `description` field in the JSON `inputSchema`, which improves LLM tool
  selection. FastMCP generates `inputSchema` from the Pydantic model schema.
  Without a schema, Claude Desktop registers the tool in `tools/list` but
  cannot construct a `tools/call` — the tool appears available but is silently
  uncallable.

- **`@mcp.tool` output must be a Pydantic BaseModel or explicit `CallToolResult`
  — never bare `Dict[str, Any]`.** FastMCP wraps bare `Dict` returns in a
  `{result: ...}` envelope at the protocol level. Pydantic return types or
  explicit `CallToolResult` bypass this and emit the clean dict shape. Widget
  JS reads `structuredContent.models`; if `{result: ...}` wrapping is present,
  the widget sees an empty `models` key and renders "No models found."

- **`@mcp.tool` meta needs both key forms.** The `meta` dict must contain:
  - `"ui": {"resourceUri": "ui://recce/<tool>.html"}` (nested, canonical)
  - `"ui/resourceUri": "ui://recce/<tool>.html"` (flat, legacy)
  Both are required. Dropping the flat key breaks widget attachment in some
  Claude Desktop versions (observed in qr-server reference implementation).

- **`mcp.run(transport="stdio")` is synchronous — do NOT wrap in
  `asyncio.run()`.** `mcp.run()` manages its own asyncio event loop internally.
  Wrapping it raises `ValueError: a coroutine was expected, got None` (fixed in
  Day 1 cycle 1; see commit `bb6f1261`).

- **`recce/data/` is gitignored as build output.** `.gitignore` ignores the
  directory contents (`recce/data/**`) and then re-includes the source subdir
  via negation (`!recce/data/mcp/`, `!recce/data/mcp/**`). Any file type you add
  under `recce/data/mcp/` (`.css`, `.svg`, `.js`, …) is tracked automatically —
  no per-extension allowlist to maintain. Files placed elsewhere under
  `recce/data/` remain ignored as build output.

- **In stdio transport mode, stdout is JSON-RPC.** Any `print()` or
  `logging.info()` output written to stdout will corrupt the MCP framing.
  Configure logging to write to `stderr` only (see `logging.basicConfig(stream=sys.stderr)`
  in `run_widget_server()`). Never add bare `print()` calls in `widget_server.py`.

- **No-arg tools: omit the `args` parameter entirely.** If the underlying MCP
  tool takes no arguments (e.g. `get_server_info`), define the widget delegate
  as `async def get_server_info() -> CallToolResult:` with no `args` parameter.
  FastMCP generates an empty `inputSchema` automatically. Do NOT add a dummy
  `args: None` or empty-model arg — it generates a confusing schema that
  Claude Desktop may mis-render.

- **Watch out for Pydantic reserved field names.** `schema` and any field
  starting with `model_` are reserved in Pydantic v2. If the raw handler
  response uses one of these keys (e.g. a `schema` field for the DB schema
  name), either rename the Pydantic field and use `Field(alias="schema")` with
  `model_config = {"populate_by_name": True}`, or normalise the key in the
  widget delegate before passing to the Pydantic model.  `get_model`'s
  `_parse_model_env` helper is a worked example: the raw `columns` dict is
  normalised to a typed list before constructing `ModelEnvironment`.

- **CSS token naming: use `danger`, not `error`.** The MCP Apps spec enum
  `McpUiStyleVariableKey` uses `--color-text-danger` and
  `--color-background-danger`. There is no `--color-text-error` token — using
  it in a `var()` fallback chain causes the CSS fallback to fire even when the
  host provides design tokens.

---

## Python vs TypeScript SDK Support

The `@modelcontextprotocol/ext-apps` package provides TypeScript SDK
helpers (`registerAppTool`, `registerAppResource`, etc.) but no
dedicated Python package. Python servers use the base `mcp` SDK
(`FastMCP`) and manually wire the MCP Apps wire shape via
`@mcp.tool(meta={"ui": {"resourceUri": "..."}})` and
`@mcp.resource(mime_type="text/html;profile=mcp-app", meta={"ui": {...}})`.

The qr-server example in the official ext-apps examples directory is
the canonical Python reference for MCP Apps server-side patterns:
https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/qr-server

Widget HTML JS-side helpers (`applyDocumentTheme`,
`applyHostStyleVariables`, `applyHostFonts`, `App` class) ARE available
to Python servers — they live in `@modelcontextprotocol/ext-apps@0.4.0`
loaded into the widget iframe via unpkg CDN. They work regardless of
which server language emits the JSON-RPC.

Recce stays on Python because (1) `recce/mcp_server.py` is 3000+ LOC
of Python with deep dbt integration, switching languages for widget
ergonomics is poor ROI, and (2) qr-server proves the Python path is
documented and supported. Reconsider if ext-apps publishes a Python SDK.

---

## Reference Widgets

Eight working examples (in order of implementation):

| File | Tier | What it demonstrates |
|------|------|----------------------|
| `recce/data/mcp/row_count_diff.html` | Status pills + diff numbers | Per-model status badges (`ok`, `table_not_found`, etc.), signed diff display, `base_meta`/`curr_meta` shape |
| `recce/data/mcp/schema_diff.html` | HTML table | Added/removed/type_changed column grouping, `_compute_schema_changes` rich shape, per-model section headers |
| `recce/data/mcp/get_server_info.html` | Status badge + key/value grid | **Canonical post-refactor example.** Born idiomatic: no `models` wrapper (tool has no per-model loop), optional `git`/`pull_request` nested objects, 2-column CSS grid layout, empty-state card when `mode="none"` |
| `recce/data/mcp/list_checks.html` | List / simple table | 3-up summary cards (Total / Approved / Pending), 4-column status table, empty-state with hint, `is_preset` badge, `_tool_list_checks` returns a flat list + pre-computed `total`/`approved` — `pending` derived in the widget delegate |
| `recce/data/mcp/get_model.html` | Single-item detail card | Per-environment column tables (base/current), adaptive 2-col/3-col layout when constraints present, PK + not-null + unique badges, not-found empty state, `columns` dict → list normalisation in delegate |
| `recce/data/mcp/query.html` | **Tier-3 data table** | **Template for Phase B.** Sticky-header scrollable table (400px cap), type-aware cell rendering, truncation badge, empty/error states. Use this as the base pattern for `query_diff`, `value_diff`, `value_diff_detail`, `top_k_diff` |
| `recce/data/mcp/query_diff.html` | **Tier-3 two-env comparison** | Two render modes: side-by-side (no primary_keys → base/current tables) and join-diff (primary_keys → single table with status pills + Added/Removed filter buttons). Row tinting (red=removed, green=added), `in_a`/`in_b` columns stripped from display. |
| `recce/data/mcp/top_k_diff.html` | **Tier-3 side-by-side ranked lists** | Two-column grid (Base / Current) with ranked entries, inline bars, rank-change arrows (↑↓), and New/Gone badges for env-exclusive categories. Union of categories shown for both sides; count=0 entries denote absent categories. |
| `recce/data/mcp/histogram_diff.html` | **Tier-4 SVG bar chart** | **First chart widget.** Hand-rolled SVG (no external chart library). Base bars (blue, semi-transparent) overlaid with current bars (green) per bin. viewBox-scaled for responsiveness. Hover tooltip shows bin range + both counts. x-axis label density auto-reduced for dense bins. See "Tier-4 (Chart) Widget Architecture" below. |
| `recce/data/mcp/profile_diff.html` | **Tier-4 per-column profile card grid** | **Phase C complete.** Per-column statistical profile comparison. ProfileDiffResult base/current DataFrames merged by column_name into card grid. Stats: row_count, not_null_proportion, distinct_count, distinct_proportion, min/max (string, SQL-cast), avg, median. Delta chips (+N, -N) for numeric changes; proportions shown as percentages with pp delta. Columns absent from one env still shown (base or current is null). No sparklines — task returns no per-bin data. |

`get_server_info` is the **recommended canonical example** for new widgets
because it was written after the idiomatic pattern was established (Day 3
refactor). It uses all idioms correctly from the start:
- Pydantic `ServerInfoOutput` with `Optional` nested sub-models (`GitInfo`,
  `PullRequestInfo`) rather than bare `Dict[str, Any]`
- `CallToolResult` with one-sentence `content` + `structuredContent`
- No-arg tool (no input model needed — omit the `args` param entirely)
- `@mcp.resource` + `mime_type="text/html;profile=mcp-app"` with CSP
- Exhaustive `@media (prefers-color-scheme: dark)` covering every CSS class

All three files are self-contained HTML — no build step, no npm dependency.
They import the SDK at runtime from unpkg. Open any file in a browser to
verify rendering without running a full MCP server.

---

## Adding a Tier-3 (Data Table) Widget

Phase B widgets (`query`, `query_diff`, `value_diff`, `value_diff_detail`, `top_k_diff`)
render arbitrary columnar data. `recce/data/mcp/query.html` is the canonical example.

**Phase B table layout retrospective (iter 1):** All five Phase B widgets hand-rolled
their own table/list layout because the data shapes diverged enough that a shared
`<recce-table>` component would have needed extreme flexibility: `query` is a plain
scrollable table; `query_diff` is two tables OR one flagged table; `value_diff` is a
stat-card grid + match-bar table; `value_diff_detail` is a sticky-left filtered row
table; `top_k_diff` is a side-by-side ranked-list grid with badges and inline bars.
A shared component would have handled all five only by accepting almost all rendering
decisions as parameters — essentially the same work. In iter 2, evaluate whether
extracting a `renderRankedList()` JS helper function (shared between `top_k_diff` and
any future histogram-bar widget) is worth the coordination cost. A full `<recce-table>`
abstraction is not recommended until at least 3 widgets converge on the same layout.

### Data shape

The underlying `DataFrame.model_dump(mode='json')` has this exact shape (confirmed from
`recce/tasks/dataframe.py`):

```json
{
  "columns": [
    {"key": "id", "name": "id", "type": "integer"},
    {"key": "amount", "name": "amount", "type": "number"},
    {"key": "label", "name": "label", "type": "text"}
  ],
  "data": [[1, 99.9, "Alice"], [2, null, null]],
  "limit": 2000,
  "more": false,
  "total_row_count": 2
}
```

`DataFrameColumnType` enum values: `"integer"`, `"number"`, `"text"`, `"boolean"`,
`"date"`, `"datetime"`, `"timedelta"`, `"unknown"`.

### Pydantic models

```python
class QueryColumnInfo(BaseModel):
    key: Optional[str] = None
    name: str
    type: str  # DataFrameColumnType enum value

class QueryOutput(BaseModel):
    columns: List[QueryColumnInfo]
    data: List[List[Any]]
    limit: Optional[int] = None
    more: Optional[bool] = None
    total_row_count: Optional[int] = None
    sql_template: Optional[str] = None  # echo input for context
```

### CSS mechanics for sticky-header scrollable table

```css
/* Container caps height and scrolls in both axes */
.table-wrap {
  max-height: 400px;
  overflow: auto;
  border: 1px solid var(--color-border-primary, #e5e7eb);
  border-radius: var(--border-radius-md, 8px);
}
/* Table sticky header works inside overflow:auto parent */
.result-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
}
```

This combination — `overflow: auto` on the container, `position: sticky; top: 0`
on `thead th` — is the pattern to use for all tier-3 table widgets. Do NOT use
`overflow: hidden` on the container (breaks scroll) or `position: fixed` on the
header (breaks column alignment).

### `renderCell(value, type)` helper — canonical implementation

```js
function renderCell(value, type) {
  if (value === null || value === undefined)
    return `<span class="cell-null">—</span>`;
  if (type === "boolean" || typeof value === "boolean")
    return value ? `<span class="cell-bool-true">✓</span>` : `<span class="cell-bool-false">—</span>`;
  if (type === "integer" || type === "number") {
    const formatted = typeof value === "number"
      ? value.toLocaleString(undefined, { maximumFractionDigits: 6 })
      : escapeHtml(String(value));
    return `<span class="cell-num">${formatted}</span>`;
  }
  if (type === "date" || type === "datetime" || type === "timedelta")
    return `<span title="${escapeHtml(String(value))}">${escapeHtml(String(value))}</span>`;
  // Text / unknown — truncate at 80 chars
  const str = String(value);
  if (str.length > 80)
    return `<span title="${escapeHtml(str)}">${escapeHtml(str.slice(0, 80))}…</span>`;
  return escapeHtml(str);
}
```

CSS classes used: `.cell-null` (italic, secondary color), `.cell-num` (tabular-nums,
mono, right-aligned), `.cell-bool-true` (green), `.cell-bool-false` (gray).
All four classes need exhaustive `@media (prefers-color-scheme: dark)` overrides.

### Truncation badge

When `more === true`, show a warning badge above the table:

```js
const truncatedBadge = more
  ? `<span class="badge-truncated">Truncated to ${limit ?? nRows} rows</span>`
  : "";
```

### `openWorldHint` for warehouse-hitting tools

Tools that execute SQL against the warehouse (all tier-3 tools) must set
`openWorldHint: True` in annotations — they perform real external I/O.
This contrasts with Phase A tools that only read dbt manifest/state:

```python
@mcp.tool(
    name="query",
    annotations={
        ...
        "openWorldHint": True,   # hits the warehouse
    },
    ...
)
```

---

## Tier-4 (Chart) Widget Architecture

Phase C introduces chart-tier widgets. The first is `histogram_diff`. Iter 1 uses **hand-rolled SVG bars** — no external chart library. This was a deliberate architectural decision:

### Why hand-rolled SVG (not Chart.js / Vega-Lite / D3)?

1. **CSP constraint** — `resourceDomains` in the `@mcp.resource` meta is currently `["https://unpkg.com"]`. Adding a chart CDN (e.g. `cdn.jsdelivr.net`, `cdn.skypack.dev`) requires validation against MCP Apps' content security policy sandbox. Avoiding a new CDN keeps CSP unchanged.
2. **No library lock-in** — iter 1 widgets are deliberately minimal. Committing to Chart.js shapes the data contract and HTML rendering for all future chart widgets. Hand-rolled SVG defers that commitment.
3. **Bundle size** — the widget HTML is self-contained (no npm, no build step). Chart.js alone is ~200KB. For a simple bar chart, the trade-off favours SVG primitives.

### Hand-rolled SVG pattern (`histogram_diff.html`)

- Single `<svg viewBox="0 0 600 180">` — responsive via `width: 100%` on the SVG element.
- Y-axis: 4 evenly-spaced ticks with grid lines; count labels right-justified.
- X-axis: bin labels rotated 35° to avoid overlap; only every Nth label shown when bins > 10.
- Bars: `<rect class="bar-base">` (blue, 45% opacity) behind `<rect class="bar-curr">` (green, 70% opacity). Overlay layout — same x-position, tallest bar visible.
- Hover tooltip: a transparent `<rect>` overlay per bin triggers `mousemove` on the SVG; tooltip positioned relative to the containing `chart-wrap` div.
- Dark mode: `@media (prefers-color-scheme: dark)` overrides all SVG class fill colors and CSS token fallbacks exhaustively.

### Phase C retrospective — hand-roll SVG verdict

Phase C shipped two chart widgets (`histogram_diff` and `profile_diff`) using hand-rolled SVG or plain CSS grid layouts. Neither required an external chart library. Key findings:

- `histogram_diff`: SVG `<rect>` bars with viewBox scaling worked well for the overlaid base/current histogram. The hover tooltip and x-axis label density auto-reduction added ~80 lines of JS but no library dependency.
- `profile_diff`: Profile data is tabular (one row per column × one column per stat). A CSS grid card layout was more appropriate than SVG. No mini sparklines — `ProfileDiffTask` returns aggregate stats per column only, no per-bin data.
- **CSP stayed at single unpkg origin** throughout Phase C. Both widgets load only `@modelcontextprotocol/ext-apps@0.4.0` from unpkg.
- All 12 widgets so far use Claude design tokens (`var(--token, fallback)`) and exhaustive `@media (prefers-color-scheme: dark)` overrides. Pydantic models + `CallToolResult` with explicit `structuredContent` is the established pattern.

### When to upgrade to a real chart library (iter 2 considerations)

Consider Chart.js or Vega-Lite for future chart widgets when:
- Log-scale y-axis is needed (hand-rolled requires manual tick calculation)
- Interactive zoom/pan is required
- Multiple series with automatic legend management
- The chart type is complex (scatter, violin, heatmap)

**Trigger threshold exceeded**: 13/20 widgets (65%) now use the hand-roll SVG + Pydantic pattern. If iter 2 introduces charts requiring stacked bars, line charts, or heatmaps, evaluate adopting Chart.js or Vega-Lite. Add the chosen CDN to `resourceDomains` in **all** widget `@mcp.resource` registrations (the list is per-server, shared). Validate with MCP Apps' CSP sandbox before shipping.

---

## Tier-5 Widget Architecture (Mini Graphs)

Phase D introduces the first tier-5 (mini graph) widget: `get_cll`. Unlike tier-4
chart widgets that render bars/grids, tier-5 widgets render interactive graph diagrams
as hand-rolled SVGs with layout algorithms.

### `get_cll` — Column-Level Lineage DAG

`get_cll` reads `CllData` from the dbt adapter and renders it as a layered SVG DAG.
The actual `CllData` shape (from `recce/models/types.py`) uses:
- `nodes`: `Dict[str, CllNode]` — keyed by node_id; each node contains `columns: Dict[str, CllColumn]`
- `columns`: flat `Dict[str, CllColumn]` — keyed by `"{node_id}_{column_name}"` (aggregate index)
- `parent_map`: `Dict[str, Set[str]]` — child key → set of parent keys (edges)
- `child_map`: `Dict[str, Set[str]]` — parent key → set of child keys

`CllColumn.depends_on` is a list of `CllColumnDep(node, column)` — these are the column-to-column
dependency edges used for bezier curve rendering between card rows.

### Layout algorithm (simplified Sugiyama)

1. BFS from the target node, assigning layers: target = 0, upstream = -N, downstream = +N.
2. Shift layers so min = 0 (left = most upstream).
3. Within each layer, sort nodes alphabetically by name and stack vertically.
4. Card width = 200px, column row height = 22px. Card height = header (32px) + N × 22px + 6px padding.
5. Layer gap = 80px horizontal. Node gap = 20px vertical.
6. SVG viewBox computed from total extent; `overflow-x: auto` on wrapper div for wide graphs.

### Bezier edge routing

For each column's `depends_on` entry, draw a cubic bezier from:
- Source: `right-edge` of source node card, at the y-center of the source column row.
- Target: `left-edge` of target node card, at the y-center of the target column row.
- Control points: `dx = (target_x - source_x) * 0.45` horizontal offset; same y as endpoints.

This creates smooth S-curves without requiring a graph library.

### Complexity bail-out

If `node_count > 12` OR `edge_count > 30`, the widget skips the SVG layout and renders
a text summary card listing all node names with a hint to use the Recce web app for the
full interactive DAG. The `node_count` and `edge_count` fields are pre-computed in the
Python delegate (`GetCllOutput`) so the widget doesn't need to recompute them.

### `openWorldHint=False` for `get_cll`

`get_cll` reads the dbt manifest (local files) — it never hits the warehouse. This
contrasts with all tier-3 tools (`query`, `query_diff`, `value_diff`, etc.) which
set `openWorldHint=True`. Adding it to the `closed_world_tools` assertion in
`test_widget_server.py` enforces this distinction.

### `impact_analysis` — Model-Level Blast Radius

`impact_analysis` runs warehouse queries (row_count_diff + value_diff SQL) against
non-view models with a primary key. It renders:

1. **Header** — explosion icon, "Impact analysis" title, impacted model count badge.
2. **Summary bar** — confirmed / potential / clean counts + max affected rows.
3. **SVG mini-DAG** (up to 15 models) — 2-layer layout: modified models left, downstream right.
   Each model card shows impact badge (CONFIRMED/POTENTIAL/CLEAN), row-count delta chip,
   and next-action hint. Bezier edges connect every modified node to every downstream node.
4. **"What to investigate next"** — actionable list of `next_action` items grouped by
   priority (high / medium / low). Only models with `data_impact='potential'` have
   `next_action`; confirmed and clean models need no follow-up.

Bail-out at >15 models: skip SVG, show summary counts + actionable list only.

`openWorldHint=True` — runs warehouse SQL (unlike `get_cll` which is manifest-only).

### `openWorldHint` for impact_analysis

`impact_analysis` queries the warehouse for row counts and value diffs, so it is added to
the open-world group (alongside `query`, `profile_diff`, etc.). It is NOT in
`closed_world_tools`. See the annotations assertion in `test_widget_server.py`.

### Iter 2 considerations for mini-graph widgets

- **Cytoscape.js or D3** for larger graphs (>15 models / >12 nodes): adds a CDN dependency
  but enables interactive pan/zoom, auto-layout (Dagre), and click-to-focus interactions.
- **Depth limiting** instead of hard bail-out: show only N hops upstream/downstream.
- **Column filter** (get_cll): highlight only the requested column's lineage path.
- **Cross-environment diff overlay**: show base vs current columns side-by-side in the card.
- **`impact_analysis` edge routing**: current bail-out uses full modified×downstream matrix.
  Iter 2 should use actual DAG parent/child links from lineage_diff to draw only real edges.

---

## What Is NOT in Iter 1

These are deferred to iter 2 or later:

- **Advanced chart interactions** — log-scale toggle, zoom/pan, downloadable PNG. The `histogram_diff` widget provides the canonical SVG bar pattern; iter 2 can wrap it in a chart library if these are needed.
- **Cloud/session mode** — `recce mcp-widget-server` raises immediately if
  `--cloud` or `--session` kwargs are passed. Cloud support requires state-loader
  plumbing not attempted in iter 1.
- **`lineage_diff` widget** — the lineage graph is a Dagre/React component in
  `@datarecce/ui`. Serving it as a self-contained widget HTML requires either
  a CDN build or embedding the compiled JS inline. Not attempted in iter 1.
- **CDN distribution of widget HTML** — iter 1 bundles HTML inside the Python
  package (`recce/data/mcp/`). A CDN path (e.g., from a GitHub release asset)
  would allow widget updates without a Recce release. Deferred.
- **`_widgets_enabled()` parity in `recce-cloud`** — the cloud-infra MCP server
  has its own `list_tools` implementation. Widget coordination there requires a
  separate integration pass.
