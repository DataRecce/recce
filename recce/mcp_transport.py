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
    from fastapi import FastAPI
    from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
    from starlette.applications import Starlette

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
            except Exception:
                logger.exception("Failed to export state on shutdown")


def _build_legacy_sse_app(rmcp: "RecceMCPServer") -> "Starlette":
    """Build a stand-alone Starlette app exposing the legacy SSE surface.

    Routes: GET /sse, POST /messages/, GET /health.
    No REST API — this is for the deprecated `recce mcp-server --sse`
    command only. The merged `recce server` exposes its own surface
    via attach_mcp_to_fastapi().
    """
    from contextlib import asynccontextmanager

    from mcp.server.sse import SseServerTransport
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import Response
    from starlette.routing import Mount, Route

    # POST channel matches the spec-required path (old run_sse used "/" which was non-standard).
    sse = SseServerTransport("/messages/")

    async def handle_sse_asgi(scope, receive, send):
        """Raw ASGI handler — avoids touching Starlette's private Request._send."""
        if scope.get("type") != "http":
            return
        if scope.get("method") != "GET":
            await send({"type": "http.response.start", "status": 405, "headers": []})
            await send({"type": "http.response.body", "body": b""})
            return
        client = scope.get("client")
        client_info = f"{client[0]}:{client[1]}" if client else "unknown"
        logger.info(f"[MCP HTTP] SSE connection established from {client_info}")
        try:
            async with sse.connect_sse(scope, receive, send) as streams:
                await rmcp.server.run(streams[0], streams[1], rmcp.server.create_initialization_options())
        finally:
            logger.info(f"[MCP HTTP] SSE connection closed from {client_info}")

    async def handle_health_check(_request: Request):
        return Response(content='{"status":"ok"}', media_type="application/json")

    @asynccontextmanager
    async def lifespan(_app):
        yield
        # Shutdown: export state if present (matches old RecceMCPServer.run_sse)
        if rmcp.state_loader and rmcp.context:
            try:
                logger.info("Exporting state on shutdown...")
                msg = rmcp.state_loader.export(rmcp.context.export_state())
                if msg:
                    logger.info(f"State export: {msg}")
            except Exception:
                logger.exception("Failed to export state on shutdown")

    return Starlette(
        debug=rmcp.mcp_logger.debug,
        routes=[
            Route("/health", endpoint=handle_health_check, methods=["GET"]),
            Mount("/sse", app=handle_sse_asgi),
            Mount("/messages/", app=sse.handle_post_message),
        ],
        lifespan=lifespan,
    )


async def run_mcp_sse_legacy(rmcp: "RecceMCPServer", host: str = "localhost", port: int = 8000) -> None:
    """Run a stand-alone legacy SSE server (deprecated `recce mcp-server --sse`)."""
    import uvicorn

    app = _build_legacy_sse_app(rmcp)
    logger.info(f"Starting Recce MCP Server in legacy SSE mode on {host}:{port}")
    logger.info(f"Connection URL: http://{host}:{port}/sse")
    config = uvicorn.Config(app, host=host, port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


def attach_mcp_to_fastapi(
    app: "FastAPI", rmcp: "RecceMCPServer", prefix: str = "/mcp"
) -> "StreamableHTTPSessionManager":
    """Mount the MCP transport surface onto an existing FastAPI app.

    Exposes:
        POST/GET {prefix}                — Streamable HTTP (modern transport)
        GET      {prefix}/sse            — legacy SSE stream
        POST     {prefix}/messages/      — legacy SSE message channel

    Both transports share the same mcp.Server instance (rmcp.server), so
    every tool is reachable on either transport.

    Returns:
        StreamableHTTPSessionManager — the caller MUST drive its lifecycle
        from a context manager (typically the FastAPI lifespan): wrap the
        `yield` in `async with session_manager.run(): ...`.

    Routing order matters: the more-specific /sse and /messages routes
    are listed BEFORE the catch-all Mount("/") for Streamable HTTP.
    """
    from mcp.server.sse import SseServerTransport
    from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
    from starlette.applications import Starlette
    from starlette.routing import Mount

    session_manager = StreamableHTTPSessionManager(
        app=rmcp.server,
        event_store=None,
        json_response=False,
        stateless=False,
    )

    sse = SseServerTransport(f"{prefix}/messages/")

    async def handle_sse_asgi(scope, receive, send):
        """Raw ASGI handler — avoids touching Starlette's private Request._send."""
        if scope.get("type") != "http":
            return
        if scope.get("method") != "GET":
            await send({"type": "http.response.start", "status": 405, "headers": []})
            await send({"type": "http.response.body", "body": b""})
            return
        client = scope.get("client")
        client_info = f"{client[0]}:{client[1]}" if client else "unknown"
        logger.info(f"[MCP HTTP] SSE connection established from {client_info}")
        try:
            async with sse.connect_sse(scope, receive, send) as streams:
                await rmcp.server.run(streams[0], streams[1], rmcp.server.create_initialization_options())
        finally:
            logger.info(f"[MCP HTTP] SSE connection closed from {client_info}")

    async def handle_streamable_http(scope, receive, send) -> None:
        await session_manager.handle_request(scope, receive, send)

    sub_app = Starlette(
        debug=rmcp.mcp_logger.debug,
        routes=[
            # Order matters: specific routes BEFORE the catch-all Mount("/")
            Mount("/sse", app=handle_sse_asgi),
            Mount("/messages/", app=sse.handle_post_message),
            Mount("/", app=handle_streamable_http),
        ],
    )

    # Insert at the front of app.routes so this Mount shadows the /mcp
    # 503-fallback handler that recce/server.py registers at module-import
    # time. Without this insert, the fallback would be matched first because
    # FastAPI uses first-match-wins routing.
    app.routes.insert(0, Mount(prefix, app=sub_app))
    return session_manager
