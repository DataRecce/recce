"""Helpers for invoking MCP handlers across mcp 1.x and 2.0.

The two SDK majors disagree on handler registration (decorators vs constructor
kwargs) and on field naming (``Tool.inputSchema`` vs ``Tool.input_schema``).
Tests go through these helpers so they read the same on both.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from mcp.types import CallToolRequestParams, TextContent, Tool


@dataclass
class ToolResult:
    """Normalised ``tools/call`` result (1.x ``isError`` / 2.0 ``is_error``)."""

    content: List[TextContent]
    isError: bool


def is_error(result) -> bool:
    """Read the error flag off a ``CallToolResult`` regardless of SDK field naming.

    Also takes results built by a real ``ClientSession``, which is why this is a free
    function rather than something only ``invoke_call_tool`` uses.
    """
    value = getattr(result, "is_error", None)
    if value is None:
        value = getattr(result, "isError", None)
    return bool(value)


async def invoke_call_tool(server, name: str, arguments: Optional[Dict[str, Any]] = None) -> ToolResult:
    """Call a tool and normalise the result, including the error case."""
    result = await server._handle_call_tool(None, CallToolRequestParams(name=name, arguments=arguments or {}))
    return ToolResult(content=list(result.content), isError=is_error(result))


async def invoke_list_tools(server) -> List[Tool]:
    """Return the advertised tools."""
    return (await server._handle_list_tools(None, None)).tools


def input_schema(tool: Tool) -> Dict[str, Any]:
    """Read a tool's JSON schema regardless of SDK field naming.

    Tested for ``None`` rather than falsiness: an empty schema would otherwise fall
    through to the attribute the other major does not have.
    """
    schema = getattr(tool, "input_schema", None)
    if schema is None:
        schema = tool.inputSchema
    return schema
