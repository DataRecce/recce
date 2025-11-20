"""
Recce MCP (Model Context Protocol) Server

This module implements a stdio-based MCP server that provides tools for
interacting with Recce's data validation capabilities.
"""

import asyncio
import json
import logging
import os
import textwrap
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from recce.core import RecceContext, load_context
from recce.server import RecceServerMode
from recce.tasks.dataframe import DataFrame
from recce.tasks.profile import ProfileDiffTask
from recce.tasks.query import QueryDiffTask, QueryTask
from recce.tasks.rowcount import RowCountDiffTask

logger = logging.getLogger(__name__)


def _truncate_strings(obj: Any, max_length: int = 200) -> Any:
    """Recursively truncate strings longer than max_length in nested dicts and lists"""
    if isinstance(obj, dict):
        return {k: _truncate_strings(v, max_length) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_truncate_strings(item, max_length) for item in obj]
    elif isinstance(obj, str) and len(obj) > max_length:
        return obj[:max_length] + "..."
    return obj


class MCPLogger:
    """JSON logger for MCP server request/response logging"""

    def __init__(self, debug: bool = False, log_file: str = "logs/recce-mcp.json"):
        self.debug = debug
        self.log_file = log_file

        if self.debug:
            # Create logs directory if it doesn't exist
            log_dir = os.path.dirname(log_file)
            if log_dir:
                os.makedirs(log_dir, exist_ok=True)

            # Overwrite log file on initialization
            try:
                with open(log_file, "w") as f:
                    f.write("")  # Clear existing content
            except Exception as e:
                logger.warning(f"Failed to initialize log file {log_file}: {e}")

    def _write_log(self, log_entry: Dict[str, Any]) -> None:
        """Write a log entry to the JSON file"""
        if not self.debug:
            return

        try:
            with open(self.log_file, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            logger.warning(f"Failed to write to log file {self.log_file}: {e}")

    def log_list_tools(self, tools: List[Tool]) -> None:
        """Log a list_tools call"""
        tool_names = [tool.name for tool in tools]
        log_entry = {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "type": "list_tools",
            "tools": tool_names,
        }
        self._write_log(log_entry)

    def log_tool_call(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        response: Dict[str, Any],
        duration_ms: float,
        error: Optional[str] = None,
    ) -> None:
        """Log a tool call with request and response"""
        log_entry = {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "type": "call_tool",
            "tool": tool_name,
            "request": arguments,
            "duration_ms": round(duration_ms, 2),
        }

        if error:
            log_entry["error"] = error
        else:
            log_entry["response"] = _truncate_strings(response)

        self._write_log(log_entry)


class RecceMCPServer:
    """MCP Server for Recce data validation tools"""

    def __init__(
        self,
        context: RecceContext,
        mode: Optional[RecceServerMode] = None,
        debug: bool = False,
        log_file: str = "logs/recce-mcp.json",
    ):
        self.context = context
        self.mode = mode or RecceServerMode.server
        self.server = Server("recce")
        self.mcp_logger = MCPLogger(debug=debug, log_file=log_file)
        self._setup_handlers()

    def _setup_handlers(self):
        """Register all tool handlers"""

        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            """List all available tools based on server mode"""
            logger.info(f"[MCP] list_tools called (mode: {self.mode.value if self.mode else 'server'})")
            tools = []

            # Always available in all modes
            tools.append(
                Tool(
                    name="lineage_diff",
                    description=textwrap.dedent(
                        """
                        Get the lineage diff between production(base) and session(current) for changed models.
                        Returns nodes, parent_map (node dependencies), and change_status/impacted information in compact dataframe format.

                        In parent_map: key is a node index, value is list of parent node indices
                        Nodes dataframe includes: idx, id, name, resource_type, materialized, change_status, impacted.

                        Rendering guidance for Mermaid diagram:
                        Use graph LR and apply these styles based on change_status and impacted:
                        - change_status="added": fill:#d4edda, stroke:#28a745, color:#000000
                        - change_status="removed": fill:#f8d7da, stroke:#dc3545, color:#000000
                        - change_status="modified" AND impacted=true: fill:#fff3cd, stroke:#ffc107, color:#000000
                        - change_status=null AND impacted=true: fill:#ffffff, stroke:#ffc107, color:#000000
                        - change_status=null AND impacted=false: fill:#ffffff, stroke:#d3d3d3, color:#999999
                    """
                    ).strip(),
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "select": {
                                "type": "string",
                                "description": "dbt selector syntax to filter models (optional)",
                            },
                            "exclude": {
                                "type": "string",
                                "description": "dbt selector syntax to exclude models (optional)",
                            },
                            "packages": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of packages to filter (optional)",
                            },
                            "view_mode": {
                                "type": "string",
                                "enum": ["changed_models", "all"],
                                "default": "changed_models",
                                "description": "View mode: 'changed_models' for only changed models (default), 'all' for all models",
                            },
                        },
                    },
                )
            )
            tools.append(
                Tool(
                    name="schema_diff",
                    description="Get the schema diff (column changes) between base and current environments. "
                    "Shows added, removed, and type-changed columns in compact dataframe format.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "select": {
                                "type": "string",
                                "description": "dbt selector syntax to filter models (optional)",
                            },
                            "exclude": {
                                "type": "string",
                                "description": "dbt selector syntax to exclude models (optional)",
                            },
                            "packages": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of packages to filter (optional)",
                            },
                        },
                    },
                )
            )

            # Diff tools only available in server mode, not in preview or read-only mode
            if self.mode == RecceServerMode.server:
                tools.extend(
                    [
                        Tool(
                            name="row_count_diff",
                            description="Compare row counts between base and current environments for specified models.",
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "node_names": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "List of model names to check row counts (optional)",
                                    },
                                    "node_ids": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "List of node IDs to check row counts (optional)",
                                    },
                                    "select": {
                                        "type": "string",
                                        "description": "dbt selector syntax to filter models (optional)",
                                    },
                                    "exclude": {
                                        "type": "string",
                                        "description": "dbt selector syntax to exclude models (optional)",
                                    },
                                },
                            },
                        ),
                        Tool(
                            name="query",
                            description="Execute a SQL query on the current environment. "
                            "Supports Jinja templates with dbt macros like {{ ref('model_name') }}.",
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "sql_template": {
                                        "type": "string",
                                        "description": "SQL query template with optional Jinja syntax",
                                    },
                                    "base": {
                                        "type": "boolean",
                                        "description": "Whether to run on base environment (default: false)",
                                        "default": False,
                                    },
                                },
                                "required": ["sql_template"],
                            },
                        ),
                        Tool(
                            name="query_diff",
                            description="Execute SQL queries on both base and current environments and compare results. "
                            "Supports primary keys for row-level comparison.",
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "sql_template": {
                                        "type": "string",
                                        "description": "SQL query template for current environment",
                                    },
                                    "base_sql_template": {
                                        "type": "string",
                                        "description": "SQL query template for base environment (optional, defaults to sql_template)",
                                    },
                                    "primary_keys": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "List of primary key columns for row comparison (optional)",
                                    },
                                },
                                "required": ["sql_template"],
                            },
                        ),
                        Tool(
                            name="profile_diff",
                            description="Generate and compare statistical profiles (min, max, avg, distinct count, etc.) "
                            "for columns in a model between base and current environments.",
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "model": {
                                        "type": "string",
                                        "description": "Model name to profile",
                                    },
                                    "columns": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "List of column names to profile (optional, profiles all columns if not specified)",
                                    },
                                },
                                "required": ["model"],
                            },
                        ),
                    ]
                )

            self.mcp_logger.log_list_tools(tools)

            # Log available tools to console
            tool_names = [tool.name for tool in tools]
            logger.info(f"[MCP] Returning {len(tools)} tools: {', '.join(tool_names)}")

            return tools

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Handle tool calls"""
            start_time = time.perf_counter()

            # Log incoming request
            logger.info(f"[MCP] Tool call received: {name}")
            logger.info(f"[MCP] Arguments: {json.dumps(arguments, indent=2)}")

            try:
                # Check if tool is blocked in non-server mode
                blocked_tools_in_non_server = {"row_count_diff", "query", "query_diff", "profile_diff"}
                if self.mode != RecceServerMode.server and name in blocked_tools_in_non_server:
                    raise ValueError(
                        f"Tool '{name}' is not available in {self.mode.value} mode. "
                        "Only 'lineage_diff' and 'schema_diff' are available in this mode."
                    )

                if name == "lineage_diff":
                    result = await self._tool_lineage_diff(arguments)
                elif name == "schema_diff":
                    result = await self._tool_schema_diff(arguments)
                elif name == "row_count_diff":
                    result = await self._tool_row_count_diff(arguments)
                elif name == "query":
                    result = await self._tool_query(arguments)
                elif name == "query_diff":
                    result = await self._tool_query_diff(arguments)
                elif name == "profile_diff":
                    result = await self._tool_profile_diff(arguments)
                else:
                    raise ValueError(f"Unknown tool: {name}")

                duration_ms = (time.perf_counter() - start_time) * 1000
                self.mcp_logger.log_tool_call(name, arguments, result, duration_ms)

                # Log outgoing response
                response_json = json.dumps(result, indent=2)
                logger.info(f"[MCP] Tool response for {name} ({duration_ms:.2f}ms):")
                # Truncate large responses for console readability
                if len(response_json) > 1000:
                    logger.debug(f"[MCP] {response_json[:1000]}... (truncated, {len(response_json)} chars total)")
                else:
                    logger.debug(f"[MCP] {response_json}")

                return [TextContent(type="text", text=response_json)]
            except Exception as e:
                duration_ms = (time.perf_counter() - start_time) * 1000
                self.mcp_logger.log_tool_call(name, arguments, {}, duration_ms, error=str(e))
                logger.error(f"[MCP] Error executing tool {name} ({duration_ms:.2f}ms): {str(e)}")
                logger.exception("[MCP] Full traceback:")
                error_response = json.dumps({"error": str(e)}, indent=2)
                return [TextContent(type="text", text=error_response)]

    async def _tool_lineage_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Get lineage diff between base and current"""
        try:
            # Extract filter arguments
            select = arguments.get("select")
            exclude = arguments.get("exclude")
            packages = arguments.get("packages")
            view_mode = arguments.get("view_mode", "changed_models")

            # Get lineage diff from adapter (returns a Pydantic LineageDiff model)
            lineage_diff = self.context.get_lineage_diff().model_dump(mode="json")

            # Apply node selection filtering if arguments provided
            selected_node_ids = self.context.adapter.select_nodes(
                select=select,
                exclude=exclude,
                packages=packages,
                view_mode=view_mode,
            )
            impacted_node_ids = self.context.adapter.select_nodes(
                select="state:modified+",
            )

            # Get diff information for change_status
            diff_info = lineage_diff.get("diff", {})

            # Extract parent_map and simplified nodes from both base and current
            parent_map = {}
            nodes = {}

            # Merge parent_map and nodes: base first, then current overrides
            for env_key in ["base", "current"]:
                if env_key not in lineage_diff:
                    continue

                env_data = lineage_diff[env_key]

                # Merge parent_map (filtering by selected nodes)
                if "parent_map" in env_data:
                    for node_id, parents in env_data["parent_map"].items():
                        if node_id in selected_node_ids:
                            parent_map[node_id] = parents

                # Merge nodes (filtering by selected nodes)
                if "nodes" in env_data:
                    for node_id, node_info in env_data["nodes"].items():
                        if node_id in selected_node_ids:
                            nodes[node_id] = {
                                "name": node_info.get("name"),
                                "resource_type": node_info.get("resource_type"),
                            }

                            materialized = node_info.get("config", {}).get("materialized")
                            if materialized is not None:
                                nodes[node_id]["materialized"] = materialized

            # Create id to idx mapping
            id_to_idx = {node_id: idx for idx, node_id in enumerate(nodes.keys())}

            # Prepare node data for DataFrame
            nodes_data = [
                (
                    id_to_idx[node_id],
                    node_id,
                    node_info.get("name"),
                    node_info.get("resource_type"),
                    node_info.get("materialized"),
                    diff_info.get(node_id, {}).get("change_status"),
                    node_id in impacted_node_ids,
                )
                for node_id, node_info in nodes.items()
            ]

            # Create nodes DataFrame using from_data with simple dict format
            nodes_df = DataFrame.from_data(
                columns={
                    "idx": "integer",
                    "id": "text",
                    "name": "text",
                    "resource_type": "text",
                    "materialized": "text",
                    "change_status": "text",
                    "impacted": "boolean",
                },
                data=nodes_data,
            )

            # Map parent_map IDs to indices
            parent_map_indexed = {}
            for node_id, parents in parent_map.items():
                if node_id in id_to_idx:
                    node_idx = id_to_idx[node_id]
                    parent_indices = [id_to_idx[p] for p in parents if p in id_to_idx]
                    parent_map_indexed[node_idx] = parent_indices

            # Build simplified result
            result = {"nodes": nodes_df.model_dump(mode="json"), "parent_map": parent_map_indexed}

            return result

        except Exception:
            logger.exception("Error getting lineage diff")
            raise

    async def _tool_schema_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Get schema diff (column changes) between base and current"""
        try:
            # Extract filter arguments
            select = arguments.get("select")
            exclude = arguments.get("exclude")
            packages = arguments.get("packages")

            # Get lineage diff from adapter
            lineage_diff = self.context.get_lineage_diff().model_dump(mode="json")

            # Get all nodes from current environment
            current_nodes = {}
            if "current" in lineage_diff and "nodes" in lineage_diff["current"]:
                current_nodes = lineage_diff["current"]["nodes"]

            # Filter to only nodes that exist in both base and current (exclude added nodes)
            base_nodes = lineage_diff.get("base", {}).get("nodes", {})
            nodes_to_compare = set(current_nodes.keys()) & set(base_nodes.keys())

            # Apply filtering if arguments provided
            if select or exclude or packages:
                selected_node_ids = self.context.adapter.select_nodes(
                    select=select,
                    exclude=exclude,
                    packages=packages,
                )
                nodes_to_compare = nodes_to_compare & selected_node_ids

            # Build schema changes
            schema_changes = []

            for node_id in nodes_to_compare:
                base_node = base_nodes.get(node_id, {})
                current_node = current_nodes.get(node_id, {})

                base_columns = base_node.get("columns", {})
                current_columns = current_node.get("columns", {})

                # Get column names in base and current
                base_col_names = set(base_columns.keys())
                current_col_names = set(current_columns.keys())

                # Find added columns (in current but not in base)
                for col_name in current_col_names - base_col_names:
                    schema_changes.append((node_id, col_name, "added"))

                # Find removed columns (in base but not in current)
                for col_name in base_col_names - current_col_names:
                    schema_changes.append((node_id, col_name, "removed"))

                # Find modified columns (in both but with different types)
                for col_name in base_col_names & current_col_names:
                    base_col_type = base_columns[col_name].get("type")
                    current_col_type = current_columns[col_name].get("type")
                    if base_col_type != current_col_type:
                        schema_changes.append((node_id, col_name, "modified"))

            # Check if there are more than 100 rows
            limit = 100
            has_more = len(schema_changes) > limit
            limited_schema_changes = schema_changes[:limit]

            # Convert schema changes to dataframe format using DataFrame.from_data()
            diff_df = DataFrame.from_data(
                columns={
                    "node_id": "text",
                    "column": "text",
                    "change_status": "text",
                },
                data=limited_schema_changes,
                limit=limit,
                more=has_more,
            )
            return diff_df.model_dump(mode="json")

        except Exception:
            logger.exception("Error getting schema diff")
            raise

    async def _tool_row_count_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute row count diff task"""
        try:
            task = RowCountDiffTask(params=arguments)

            # Execute task synchronously (it's already sync)
            result = await asyncio.get_event_loop().run_in_executor(None, task.execute)

            return result
        except Exception:
            logger.exception("Error executing row count diff")
            raise

    async def _tool_query(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a query"""
        try:
            sql_template = arguments.get("sql_template")
            is_base = arguments.get("base", False)

            params = {"sql_template": sql_template}
            task = QueryTask(params=params)
            task.is_base = is_base

            # Execute task
            result = await asyncio.get_event_loop().run_in_executor(None, task.execute)

            # Convert to dict if it's a model
            if hasattr(result, "model_dump"):
                return result.model_dump(mode="json")
            return result
        except Exception:
            logger.exception("Error executing query")
            raise

    async def _tool_query_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute query diff task"""
        try:
            task = QueryDiffTask(params=arguments)

            # Execute task
            result = await asyncio.get_event_loop().run_in_executor(None, task.execute)

            # Convert to dict if it's a model
            if hasattr(result, "model_dump"):
                return result.model_dump(mode="json")
            return result
        except Exception:
            logger.exception("Error executing query diff")
            raise

    async def _tool_profile_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute profile diff task"""
        try:
            task = ProfileDiffTask(params=arguments)

            # Execute task
            result = await asyncio.get_event_loop().run_in_executor(None, task.execute)

            # Convert to dict if it's a model
            if hasattr(result, "model_dump"):
                return result.model_dump(mode="json")
            return result
        except Exception:
            logger.exception("Error executing profile diff")
            raise

    async def run(self):
        """Run the MCP server in stdio mode"""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(read_stream, write_stream, self.server.create_initialization_options())

    async def run_sse(self, host: str = "localhost", port: int = 8000):
        """Run the MCP server in HTTP mode using Server-Sent Events (SSE)

        Args:
            host: Host to bind to (default: localhost)
            port: Port to bind to (default: 8000)
        """
        import uvicorn
        from mcp.server.sse import SseServerTransport
        from starlette.applications import Starlette
        from starlette.requests import Request
        from starlette.responses import Response
        from starlette.routing import Mount, Route

        # Create SSE transport - endpoint where clients POST messages
        sse = SseServerTransport("/")

        async def handle_sse_request(request: Request):
            """Handle SSE connection (GET /sse) following official MCP example"""
            client_info = f"{request.client.host}:{request.client.port}" if request.client else "unknown"
            logger.info(f"[MCP HTTP] SSE connection established from {client_info}")
            try:
                async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
                    await self.server.run(streams[0], streams[1], self.server.create_initialization_options())
            finally:
                logger.info(f"[MCP HTTP] SSE connection closed from {client_info}")
            return Response()  # Required to avoid NoneType error

        async def handle_post_message(scope, receive, send):
            """Handle POST messages (POST /) for MCP protocol"""
            # Log POST message (session_id will be in query params)
            query_string = scope.get("query_string", b"").decode("utf-8")
            logger.debug(f"[MCP HTTP] POST message received with query: {query_string}")
            await sse.handle_post_message(scope, receive, send)

        async def handle_health_check(request: Request):
            """Handle health check endpoint (GET /health)"""
            return Response(content='{"status":"ok"}', media_type="application/json")

        # Create Starlette app
        app = Starlette(
            debug=self.mcp_logger.debug,
            routes=[
                Route("/health", endpoint=handle_health_check, methods=["GET"]),
                Route("/sse", endpoint=handle_sse_request, methods=["GET"]),
                Mount("/", app=handle_post_message),
            ],
        )

        # Run with uvicorn
        logger.info(f"Starting Recce MCP Server in HTTP mode on {host}:{port}")
        logger.info(f"Connection URL: http://{host}:{port}/sse")
        config = uvicorn.Config(app, host=host, port=port, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()


async def run_mcp_server(sse: bool = False, host: str = "localhost", port: int = 8000, **kwargs):
    """
    Entry point for running the MCP server

    Args:
        sse: Whether to run in HTTP/SSE mode (default: False for stdio mode)
        host: Host to bind to in SSE mode (default: localhost)
        port: Port to bind to in SSE mode (default: 8000)
        **kwargs: Arguments for loading RecceContext (dbt options, etc.)
               Optionally includes 'mode' for server mode (server, preview, read-only)
               Optionally includes 'debug' flag for enabling MCP logging
    """
    # Setup logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

    # Load Recce context
    context = load_context(**kwargs)

    # Extract mode from kwargs (defaults to server mode)
    mode_str = kwargs.get("mode")
    mode = None
    if mode_str:
        # Convert string mode to RecceServerMode enum
        try:
            mode = RecceServerMode(mode_str)
        except ValueError:
            logger.warning(f"Invalid mode '{mode_str}', using default server mode")

    # Extract debug flag from kwargs
    debug = kwargs.get("debug", False)

    # Create MCP server
    server = RecceMCPServer(context, mode=mode, debug=debug)

    # Run in either stdio or SSE mode
    if sse:
        await server.run_sse(host=host, port=port)
    else:
        await server.run()
