"""
Recce MCP (Model Context Protocol) Server

This module implements a stdio-based MCP server that provides tools for
interacting with Recce's data validation capabilities.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from recce.core import RecceContext, load_context
from recce.tasks.profile import ProfileDiffTask
from recce.tasks.query import QueryDiffTask, QueryTask
from recce.tasks.rowcount import RowCountDiffTask

logger = logging.getLogger(__name__)


class RecceMCPServer:
    """MCP Server for Recce data validation tools"""

    def __init__(self, context: RecceContext):
        self.context = context
        self.server = Server("recce")
        self._setup_handlers()

    def _setup_handlers(self):
        """Register all tool handlers"""

        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            """List all available tools"""
            return [
                Tool(
                    name="get_lineage_diff",
                    description="Get the lineage diff between base and current environments. "
                    "Shows added, removed, and modified models.",
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
                ),
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

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Handle tool calls"""
            try:
                if name == "get_lineage_diff":
                    result = await self._get_lineage_diff(arguments)
                elif name == "row_count_diff":
                    result = await self._row_count_diff(arguments)
                elif name == "query":
                    result = await self._query(arguments)
                elif name == "query_diff":
                    result = await self._query_diff(arguments)
                elif name == "profile_diff":
                    result = await self._profile_diff(arguments)
                else:
                    raise ValueError(f"Unknown tool: {name}")

                return [TextContent(type="text", text=json.dumps(result, indent=2))]
            except Exception as e:
                logger.exception(f"Error executing tool {name}")
                return [TextContent(type="text", text=json.dumps({"error": str(e)}, indent=2))]

    async def _get_lineage_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Get lineage diff between base and current"""
        try:
            # Get lineage diff from adapter (returns a Pydantic LineageDiff model)
            lineage_diff = self.context.get_lineage_diff()
            # Convert Pydantic model to dict for JSON serialization
            return lineage_diff.model_dump(mode="json")
        except Exception:
            logger.exception("Error getting lineage diff")
            raise

    async def _row_count_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute row count diff task"""
        try:
            task = RowCountDiffTask(params=arguments)

            # Execute task synchronously (it's already sync)
            result = await asyncio.get_event_loop().run_in_executor(None, task.execute)

            return result
        except Exception:
            logger.exception("Error executing row count diff")
            raise

    async def _query(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
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

    async def _query_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
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

    async def _profile_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
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
        """Run the MCP server"""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(read_stream, write_stream, self.server.create_initialization_options())


async def run_mcp_server(**kwargs):
    """
    Entry point for running the MCP server

    Args:
        **kwargs: Arguments for loading RecceContext (dbt options, etc.)
    """
    # Setup logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

    # Load Recce context
    context = load_context(**kwargs)

    # Create and run server
    server = RecceMCPServer(context)
    await server.run()
