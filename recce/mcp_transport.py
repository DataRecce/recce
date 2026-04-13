"""
Transport adapters for the Recce MCP server.

This module hosts the wire-protocol layer for the MCP server. Tool
registration lives in recce.mcp_server.build_mcp_server(); this module
adapts that built server to one of three transports:

- attach_mcp_to_fastapi: mount Streamable HTTP + legacy SSE on a
  FastAPI app (used by `recce server`).
- run_mcp_stdio: serve over stdio (used by deprecated
  `recce mcp-server` stdio mode).
- run_mcp_sse_legacy: stand-alone Starlette app exposing the legacy
  /sse + /messages + /health paths (used by deprecated
  `recce mcp-server --sse`).

Keeping these in one focused file isolates SDK-version-sensitive
transport wiring from the much-larger tool-registration logic.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from mcp.server.stdio import stdio_server

if TYPE_CHECKING:
    from recce.mcp_server import RecceMCPServer

logger = logging.getLogger(__name__)


async def run_mcp_stdio(rmcp: "RecceMCPServer") -> None:
    """Run the MCP server over stdio.

    The stdio transport is process-attached: stdin/stdout carry the JSON-RPC
    stream. State export on shutdown happens here (no FastAPI lifespan to
    drive it).
    """
    try:
        async with stdio_server() as (read_stream, write_stream):
            await rmcp.server.run(
                read_stream,
                write_stream,
                rmcp.server.create_initialization_options(),
            )
    finally:
        if rmcp.state_loader and rmcp.context:
            try:
                from rich.console import Console

                console = Console(stderr=True)
                msg = rmcp.state_loader.export(rmcp.context.export_state())
                if msg is not None:
                    console.print(f"[yellow]On shutdown:[/yellow] {msg}")
                else:
                    state_file = getattr(rmcp.state_loader, "state_file", None)
                    if state_file:
                        console.print(f"[yellow]On shutdown:[/yellow] State exported to '{state_file}'")
                    else:
                        console.print("[yellow]On shutdown:[/yellow] State exported successfully")
            except Exception as e:
                logger.exception(f"Failed to export state on shutdown: {e}")
