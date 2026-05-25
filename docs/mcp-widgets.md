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

Iter 1 ships three widgets: `row_count_diff`, `schema_diff`, and
`get_server_info`. All run in **local mode only** — cloud/session mode is not
supported until iter 2.

---

## File Layout

```
recce/
  mcp_server.py              # Existing primary server.
                             # WIDGET_TOOLS set + _widgets_enabled() filter live here.
  widget_server.py           # FastMCP widget server (iter 1).
                             # @mcp.tool delegates + @mcp.resource handlers.
  cli.py                     # mcp-widget-server CLI subcommand added here.
  data/
    mcp/                     # Widget HTML asset directory (gitignored via per-extension
      row_count_diff.html    # allowlist — see .gitignore). Self-contained HTML files.
      schema_diff.html
      get_server_info.html
tests/
  test_widget_server.py      # 10 tests covering WIDGET_TOOLS coordination + widget server.
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
WIDGET_TOOLS = {"row_count_diff", "schema_diff", "get_server_info", "<tool>"}
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

- **`recce/data/` is gitignored as build output.** Widget HTML files use a
  per-extension allowlist in `.gitignore` to escape the broad `recce/data`
  ignore rule. The allowlist currently covers `*.html`. If you add new file
  types (`.css`, `.svg`, `.js`) under `recce/data/mcp/`, check `.gitignore`
  and add an allowlist entry if needed; otherwise `git add` will silently skip
  your file.

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

Three working examples (in order of implementation):

| File | Tier | What it demonstrates |
|------|------|----------------------|
| `recce/data/mcp/row_count_diff.html` | Status pills + diff numbers | Per-model status badges (`ok`, `table_not_found`, etc.), signed diff display, `base_meta`/`curr_meta` shape |
| `recce/data/mcp/schema_diff.html` | HTML table | Added/removed/type_changed column grouping, `_compute_schema_changes` rich shape, per-model section headers |
| `recce/data/mcp/get_server_info.html` | Status badge + key/value grid | **Canonical post-refactor example.** Born idiomatic: no `models` wrapper (tool has no per-model loop), optional `git`/`pull_request` nested objects, 2-column CSS grid layout, empty-state card when `mode="none"` |

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

## What Is NOT in Iter 1

These are deferred to iter 2 or later:

- **Chart-tier widgets** (bar charts, histograms) — requires a charting library
  added to the CSP `resourceDomains` list and tested against MCP Apps sandbox.
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
