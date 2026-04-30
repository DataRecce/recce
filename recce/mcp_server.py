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
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import requests
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from recce.core import RecceContext, load_context
from recce.exceptions import RecceException
from recce.server import RecceServerMode
from recce.tasks.dataframe import DataFrame
from recce.tasks.histogram import HistogramDiffTask
from recce.tasks.profile import ProfileDiffTask
from recce.tasks.query import QueryDiffTask, QueryTask
from recce.tasks.rowcount import (
    PERMISSION_DENIED_INDICATORS,
    SYNTAX_ERROR_INDICATORS,
    TABLE_NOT_FOUND_INDICATORS,
    RowCountDiffTask,
)
from recce.tasks.top_k import TopKDiffTask
from recce.tasks.valuediff import ValueDiffDetailTask, ValueDiffTask
from recce.util.recce_cloud import RECCE_CLOUD_API_HOST, RecceCloudException

logger = logging.getLogger(__name__)

try:
    from sentry_sdk import metrics as sentry_metrics
except ImportError:  # pragma: no cover
    sentry_metrics = None

SINGLE_ENV_WARNING = (
    "Base environment not configured \u2014 comparisons show no changes. "
    "Run `dbt docs generate --target-path target-base` to enable diffing."
)


class InstanceSpawningError(RuntimeError):
    """Raised when a Recce Cloud session instance is not ready yet."""

    def __init__(self):
        super().__init__("Recce Cloud instance is still spawning; retry shortly.")


class CloudBackend:
    """MCP tool backend that proxies calls to a Recce Cloud session instance."""

    RUN_TOOL_TYPES = {
        "row_count_diff": "row_count_diff",
        "query_diff": "query_diff",
        "profile_diff": "profile_diff",
        "value_diff": "value_diff",
        "value_diff_detail": "value_diff_detail",
        "top_k_diff": "top_k_diff",
        "histogram_diff": "histogram_diff",
    }

    def __init__(self, session_id: str, api_token: str, cloud_host: str = RECCE_CLOUD_API_HOST):
        self.session_id = session_id
        self.api_token = api_token
        self.cloud_host = cloud_host.rstrip("/")
        self.instance_status = None

    @classmethod
    async def create(cls, session_id: str, api_token: str):
        backend = cls(session_id=session_id, api_token=api_token)
        spawn_response = await backend._request("POST", "instance", json={})
        if isinstance(spawn_response, dict):
            backend.instance_status = spawn_response.get("status") or spawn_response.get("instance_status")
        return backend

    def _url(self, api_name: str) -> str:
        return f"{self.cloud_host}/api/v2/sessions/{quote(self.session_id, safe='')}/{api_name.lstrip('/')}"

    async def _request(self, method: str, api_name: str, **kwargs):
        url = self._url(api_name)
        headers = {
            **kwargs.pop("headers", {}),
            "Authorization": f"Bearer {self.api_token}",
        }
        response = await asyncio.to_thread(requests.request, method, url, headers=headers, **kwargs)
        if response.status_code == 405:
            raise InstanceSpawningError()
        if response.status_code < 200 or response.status_code >= 300:
            raise RecceCloudException(
                message=f"Failed to call Recce Cloud session endpoint {api_name}.",
                reason=response.text,
                status_code=response.status_code,
            )
        if response.status_code == 204 or not response.text:
            return {}
        try:
            return response.json()
        except ValueError:
            return {"text": response.text}

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if name == "get_server_info":
            return await self._tool_get_server_info(arguments)
        if name == "select_nodes":
            return await self._tool_select_nodes(arguments)
        if name == "get_model":
            return await self._tool_get_model(arguments)
        if name == "get_cll":
            return await self._tool_get_cll(arguments)
        if name == "lineage_diff":
            return await self._tool_lineage_diff(arguments)
        if name == "schema_diff":
            return await self._tool_schema_diff(arguments)
        if name == "query":
            return await self._tool_query(arguments)
        if name in self.RUN_TOOL_TYPES:
            return await self._tool_run_backed(self.RUN_TOOL_TYPES[name], arguments)
        if name == "list_checks":
            return await self._tool_list_checks(arguments)
        if name == "run_check":
            return await self._tool_run_check(arguments)
        if name == "create_check":
            return await self._tool_create_check(arguments)
        if name == "impact_analysis":
            return await self._tool_impact_analysis(arguments)
        raise ValueError(f"Unknown tool: {name}")

    async def _tool_get_server_info(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        info = await self._request("GET", "info")
        result = {
            "mode": "cloud",
            "adapter_type": info.get("adapter_type"),
            "review_mode": info.get("review_mode"),
            "support_tasks": info.get("support_tasks", {}),
            "cloud_mode": True,
            "session_id": self.session_id,
        }
        if self.instance_status:
            result["instance_status"] = self.instance_status
        if info.get("git"):
            result["git"] = info["git"]
        if info.get("pull_request"):
            result["pull_request"] = info["pull_request"]
        return result

    async def _tool_select_nodes(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        return await self._request("POST", "select", json=arguments)

    async def _tool_get_model(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        model_id = arguments.get("node_id") or arguments.get("model_id")
        if not model_id:
            raise ValueError("node_id is required")
        return await self._request("GET", f"models/{quote(model_id, safe='')}")

    async def _tool_get_cll(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        return await self._request("POST", "cll", json=arguments)

    async def _tool_query(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        run_type = "query_base" if arguments.get("base") else "query"
        params = {k: v for k, v in arguments.items() if k != "base"}
        return await self._tool_run_backed(run_type, params)

    async def _tool_run_backed(self, run_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        run = await self._request(
            "POST",
            "runs",
            json={"type": run_type, "params": params, "nowait": False},
        )
        return run.get("result", run)

    async def _tool_list_checks(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        checks = await self._request("GET", "checks")
        checks_list = []
        for check in checks or []:
            checks_list.append(
                {
                    "check_id": str(check.get("check_id")),
                    "name": check.get("name"),
                    "type": check.get("type"),
                    "description": check.get("description") or "",
                    "params": check.get("params") or {},
                    "is_checked": check.get("is_checked", False),
                    "is_preset": check.get("is_preset", False),
                }
            )
        return {
            "checks": checks_list,
            "total": len(checks_list),
            "approved": len([check for check in checks_list if check["is_checked"]]),
        }

    async def _tool_run_check(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        check_id = arguments.get("check_id")
        if not check_id:
            raise ValueError("check_id is required")
        run = await self._request("POST", f"checks/{quote(str(check_id), safe='')}/run", json={"nowait": False})
        if self._run_succeeded(run):
            await self._auto_approve(check_id)
        return run

    async def _tool_create_check(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        check_type = arguments["type"]
        check = await self._request(
            "POST",
            "checks",
            json={
                "name": arguments.get("name"),
                "description": arguments.get("description", ""),
                "type": check_type,
                "params": arguments.get("params", {}),
                "view_options": arguments.get("view_options", {}),
            },
        )
        check_id = check.get("check_id")
        run_executed = False
        run_error = None
        # Match local: execute a run for every type except `simple` (which has no
        # executable run). lineage_diff/schema_diff are recorded server-side via
        # POST /checks/{id}/run, mirroring local _create_metadata_run.
        if check_id and check_type != "simple":
            run = await self._request("POST", f"checks/{quote(str(check_id), safe='')}/run", json={"nowait": False})
            run_executed = True
            run_error = run.get("error")
            if self._run_succeeded(run):
                await self._auto_approve(check_id)
        result = {"check_id": str(check_id), "created": True, "run_executed": run_executed}
        if run_error:
            result["run_error"] = run_error
        return result

    async def _auto_approve(self, check_id) -> None:
        """Best-effort auto-approve on successful run.

        The run already succeeded; an approve-side failure must not blow up the
        tool response. Mirrors the local-mode invariant that auto-approve is a
        post-success side-effect, not part of the run contract.
        """
        try:
            await self._request("PATCH", f"checks/{quote(str(check_id), safe='')}", json={"is_checked": True})
        except (RecceCloudException, InstanceSpawningError) as e:
            logger.warning(f"[MCP] Auto-approve failed for check {check_id}: {e}")

    async def _tool_lineage_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        info = await self._request("GET", "info")
        lineage = info.get("lineage", {})
        nodes = lineage.get("nodes", {})
        selected = await self._selected_nodes(arguments, nodes)
        impacted = set((await self._request("POST", "select", json={"select": "state:modified+"})).get("nodes", []))

        selected_nodes = {node_id: node for node_id, node in nodes.items() if node_id in selected}
        id_to_idx = {node_id: idx for idx, node_id in enumerate(selected_nodes.keys())}
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
            data=[
                (
                    id_to_idx[node_id],
                    node_id,
                    node.get("name"),
                    node.get("resource_type"),
                    node.get("materialized"),
                    node.get("change_status"),
                    node_id in impacted,
                )
                for node_id, node in selected_nodes.items()
            ],
        )

        edge_rows = []
        for edge in lineage.get("edges", []):
            source = edge.get("source")
            target = edge.get("target")
            if source in id_to_idx and target in id_to_idx:
                edge_rows.append((id_to_idx[source], id_to_idx[target]))
        edges_df = DataFrame.from_data(columns={"from": "integer", "to": "integer"}, data=edge_rows)
        return {"nodes": nodes_df.model_dump(mode="json"), "edges": edges_df.model_dump(mode="json")}

    async def _tool_schema_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        info = await self._request("GET", "info")
        nodes = info.get("lineage", {}).get("nodes", {})
        selected = await self._selected_nodes(arguments, nodes)
        changes = []
        for node_id, node in nodes.items():
            if node_id not in selected:
                continue
            column_changes = (node.get("change") or {}).get("columns") or {}
            for column, change_status in column_changes.items():
                changes.append((node_id, column, change_status))
        limit = 100
        return DataFrame.from_data(
            columns={"node_id": "text", "column": "text", "change_status": "text"},
            data=changes[:limit],
            limit=limit,
            more=len(changes) > limit,
        ).model_dump(mode="json")

    async def _tool_impact_analysis(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        info = await self._request("GET", "info")
        nodes = info.get("lineage", {}).get("nodes", {})
        select = arguments.get("select", "state:modified.body+ state:modified.macros+ state:modified.contract+")
        impacted_node_ids = set((await self._request("POST", "select", json={"select": select})).get("nodes", []))
        modified_node_ids = set(
            (await self._request("POST", "select", json={"select": "state:modified"})).get("nodes", [])
        )

        impacted_models = []
        not_impacted_models = []
        for node_id, node in nodes.items():
            if not node_id.startswith("model."):
                continue
            entry = {
                "name": node.get("name"),
                "change_status": node.get("change_status") if node_id in modified_node_ids else None,
                "materialized": node.get("materialized"),
                "row_count": None,
                "schema_changes": [
                    {"column": column, "change_status": status}
                    for column, status in ((node.get("change") or {}).get("columns") or {}).items()
                ],
                "value_diff": None,
                "affected_row_count": None,
                "data_impact": "potential",
                "next_action": {
                    "tool": "profile_diff",
                    "columns": None,
                    "reason": "cloud impact analysis uses metadata-only triage",
                    "priority": "high" if node_id in modified_node_ids else "medium",
                },
            }
            if node_id in impacted_node_ids:
                impacted_models.append(entry)
            else:
                not_impacted_models.append(node.get("name"))

        return {
            "_guidance": "Cloud impact analysis classifies lineage impact from session metadata.",
            "classification_source": "lineage_dag",
            "max_affected_row_count": 0,
            "confirmed_impacted_models": impacted_models,
            "confirmed_not_impacted_models": not_impacted_models,
            "errors": [],
        }

    async def _selected_nodes(self, arguments: Dict[str, Any], nodes: Dict[str, Any]):
        if (
            arguments.get("select")
            or arguments.get("exclude")
            or arguments.get("packages")
            or arguments.get("view_mode")
        ):
            payload = {
                key: arguments.get(key)
                for key in ("select", "exclude", "packages", "view_mode")
                if arguments.get(key) is not None
            }
            return set((await self._request("POST", "select", json=payload)).get("nodes", []))
        return set(nodes.keys())

    @staticmethod
    def _run_succeeded(run: Dict[str, Any]) -> bool:
        status = str(run.get("status", "")).lower()
        return not run.get("error") and status in {"finished", "success", "succeeded"}


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
        context: Optional[RecceContext] = None,
        mode: Optional[RecceServerMode] = None,
        debug: bool = False,
        log_file: str = "logs/recce-mcp.json",
        state_loader=None,
        single_env: bool = False,
        backend: Optional[CloudBackend] = None,
        api_token: Optional[str] = None,
    ):
        self.context = context
        self.backend = backend
        self.state_loader = state_loader
        self.mode = mode or RecceServerMode.server
        self.single_env = single_env
        self.api_token = api_token
        self._backend_lock = asyncio.Lock()
        self._local_cache_key: Optional[tuple] = None
        self.server = Server("recce", instructions=self._build_instructions())
        self.mcp_logger = MCPLogger(debug=debug, log_file=log_file)
        self._setup_handlers()

    def _build_instructions(self) -> Optional[str]:
        """Build MCP server instructions sent during initialize handshake."""
        if not self.single_env:
            return None
        return (
            "IMPORTANT: This Recce server is running in single-environment mode. "
            "Base environment (target-base/) is not configured, so all diff tools "
            "(row_count_diff, query_diff, profile_diff, value_diff, value_diff_detail, top_k_diff, histogram_diff) compare the current environment "
            "against itself and will show no changes. "
            "To enable meaningful diffs, the user needs to run: "
            "dbt docs generate --target-path target-base"
        )

    @staticmethod
    def _classify_db_error(error_msg: str) -> Optional[str]:
        """Classify a database error message into a known category.

        Checks permission_denied first, then table_not_found, then syntax_error
        (first match wins). Returns the category string or None.
        """
        upper_msg = error_msg.upper()
        for indicator in PERMISSION_DENIED_INDICATORS:
            if indicator in upper_msg:
                return "permission_denied"
        for indicator in TABLE_NOT_FOUND_INDICATORS:
            if indicator in upper_msg:
                return "table_not_found"
        for indicator in SYNTAX_ERROR_INDICATORS:
            if indicator in upper_msg:
                return "syntax_error"
        return None

    def _maybe_add_single_env_warning(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Add _warning to diff results when in single-env mode."""
        if self.single_env:
            return {**result, "_warning": SINGLE_ENV_WARNING}
        return result

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
                        Returns nodes and edges (node dependencies) in compact dataframe format.

                        Nodes dataframe includes: idx, id, name, resource_type, materialized, change_status, impacted.
                        Edges dataframe includes: from (parent node idx), to (child node idx).

                        The 'impacted' column is authoritative for impact analysis:
                        - impacted=true: model is modified or downstream of a modified model (connected via ref()).
                        - impacted=false: model is NOT in the impact path, even if it shares upstream sources.
                        Always check the 'impacted' column before reporting which models are affected by a change.

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
                                "description": (
                                    "dbt selector syntax to filter models. "
                                    "Valid state selectors: state:new, state:old, state:modified, state:unmodified. "
                                    "Use '+' suffix for downstream: state:modified+ "
                                    "NOTE: 'state:added' is INVALID - use 'state:new'. "
                                    "Example: '1+state:modified+' for modified models with 1 upstream"
                                ),
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
                                "description": (
                                    "dbt selector syntax to filter models. "
                                    "Valid state selectors: state:new, state:old, state:modified, state:unmodified. "
                                    "NOTE: 'state:added' is INVALID - use 'state:new'."
                                ),
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

            tools.append(
                Tool(
                    name="get_model",
                    description="Get column details for a model from both base and current environments. "
                    "Returns column names, types, and constraints. Useful for understanding model schema "
                    "before running diff tools.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "model_id": {
                                "type": "string",
                                "description": "The unique ID of the model (e.g., 'model.project.model_name')",
                            },
                        },
                        "required": ["model_id"],
                    },
                )
            )
            tools.append(
                Tool(
                    name="get_cll",
                    description="Get column-level lineage data. Traces which downstream columns are affected "
                    "by column changes. Only available with dbt adapter.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "node_id": {
                                "type": "string",
                                "description": "Node unique ID to get column lineage for (optional)",
                            },
                            "column": {
                                "type": "string",
                                "description": "Column name to trace lineage for (optional)",
                            },
                            "change_analysis": {
                                "type": "boolean",
                                "description": "Whether to include change analysis (default: false)",
                                "default": False,
                            },
                        },
                    },
                )
            )
            tools.append(
                Tool(
                    name="get_server_info",
                    description="Get server context information including current backend mode "
                    "('local', 'cloud', or 'none' when unconfigured), adapter type, git branch, "
                    "supported tasks, and review mode status. Useful for diagnostics and "
                    "understanding which diff tools are available.",
                    inputSchema={
                        "type": "object",
                        "properties": {},
                    },
                )
            )
            tools.append(
                Tool(
                    name="set_backend",
                    description=(
                        "Switch the MCP server's active backend at runtime. Use this when the user "
                        "wants to move between local dbt project review and a Recce Cloud session "
                        "(e.g., reviewing a PR) without restarting Claude Code. Confirm the swap by "
                        "calling get_server_info afterward and checking the 'mode' field."
                    ),
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "mode": {
                                "type": "string",
                                "enum": ["local", "cloud"],
                                "description": "Target backend.",
                            },
                            "session_id": {
                                "type": "string",
                                "description": "Required when mode='cloud'. Recce Cloud session ID.",
                            },
                            "api_token": {
                                "type": "string",
                                "description": (
                                    "Optional Recce Cloud API token for mode='cloud'. "
                                    "Overrides the token loaded at startup or from "
                                    "~/.recce/profile.yml. Useful for rotating credentials or "
                                    "connecting without prior `recce connect-to-cloud`."
                                ),
                            },
                            "project_dir": {
                                "type": "string",
                                "description": "Optional dbt project directory for mode='local' (defaults to cwd).",
                            },
                            "target_path": {
                                "type": "string",
                                "description": "Optional dbt target path for mode='local' (default 'target').",
                            },
                            "target_base_path": {
                                "type": "string",
                                "description": "Optional dbt base target path for mode='local' (default 'target-base').",
                            },
                        },
                        "required": ["mode"],
                    },
                )
            )
            tools.append(
                Tool(
                    name="select_nodes",
                    description="Resolve dbt selector expressions to a list of node unique IDs. "
                    "Use this to plan which models to investigate before running expensive diff operations. "
                    "Only available with dbt adapter.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "select": {
                                "type": "string",
                                "description": (
                                    "dbt selector syntax to filter models. "
                                    "Valid state selectors: state:new, state:old, state:modified, state:unmodified. "
                                    "NOTE: 'state:added' is INVALID - use 'state:new'."
                                ),
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
                                "enum": ["all", "changed_models"],
                                "description": "View mode: 'all' for all models, 'changed_models' for only changed models (optional)",
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
                            description=(
                                "Compare row counts between base and current environments for specified models. "
                                "Returns structured results with status information for each model.\n\n"
                                "Response format: {model_name: {base: int|null, curr: int|null, "
                                "base_meta: {status, message?}, curr_meta: {status, message?}}}\n"
                                "- base/curr: row count as integer, or null if unavailable\n"
                                "- base_meta/curr_meta: status details explaining the count value\n\n"
                                "Status codes (in *_meta.status):\n"
                                "- 'ok': Row count retrieved successfully\n"
                                "- 'not_in_manifest': Model not found in dbt manifest\n"
                                "- 'unsupported_resource_type': Node is not a model/snapshot\n"
                                "- 'unsupported_materialization': Materialization doesn't support row counts (e.g., ephemeral)\n"
                                "- 'table_not_found': IMPORTANT - Table defined in manifest but doesn't exist in database. "
                                "This indicates stale dbt artifacts or environment misconfiguration. "
                                "Report this to users as it requires rebuilding dbt artifacts or checking environment setup.\n"
                                "- 'permission_denied': User lacks permission to access the table"
                            )
                            + (
                                "\n\nNote: When base environment is not configured, this tool compares "
                                "the current environment against itself (no changes expected)."
                                if self.single_env
                                else ""
                            ),
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
                                        "description": (
                                            "dbt selector syntax to filter models. "
                                            "Valid state selectors: state:new, state:old, state:modified, state:unmodified. "
                                            "Sub-selectors: state:modified.body, .configs, .relation, .persisted_descriptions, .macros, .contract. "
                                            "Use '+' suffix for downstream deps: state:modified+ "
                                            "IMPORTANT: 'state:added' is INVALID - use 'state:new' instead. "
                                            "Example: 'state:new,config.materialized:table' or 'state:modified+'"
                                        ),
                                    },
                                    "exclude": {
                                        "type": "string",
                                        "description": (
                                            "dbt selector syntax to exclude models. "
                                            "Same syntax as select. Example: 'config.materialized:view'"
                                        ),
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
                            description=(
                                "Execute SQL queries on both base and current environments and compare results. "
                                "Supports primary keys for row-level comparison."
                            )
                            + (
                                "\n\nNote: When base environment is not configured, this tool compares "
                                "the current environment against itself (no changes expected)."
                                if self.single_env
                                else ""
                            ),
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
                            description=(
                                "Generate and compare statistical profiles (min, max, avg, distinct count, etc.) "
                                "for columns in a model between base and current environments."
                            )
                            + (
                                "\n\nNote: When base environment is not configured, this tool compares "
                                "the current environment against itself (no changes expected)."
                                if self.single_env
                                else ""
                            ),
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
                        Tool(
                            name="value_diff",
                            description=(
                                "Compare row-level values between base and current environments using primary key join. "
                                "Returns per-column match rates showing data quality impact. "
                                "Use this to understand which columns changed and how many rows are affected."
                            )
                            + (
                                "\n\nNote: When base environment is not configured, this tool compares "
                                "the current environment against itself (no changes expected)."
                                if self.single_env
                                else ""
                            ),
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "model": {
                                        "type": "string",
                                        "description": "Model name to compare",
                                    },
                                    "primary_key": {
                                        "oneOf": [
                                            {"type": "string"},
                                            {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                        ],
                                        "description": "Primary key column(s) for joining base and current",
                                    },
                                    "columns": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "Columns to compare (optional, compares all if not specified)",
                                    },
                                },
                                "required": ["model", "primary_key"],
                            },
                        ),
                        Tool(
                            name="value_diff_detail",
                            description=(
                                "Get detailed row-level diff showing actual changed, added, and removed values. "
                                "Use after value_diff flags mismatches to see the actual data differences."
                            )
                            + (
                                "\n\nNote: When base environment is not configured, this tool compares "
                                "the current environment against itself (no changes expected)."
                                if self.single_env
                                else ""
                            ),
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "model": {
                                        "type": "string",
                                        "description": "Model name to compare",
                                    },
                                    "primary_key": {
                                        "oneOf": [
                                            {"type": "string"},
                                            {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                        ],
                                        "description": "Primary key column(s) for joining base and current",
                                    },
                                    "columns": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "Columns to compare (optional, compares all if not specified)",
                                    },
                                },
                                "required": ["model", "primary_key"],
                            },
                        ),
                        Tool(
                            name="top_k_diff",
                            description=(
                                "Compare top-K categorical values between base and current environments. "
                                "Detects distribution shifts in categorical columns (e.g., new status values, "
                                "disappeared categories)."
                            )
                            + (
                                "\n\nNote: When base environment is not configured, this tool compares "
                                "the current environment against itself (no changes expected)."
                                if self.single_env
                                else ""
                            ),
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "model": {
                                        "type": "string",
                                        "description": "Model name to compare",
                                    },
                                    "column_name": {
                                        "type": "string",
                                        "description": "Column name to get top-K values for",
                                    },
                                    "k": {
                                        "type": "integer",
                                        "description": "Number of top values to return (default: 10)",
                                        "default": 10,
                                    },
                                },
                                "required": ["model", "column_name"],
                            },
                        ),
                        Tool(
                            name="histogram_diff",
                            description=(
                                "Compare numeric or datetime column distributions between base and current environments. "
                                "Returns histogram bin counts for both environments. Column type is auto-detected "
                                "from the model catalog."
                            )
                            + (
                                "\n\nNote: When base environment is not configured, this tool compares "
                                "the current environment against itself (no changes expected)."
                                if self.single_env
                                else ""
                            ),
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "model": {
                                        "type": "string",
                                        "description": "Model name to compare",
                                    },
                                    "column_name": {
                                        "type": "string",
                                        "description": "Column name to generate histogram for",
                                    },
                                    "num_bins": {
                                        "type": "integer",
                                        "description": "Number of histogram bins (default: 50)",
                                        "default": 50,
                                    },
                                },
                                "required": ["model", "column_name"],
                            },
                        ),
                        Tool(
                            name="list_checks",
                            description="List all checks in the current session. Returns check metadata including check IDs, names, types, parameters, and approval status.",
                            inputSchema={
                                "type": "object",
                                "properties": {},
                            },
                        ),
                        Tool(
                            name="run_check",
                            description="Run a single check by ID and wait for completion. Returns a Run object with fields: run_id, type, check_id, status, result, error, run_at, triggered_by.",
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "check_id": {
                                        "type": "string",
                                        "description": "The ID of the check to run",
                                    },
                                    "triggered_by": {
                                        "type": "string",
                                        "enum": ["user", "recce_ai"],
                                        "description": "Who triggered this run. Defaults to 'user'.",
                                    },
                                },
                                "required": ["check_id"],
                            },
                        ),
                        Tool(
                            name="create_check",
                            description=(
                                "Create a persistent checklist item from analysis findings. "
                                "The check is saved to the session and a run is automatically executed "
                                "to produce verifiable evidence. Use this after completing analysis "
                                "to persist important findings as reviewable checklist items.\n\n"
                                "Idempotent: if a check with the same (type, params) already exists "
                                "in this session, its name and description are updated instead of "
                                "creating a duplicate."
                            ),
                            inputSchema={
                                "type": "object",
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "row_count_diff",
                                            "schema_diff",
                                            "query_diff",
                                            "profile_diff",
                                            "value_diff",
                                            "value_diff_detail",
                                            "top_k_diff",
                                            "histogram_diff",
                                        ],
                                        "description": "The check type (must match a diff tool type)",
                                    },
                                    "params": {
                                        "type": "object",
                                        "description": "Parameters for the check (same format as the corresponding diff tool)",
                                    },
                                    "name": {
                                        "type": "string",
                                        "description": "Human-readable check name (e.g., 'Row Count Diff of orders')",
                                    },
                                    "description": {
                                        "type": "string",
                                        "description": "Analysis summary explaining what was found and why it matters",
                                    },
                                    "triggered_by": {
                                        "type": "string",
                                        "enum": ["user", "recce_ai"],
                                        "description": "Who triggered this run. Defaults to 'user'.",
                                    },
                                },
                                "required": ["type", "params", "name"],
                            },
                        ),
                    ]
                )

                # Discovery tool — requires server mode (calls row_count_diff internally)
                tools.append(
                    Tool(
                        name="impact_analysis",
                        description=textwrap.dedent(
                            """
                            Discover the impact of dbt model changes. Returns which models are
                            modified or downstream-impacted, with row count and value-level signals
                            for non-view models.

                            IMPORTANT: You MUST call this tool BEFORE reporting which models are
                            impacted by a code change. Do NOT determine impact by reading code,
                            inferring from ref() calls, or guessing from model names — these
                            approaches confuse upstream dependencies with downstream impact and
                            produce false positives. This tool uses the lineage DAG to
                            deterministically classify models.

                            This is a starting point for investigation, not a complete analysis.
                            Use the results to identify anomalies, then follow up with profile_diff,
                            query_diff, or other tools until you have confidence in the root cause.

                            Models with data_impact: 'potential' have unknown data impact — follow
                            the model's next_action field to investigate with profile_diff/query_diff.
                        """
                        ).strip(),
                        inputSchema={
                            "type": "object",
                            "properties": {
                                "select": {
                                    "type": "string",
                                    "description": (
                                        "dbt selector syntax. Default: data-affecting changes only "
                                        "(body + macros + contract and their downstream). "
                                        "Use 'state:modified+' to include all changes including config."
                                    ),
                                },
                                "skip_value_diff": {
                                    "type": "boolean",
                                    "description": "Skip row-level value comparison on modified models. Default: false",
                                },
                                "skip_downstream_value_diff": {
                                    "type": "boolean",
                                    "description": (
                                        "Skip value comparison on downstream models "
                                        "(faster for large DAGs). Default: false"
                                    ),
                                },
                            },
                        },
                    )
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
                blocked_tools_in_non_server = {
                    "row_count_diff",
                    "query",
                    "query_diff",
                    "profile_diff",
                    "value_diff",
                    "value_diff_detail",
                    "top_k_diff",
                    "histogram_diff",
                    "list_checks",
                    "run_check",
                    "create_check",
                    "impact_analysis",
                }
                # Unconfigured-mode gate: when neither a local context nor a cloud
                # backend is set, only set_backend and get_server_info are usable.
                if self.context is None and self.backend is None and name not in {"set_backend", "get_server_info"}:
                    raise ValueError("No backend configured. Call set_backend(mode='local'|'cloud', ...) first.")

                if self.mode != RecceServerMode.server and name in blocked_tools_in_non_server:
                    # Allowed tools = all registered minus blocked
                    allowed_tools = sorted(
                        {
                            "lineage_diff",
                            "schema_diff",
                            "get_model",
                            "get_cll",
                            "get_server_info",
                            "select_nodes",
                        }
                    )
                    raise ValueError(
                        f"Tool '{name}' is not available in {self.mode.value} mode. "
                        f"Only {', '.join(repr(t) for t in allowed_tools)} are available in this mode."
                    )

                if name == "set_backend":
                    result = await self._tool_set_backend(arguments)
                elif name == "get_server_info" and self.context is None and self.backend is None:
                    result = {
                        "mode": "none",
                        "configured": False,
                        "message": "No backend configured. Call set_backend(mode='local'|'cloud', ...) first.",
                    }
                elif self.backend is not None:
                    result = await self.backend.call_tool(name, arguments)
                elif name == "lineage_diff":
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
                elif name == "value_diff":
                    result = await self._tool_value_diff(arguments)
                elif name == "value_diff_detail":
                    result = await self._tool_value_diff_detail(arguments)
                elif name == "top_k_diff":
                    result = await self._tool_top_k_diff(arguments)
                elif name == "histogram_diff":
                    result = await self._tool_histogram_diff(arguments)
                elif name == "impact_analysis":
                    result = await self._tool_impact_analysis(arguments)
                elif name == "get_model":
                    result = await self._tool_get_model(arguments)
                elif name == "get_cll":
                    result = await self._tool_get_cll(arguments)
                elif name == "get_server_info":
                    result = await self._tool_get_server_info(arguments)
                elif name == "select_nodes":
                    result = await self._tool_select_nodes(arguments)
                elif name == "list_checks":
                    result = await self._tool_list_checks(arguments)
                elif name == "run_check":
                    result = await self._tool_run_check(arguments)
                elif name == "create_check":
                    result = await self._tool_create_check(arguments)
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
                error_msg = str(e)
                self.mcp_logger.log_tool_call(name, arguments, {}, duration_ms, error=error_msg)

                is_expected_cloud_error = isinstance(e, (RecceCloudException, InstanceSpawningError))
                classification = self._classify_db_error(error_msg)
                if classification:
                    logger.warning(
                        f"[MCP] Expected {classification} error in tool {name} ({duration_ms:.2f}ms): {error_msg}"
                    )
                    if sentry_metrics:
                        sentry_metrics.count(
                            "mcp.expected_error",
                            1,
                            attributes={"tool": name, "error_type": classification},
                        )
                elif is_expected_cloud_error:
                    logger.warning(f"[MCP] Expected cloud error in tool {name} ({duration_ms:.2f}ms): {error_msg}")
                else:
                    logger.error(f"[MCP] Error executing tool {name} ({duration_ms:.2f}ms): {error_msg}")
                    logger.exception("[MCP] Full traceback:")

                # Re-raise so MCP SDK sets isError=True in the protocol response
                raise

    async def _tool_lineage_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Get lineage diff between base and current"""
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

        # Build edges from parent_map
        edges_data = []
        for node_id, parents in parent_map.items():
            if node_id in id_to_idx:
                for parent_id in parents:
                    if parent_id in id_to_idx:
                        edges_data.append((id_to_idx[parent_id], id_to_idx[node_id]))

        # Create edges DataFrame
        edges_df = DataFrame.from_data(
            columns={
                "from": "integer",
                "to": "integer",
            },
            data=edges_data,
        )

        # Build simplified result
        result = {
            "nodes": nodes_df.model_dump(mode="json"),
            "edges": edges_df.model_dump(mode="json"),
        }

        return result

    async def _tool_schema_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Get schema diff (column changes) between base and current"""
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

    async def _tool_row_count_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute row count diff task"""
        task = RowCountDiffTask(params=arguments)

        # Offload sync task to thread pool to avoid blocking the event loop
        result = await asyncio.get_event_loop().run_in_executor(None, task.execute)

        return self._maybe_add_single_env_warning(result)

    async def _tool_query(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a query"""
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

    async def _tool_query_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute query diff task"""
        task = QueryDiffTask(params=arguments)

        # Execute task
        result = await asyncio.get_event_loop().run_in_executor(None, task.execute)

        # Convert to dict if it's a model
        if hasattr(result, "model_dump"):
            result = result.model_dump(mode="json")
        return self._maybe_add_single_env_warning(result)

    async def _tool_profile_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute profile diff task"""
        task = ProfileDiffTask(params=arguments)

        # Execute task
        result = await asyncio.get_event_loop().run_in_executor(None, task.execute)

        # Convert to dict if it's a model
        if hasattr(result, "model_dump"):
            result = result.model_dump(mode="json")
        return self._maybe_add_single_env_warning(result)

    async def _tool_value_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute value diff task"""
        task = ValueDiffTask(params=arguments)
        result = await asyncio.get_event_loop().run_in_executor(None, task.execute)
        if hasattr(result, "model_dump"):
            result = result.model_dump(mode="json")
        return self._maybe_add_single_env_warning(result)

    async def _tool_value_diff_detail(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute value diff detail task"""
        task = ValueDiffDetailTask(params=arguments)
        result = await asyncio.get_event_loop().run_in_executor(None, task.execute)
        if hasattr(result, "model_dump"):
            result = result.model_dump(mode="json")
        return self._maybe_add_single_env_warning(result)

    async def _tool_top_k_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute top-K diff task"""
        task = TopKDiffTask(params=arguments)
        result = await asyncio.get_event_loop().run_in_executor(None, task.execute)
        if hasattr(result, "model_dump"):
            result = result.model_dump(mode="json")
        return self._maybe_add_single_env_warning(result)

    async def _tool_histogram_diff(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute histogram diff task with auto-detected column type"""
        model = arguments.get("model")
        column_name = arguments.get("column_name")
        if not model:
            raise ValueError("model is required")
        if not column_name:
            raise ValueError("column_name is required")

        # Auto-detect column_type from model metadata
        name_to_id = self.context.build_name_to_unique_id_index()
        model_id = name_to_id.get(model, model)
        model_info = self.context.get_model(model_id, base=False)
        columns = model_info.get("columns", {}) if model_info else {}

        # Try exact match, then case-insensitive
        col_info = columns.get(column_name)
        if not col_info:
            col_info = columns.get(column_name.upper())
        if not col_info:
            col_info = columns.get(column_name.lower())
        if not col_info or not col_info.get("type"):
            raise ValueError(f"Cannot determine column type for '{column_name}' in model '{model}'")

        params = {**arguments, "column_type": col_info["type"]}
        task = HistogramDiffTask(params=params)
        result = await asyncio.get_event_loop().run_in_executor(None, task.execute)
        if hasattr(result, "model_dump"):
            result = result.model_dump(mode="json")
        return self._maybe_add_single_env_warning(result)

    async def _tool_impact_analysis(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Discover the impact of dbt model changes."""
        start_time = time.time()
        # Default: only body/macros/contract changes (data-affecting).
        # Excludes config, relation, and persisted_descriptions changes.
        select = arguments.get(
            "select",
            "state:modified.body+ state:modified.macros+ state:modified.contract+",
        )
        skip_value_diff = arguments.get("skip_value_diff", False)
        skip_downstream_value_diff = arguments.get("skip_downstream_value_diff", False)
        errors = []

        # Step 1: Lineage classification
        lineage_diff = self.context.get_lineage_diff().model_dump(mode="json")
        diff_info = lineage_diff.get("diff", {})

        # Get impacted node IDs (modified + downstream)
        impacted_node_ids = self.context.adapter.select_nodes(select=select)
        # Get only modified nodes (not downstream)
        modified_node_ids = self.context.adapter.select_nodes(select="state:modified")

        # Build node info from current (or base for removed)
        all_nodes = {}
        for env_key in ["base", "current"]:
            if env_key in lineage_diff and "nodes" in lineage_diff[env_key]:
                for node_id, node_info in lineage_diff[env_key]["nodes"].items():
                    if node_id not in all_nodes:
                        all_nodes[node_id] = node_info
                    elif env_key == "current":
                        all_nodes[node_id] = node_info  # current overrides base

        # Classify nodes
        impacted_models = []
        not_impacted_models = []

        for node_id, node_info in all_nodes.items():
            # Only process models (not sources, tests, etc.)
            if not node_id.startswith("model."):
                continue

            name = node_info.get("name")
            materialized = node_info.get("config", {}).get("materialized")
            change_status = diff_info.get(node_id, {}).get("change_status")

            if node_id in impacted_node_ids:
                model_entry = {
                    "name": name,
                    "change_status": (
                        change_status if node_id in modified_node_ids or change_status in ("added", "removed") else None
                    ),
                    "materialized": materialized,
                    "row_count": None,
                    "schema_changes": [],
                    "value_diff": None,
                }
                impacted_models.append(model_entry)
            else:
                not_impacted_models.append(name)

        # Step 2a: Row count diff (skip removed models; include views for delta detection)
        countable_models = [m for m in impacted_models if m["change_status"] != "removed"]
        if countable_models:
            countable_names = [m["name"] for m in countable_models]
            try:
                task = RowCountDiffTask(params={"node_names": countable_names})
                row_count_result = await asyncio.get_event_loop().run_in_executor(None, task.execute)

                for model in countable_models:
                    name = model["name"]
                    if name in row_count_result:
                        rc = row_count_result[name]
                        base = rc.get("base")
                        curr = rc.get("curr")
                        if base is not None and curr is not None:
                            delta = curr - base
                            delta_pct = (delta / base * 100) if base != 0 else None
                            model["row_count"] = {
                                "base": base,
                                "current": curr,
                                "delta": delta,
                                "delta_pct": round(delta_pct, 1) if delta_pct is not None else None,
                            }
                        elif curr is not None:
                            # Added model (no base)
                            model["row_count"] = {
                                "base": None,
                                "current": curr,
                                "delta": None,
                                "delta_pct": None,
                            }
            except Exception as e:
                errors.append({"step": "row_count_diff", "message": str(e)})

        # Build node_id lookup for impacted models (used by schema diff and value diff)
        node_id_by_name = {}
        for node_id in impacted_node_ids:
            node_info = all_nodes.get(node_id, {})
            if node_info.get("name"):
                node_id_by_name[node_info["name"]] = node_id

        # Step 2b: Schema diff (compare columns between base and current)
        try:
            base_nodes = lineage_diff.get("base", {}).get("nodes", {})
            current_nodes = lineage_diff.get("current", {}).get("nodes", {})

            for model in impacted_models:
                node_id = node_id_by_name.get(model["name"])
                if not node_id:
                    continue

                base_cols = set(base_nodes.get(node_id, {}).get("columns", {}).keys())
                curr_cols = set(current_nodes.get(node_id, {}).get("columns", {}).keys())

                changes = []
                for col in curr_cols - base_cols:
                    changes.append({"column": col, "change_status": "added"})
                for col in base_cols - curr_cols:
                    changes.append({"column": col, "change_status": "removed"})
                for col in base_cols & curr_cols:
                    base_type = base_nodes[node_id]["columns"][col].get("type")
                    curr_type = current_nodes[node_id]["columns"][col].get("type")
                    if base_type != curr_type:
                        changes.append({"column": col, "change_status": "modified"})

                model["schema_changes"] = changes
        except Exception as e:
            errors.append({"step": "schema_diff", "message": str(e)})

        # Step 3: Value diff (PK Join on non-view impacted models)
        if not skip_value_diff:
            for model in impacted_models:
                if model["materialized"] == "view":
                    continue  # skip views (no PK, ambiguous semantics)
                if skip_downstream_value_diff and model["change_status"] is None:
                    continue  # opt-out for large DAGs
                node_id = node_id_by_name.get(model["name"])
                if not node_id:
                    continue
                try:
                    model_info = self.context.adapter.get_model(node_id)
                    pk = model_info.get("primary_key")
                    if not pk:
                        continue  # no PK → value_diff stays null

                    # Get column info for building SQL
                    columns_info = model_info.get("columns", {})
                    non_pk_cols = [c for c in columns_info if c != pk]
                    if not non_pk_cols:
                        continue  # only PK column, no value diff to compute

                    # Build relations for base and current schemas
                    base_rel = self.context.adapter.create_relation(model["name"], base=True)
                    curr_rel = self.context.adapter.create_relation(model["name"], base=False)
                    if not base_rel or not curr_rel:
                        continue

                    # Build column diff expression: any non-PK column changed
                    col_diff_parts = []
                    for col in non_pk_cols:
                        col_diff_parts.append(f'b."{col}" IS DISTINCT FROM c."{col}"')
                    col_diff_expr = " OR ".join(col_diff_parts)

                    # Build per-column stats: count of changed rows + mean for numeric columns
                    numeric_types = {
                        "TINYINT",
                        "SMALLINT",
                        "INTEGER",
                        "BIGINT",
                        "INT",
                        "FLOAT",
                        "DOUBLE",
                        "DECIMAL",
                        "NUMERIC",
                        "REAL",
                        "HUGEINT",
                        "INT1",
                        "INT2",
                        "INT4",
                        "INT8",
                        "FLOAT4",
                        "FLOAT8",
                    }
                    per_col_parts = []
                    for col in non_pk_cols:
                        per_col_parts.append(
                            f'COUNT(CASE WHEN b."{pk}" IS NOT NULL AND c."{pk}" IS NOT NULL '
                            f'AND b."{col}" IS DISTINCT FROM c."{col}" THEN 1 END) AS "{col}__changed"'
                        )
                        col_type = columns_info[col].get("type", "").upper().split("(")[0].strip()
                        if col_type in numeric_types:
                            per_col_parts.append(f'AVG(b."{col}") AS "{col}__base_mean"')
                            per_col_parts.append(f'AVG(c."{col}") AS "{col}__curr_mean"')

                    per_col_sql = ",\n  ".join(per_col_parts)

                    sql = (
                        f"SELECT\n"
                        f'  COUNT(CASE WHEN b."{pk}" IS NULL THEN 1 END) AS rows_added,\n'
                        f'  COUNT(CASE WHEN c."{pk}" IS NULL THEN 1 END) AS rows_removed,\n'
                        f'  COUNT(CASE WHEN b."{pk}" IS NOT NULL AND c."{pk}" IS NOT NULL\n'
                        f"             AND ({col_diff_expr}) THEN 1 END) AS rows_changed,\n"
                        f"  {per_col_sql}\n"
                        f"FROM {curr_rel} c\n"
                        f'FULL OUTER JOIN {base_rel} b ON c."{pk}" = b."{pk}"'
                    )

                    def _run_value_diff_query(adapter, query):
                        with adapter.connection_named("value_diff"):
                            _, table = adapter.execute(query, fetch=True)
                            return table

                    table = await asyncio.get_event_loop().run_in_executor(
                        None, _run_value_diff_query, self.context.adapter, sql
                    )

                    if table and len(table) > 0:
                        row = table[0]
                        rows_added = int(row[0])
                        rows_removed = int(row[1])
                        rows_changed = int(row[2])

                        # Parse per-column stats from remaining columns
                        col_idx = 3
                        columns_result = {}
                        for col in non_pk_cols:
                            col_changed = int(row[col_idx])
                            col_idx += 1
                            col_type = columns_info[col].get("type", "").upper().split("(")[0].strip()
                            base_mean = None
                            current_mean = None
                            if col_type in numeric_types:
                                raw_base = row[col_idx]
                                raw_curr = row[col_idx + 1]
                                base_mean = float(raw_base) if raw_base is not None else None
                                current_mean = float(raw_curr) if raw_curr is not None else None
                                col_idx += 2
                            columns_result[col] = {
                                "affected_row_count": col_changed,
                                "base_mean": base_mean,
                                "current_mean": current_mean,
                            }

                        total_affected = rows_added + rows_removed + rows_changed
                        model["value_diff"] = {
                            "affected_row_count": total_affected,
                            "rows_added": rows_added,
                            "rows_removed": rows_removed,
                            "rows_changed": rows_changed,
                            "columns": columns_result,
                        }
                except Exception as e:
                    errors.append(
                        {
                            "step": "value_diff",
                            "model": model["name"],
                            "message": str(e),
                        }
                    )

        # Step 4: Compute per-model affected_row_count, data_impact, and next_action
        max_affected = 0
        for model in impacted_models:
            # affected_row_count: value_diff total (priority) or abs(row_count.delta) (fallback)
            if model["value_diff"] is not None:
                model["affected_row_count"] = model["value_diff"]["affected_row_count"]
            elif model["row_count"] is not None and model["row_count"].get("delta") is not None:
                model["affected_row_count"] = abs(model["row_count"]["delta"])
            else:
                model["affected_row_count"] = None

            # data_impact: evidence level from value_diff
            if model["value_diff"] is not None:
                if model["value_diff"]["affected_row_count"] > 0:
                    model["data_impact"] = "confirmed"
                else:
                    model["data_impact"] = "none"
            else:
                model["data_impact"] = "potential"

            # When data_impact is "potential", force affected_row_count to null
            # to avoid confusion from row_count fallback showing 0
            if model["data_impact"] == "potential":
                model["affected_row_count"] = None

            if model["affected_row_count"] is not None and model["affected_row_count"] > max_affected:
                max_affected = model["affected_row_count"]

            # next_action: only for "potential" models — confirmed/none need no follow-up
            model["next_action"] = None
            if model["data_impact"] == "potential":
                is_modified = model["change_status"] in ("modified", "added")
                is_downstream = model["change_status"] is None

                if model["schema_changes"]:
                    # Schema changed — profile the changed columns
                    changed_cols = [c["column"] for c in model["schema_changes"]]
                    model["next_action"] = {
                        "tool": "profile_diff",
                        "columns": changed_cols,
                        "reason": "schema changed, value_diff unavailable",
                        "priority": "high" if is_modified else "medium",
                    }
                elif is_modified:
                    # Modified but no value_diff (view, no PK, or error)
                    model["next_action"] = {
                        "tool": "profile_diff",
                        "columns": None,
                        "reason": "modified model, value_diff unavailable (view or no PK)",
                        "priority": "high",
                    }
                elif is_downstream and model["materialized"] == "view":
                    # Downstream view — low priority
                    model["next_action"] = {
                        "tool": "profile_diff",
                        "columns": None,
                        "reason": "downstream view, value_diff skipped",
                        "priority": "low",
                    }
                elif is_downstream:
                    # Downstream table — medium priority
                    model["next_action"] = {
                        "tool": "profile_diff",
                        "columns": None,
                        "reason": "downstream model, value_diff skipped",
                        "priority": "medium",
                    }
            elif model["data_impact"] == "confirmed":
                # Confirmed changes — suggest profile_diff only if high change ratio
                vd = model["value_diff"]
                if (
                    model["row_count"] is not None
                    and model["row_count"]["delta_pct"] is not None
                    and abs(model["row_count"]["delta_pct"]) <= 5
                ):
                    total_matched = (model["row_count"]["current"] or 0) - vd["rows_added"]
                    if total_matched > 0 and vd["rows_changed"] / total_matched > 0.2:
                        top_cols = [
                            col
                            for col, stats in (vd.get("columns") or {}).items()
                            if stats.get("affected_row_count", 0) > 0
                        ]
                        model["next_action"] = {
                            "tool": "profile_diff",
                            "columns": top_cols if top_cols else None,
                            "reason": "high change ratio with stable row count — investigate value shifts",
                            "priority": "medium",
                        }

        if sentry_metrics:
            duration = time.time() - start_time
            sentry_metrics.distribution("mcp.impact_analysis.duration", duration, unit="second")
            sentry_metrics.distribution("mcp.impact_analysis.impacted_count", len(impacted_models))

        result = {
            "_guidance": (
                "confirmed_impacted_models lists all models in the DAG blast radius "
                "(modified + downstream). Use data_impact to triage: "
                "'confirmed' = value_diff verified data changes exist — report directly. "
                "'none' = value_diff verified zero data changes — report directly. "
                "'potential' = no value_diff available (views, no PK, or skipped) "
                "— follow the model's next_action to investigate. "
                "Only models with next_action != null need further tool calls. "
                "Note: incremental model value_diff may reflect "
                "build window artifacts if not fully refreshed."
            ),
            "classification_source": "lineage_dag",
            "max_affected_row_count": max_affected,
            "confirmed_impacted_models": impacted_models,
            "confirmed_not_impacted_models": not_impacted_models,
            "errors": errors,
        }
        return self._maybe_add_single_env_warning(result)

    async def _tool_get_model(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Get model column details from both environments"""
        model_id = arguments.get("model_id")
        if not model_id:
            raise ValueError("model_id is required")
        base = self.context.get_model(model_id, base=True)
        current = self.context.get_model(model_id, base=False)
        if not base and not current:
            raise ValueError(
                f"Model '{model_id}' not found in either environment. "
                "Use the full unique ID (e.g., 'model.project.model_name')."
            )
        return {"model": {"base": base, "current": current}}

    async def _tool_get_cll(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Get column-level lineage data"""
        if self.context.adapter_type != "dbt":
            raise ValueError("Column-level lineage is only available with dbt adapter")
        from recce.adapter.dbt_adapter import DbtAdapter

        dbt_adapter: DbtAdapter = self.context.adapter
        cll = dbt_adapter.get_cll(
            node_id=arguments.get("node_id"),
            column=arguments.get("column"),
            change_analysis=arguments.get("change_analysis", False),
        )
        return cll.model_dump(mode="json")

    async def _tool_get_server_info(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Get server context information"""
        context = self.context
        result = {
            "mode": "local",
            "adapter_type": context.adapter_type,
            "review_mode": context.review_mode,
            "support_tasks": context.support_tasks(),
            "single_env": self.single_env,
        }

        # Add git and pull_request info if state_loader is available
        if context.state_loader:
            try:
                state = context.export_state()
                if state.git:
                    result["git"] = state.git.model_dump(mode="json")
                if state.pull_request:
                    result["pull_request"] = state.pull_request.model_dump(mode="json")
            except Exception as e:
                logger.warning(f"[MCP] Failed to load git/PR info: {e}")

        return result

    async def _tool_set_backend(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Switch the active backend (local or cloud) at runtime.

        Tool calls already serialize through MCP stdio, but the lock guards against
        re-entrancy during the slow parts of a swap (CloudBackend.create, load_context).
        Local context is cached by (project_dir, target_path, target_base_path) so flips
        don't re-parse manifests. On `local -> cloud` swap with a state_loader set, the
        local state is exported at the swap moment so pending work isn't lost.
        """
        mode = arguments.get("mode")
        if mode not in ("local", "cloud"):
            raise ValueError(f"Invalid mode '{mode}'. Use 'local' or 'cloud'.")

        async with self._backend_lock:
            if mode == "cloud":
                session_id = arguments.get("session_id")
                if not session_id:
                    raise ValueError("session_id is required when mode='cloud'.")

                # Resolution order: explicit arg > self.api_token (startup) > profile.yml.
                # An explicit arg also persists to self.api_token so subsequent swaps reuse it.
                api_token = arguments.get("api_token") or self.api_token
                if not api_token:
                    from recce.event import get_recce_api_token

                    api_token = get_recce_api_token()
                if not api_token:
                    raise ValueError("Recce Cloud API token not found. Run `recce connect-to-cloud` first.")

                # Best-effort export of local state before swapping away.
                if self.context is not None and self.state_loader is not None:
                    try:
                        self.state_loader.export(self.context.export_state())
                    except Exception as e:
                        logger.warning(f"[MCP] Failed to export local state on swap to cloud: {e}")

                new_backend = await CloudBackend.create(session_id=session_id, api_token=api_token)
                self.backend = new_backend
                self.api_token = api_token
                logger.info(f"[MCP] Backend switched to cloud (session_id={session_id})")
                return {
                    "mode": "cloud",
                    "session_id": session_id,
                    "instance_status": new_backend.instance_status,
                }

            # mode == "local"
            project_dir = arguments.get("project_dir")
            target_path = arguments.get("target_path", "target")
            target_base_path = arguments.get("target_base_path", "target-base")
            cache_key = (project_dir, target_path, target_base_path)

            if self.context is None or self._local_cache_key != cache_key:
                # Reset the global so RecceContext.load runs fresh against new params.
                from recce import core as _core

                _core.recce_context = None
                load_kwargs = {"target_path": target_path, "target_base_path": target_base_path}
                if project_dir:
                    load_kwargs["project_dir"] = project_dir
                self.context = load_context(**load_kwargs)
                self._local_cache_key = cache_key

                base_path = Path(project_dir or "./").joinpath(target_base_path)
                self.single_env = not base_path.is_dir()
                logger.info(f"[MCP] Loaded local context (project_dir={project_dir}, single_env={self.single_env})")

            self.backend = None
            return {
                "mode": "local",
                "adapter_type": self.context.adapter_type,
                "single_env": self.single_env,
            }

    async def _tool_select_nodes(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve dbt selector to node IDs"""
        if self.context.adapter_type != "dbt":
            raise ValueError("select_nodes is only available with dbt adapter")
        nodes = self.context.adapter.select_nodes(
            select=arguments.get("select"),
            exclude=arguments.get("exclude"),
            packages=arguments.get("packages"),
            view_mode=arguments.get("view_mode"),
        )
        # Filter out test nodes
        nodes = [n for n in nodes if not n.startswith("test.")]
        return {"nodes": sorted(nodes)}

    async def _tool_list_checks(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """List all checks in the current session"""
        from recce.models import CheckDAO

        # Get all checks
        checks_dao = CheckDAO()
        checks = checks_dao.list()

        # Build checks list with relevant metadata
        checks_list = []
        for check in checks:
            checks_list.append(
                {
                    "check_id": str(check.check_id),
                    "name": check.name,
                    "type": check.type.value,
                    "description": check.description or "",
                    "params": check.params or {},
                    "is_checked": check.is_checked,
                    "is_preset": check.is_preset,
                }
            )

        # Get statistics
        stats = checks_dao.status()

        result = {
            "checks": checks_list,
            "total": stats["total"],
            "approved": stats["approved"],
        }

        return result

    def _create_metadata_run(self, check_type, params, check_id, result, triggered_by):
        """Create a Run record for metadata-only check types (no DB query).

        These types (lineage_diff, schema_diff) read from dbt manifest, not from
        database queries. We still create a Run record so they appear in Activity.
        """
        from recce.apis.run_func import generate_run_name
        from recce.models import Run, RunDAO
        from recce.models.types import RunStatus

        run = Run(
            type=check_type,
            params=params,
            check_id=check_id,
            status=RunStatus.FINISHED,
            result=result,
            triggered_by=triggered_by,
        )
        run.name = generate_run_name(run)
        RunDAO().create(run)
        return run

    async def _tool_run_check(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single check by ID"""
        from recce.apis.check_api import PatchCheckIn
        from recce.apis.check_func import export_persistent_state
        from recce.apis.run_func import submit_run
        from recce.models import CheckDAO
        from recce.models.types import RunStatus, RunType

        check_id = arguments.get("check_id")
        if not check_id:
            raise ValueError("check_id is required")

        check_dao = CheckDAO()
        check = check_dao.find_check_by_id(check_id)
        if not check:
            raise ValueError(f"Check with ID {check_id} not found")

        triggered_by = arguments.get("triggered_by", "user")
        run_succeeded = False

        if check.type in (RunType.LINEAGE_DIFF, RunType.SCHEMA_DIFF):
            try:
                if check.type == RunType.LINEAGE_DIFF:
                    result = await self._tool_lineage_diff(check.params or {})
                else:
                    result = await self._tool_schema_diff(check.params or {})
                run = self._create_metadata_run(
                    check_type=check.type,
                    params=check.params or {},
                    check_id=check_id,
                    result=result,
                    triggered_by=triggered_by,
                )
                run_succeeded = True
                run_dump = run.model_dump(mode="json")
            except RecceException as e:
                raise ValueError(str(e)) from e
        else:
            try:
                run, future = submit_run(
                    check.type,
                    params=check.params or {},
                    check_id=check_id,
                    triggered_by=triggered_by,
                )
                run.result = await future
                run_succeeded = run.status == RunStatus.FINISHED and not run.error
                run_dump = run.model_dump(mode="json")
            except RecceException as e:
                raise ValueError(str(e)) from e

        # Auto-approve on successful run — same gate as _tool_create_check (line 1832:
        # run_executed and not run_error). PM decision: Passed = Approved (See: DRC-3307).
        # For metadata-only types (lineage_diff/schema_diff), an empty result IS valid
        # evidence: zero changes confirms the upstream PR did not affect lineage/schema.
        # The auto-approve runs OUTSIDE the RecceException try blocks so a cloud-side
        # failure (RecceCloudException, which is NOT a RecceException subclass) is not
        # silently absorbed by the wrapper above. Same persistence policy as
        # _tool_create_check: state is exported to disk/cloud after the approval.
        if run_succeeded:
            check_dao.update_check_by_id(check_id, PatchCheckIn(is_checked=True))
            logger.info(f"Auto-approved check {check_id} (triggered_by={triggered_by})")
            await asyncio.get_event_loop().run_in_executor(None, export_persistent_state)

        return run_dump

    async def _tool_create_check(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Create a persistent check from analysis findings."""
        from recce.apis.check_api import PatchCheckIn
        from recce.apis.check_func import (
            create_check_without_run,
            export_persistent_state,
        )
        from recce.apis.run_func import submit_run
        from recce.models import CheckDAO
        from recce.models.types import RunStatus, RunType

        check_type = RunType(arguments["type"])
        params = arguments.get("params", {})
        name = arguments["name"]
        description = arguments.get("description", "")

        # Idempotency: find existing check with same (type, params)
        check_dao = CheckDAO()
        existing_checks = check_dao.list()
        existing = None
        for c in existing_checks:
            if c.type == check_type and c.params == params:
                existing = c
                break

        if existing:
            patch = PatchCheckIn(name=name, description=description)
            check_dao.update_check_by_id(existing.check_id, patch)
            check_id = existing.check_id
            created = False
        else:
            check = create_check_without_run(
                check_name=name,
                check_description=description,
                check_type=check_type,
                params=params,
                check_view_options={},
            )
            check_id = check.check_id
            created = True

        # Auto-run for evidence
        run_executed = False
        run_error = None
        triggered_by = arguments.get("triggered_by", "user")
        if check_type in (RunType.LINEAGE_DIFF, RunType.SCHEMA_DIFF):
            # Metadata-only: read from manifest, create Run record for Activity
            try:
                if check_type == RunType.LINEAGE_DIFF:
                    result = await self._tool_lineage_diff(params)
                else:
                    result = await self._tool_schema_diff(params)
                self._create_metadata_run(
                    check_type=check_type,
                    params=params,
                    check_id=check_id,
                    result=result,
                    triggered_by=triggered_by,
                )
                run_executed = True
            except Exception as e:
                run_error = str(e)
        else:
            run, future = submit_run(check_type, params=params, check_id=check_id, triggered_by=triggered_by)
            await future
            # submit_run's future always resolves (errors caught internally).
            # Check run.status, not the return value.
            run_executed = run.status == RunStatus.FINISHED
            if run.status == RunStatus.FAILED:
                run_error = run.error

        # Auto-approve check when run succeeded without errors.
        # In the PR summary, Passed = Approved (PM decision): a check that
        # ran successfully is considered reviewed by the agent.
        # Note: this differs from run_should_be_approved() in run.py, which
        # only approves ROW_COUNT_DIFF with matching counts.  Here we blanket-
        # approve any successful run — intentional per PM decision.
        if run_executed and not run_error:
            check_dao.update_check_by_id(check_id, PatchCheckIn(is_checked=True))

        # Persist state to cloud/disk (matches REST endpoint pattern)
        await asyncio.get_event_loop().run_in_executor(None, export_persistent_state)

        result = {
            "check_id": str(check_id),
            "created": created,
            "run_executed": run_executed,
        }
        if run_error:
            result["run_error"] = run_error
        return result

    async def run(self):
        """Run the MCP server in stdio mode"""
        try:
            async with stdio_server() as (read_stream, write_stream):
                await self.server.run(
                    read_stream,
                    write_stream,
                    self.server.create_initialization_options(),
                )
        finally:
            # Export state on shutdown if state_loader is available
            if self.state_loader and self.context:
                try:
                    from rich.console import Console

                    console = Console(stderr=True)

                    # Export the state
                    msg = self.state_loader.export(self.context.export_state())
                    if msg is not None:
                        console.print(f"[yellow]On shutdown:[/yellow] {msg}")
                    else:
                        if hasattr(self.state_loader, "state_file") and self.state_loader.state_file:
                            console.print(
                                f"[yellow]On shutdown:[/yellow] State exported to '{self.state_loader.state_file}'"
                            )
                        else:
                            console.print("[yellow]On shutdown:[/yellow] State exported successfully")
                except Exception as e:
                    logger.exception(f"Failed to export state on shutdown: {e}")

    async def run_sse(self, host: str = "localhost", port: int = 8000):
        """Run the MCP server in HTTP mode using Server-Sent Events (SSE)

        Args:
            host: Host to bind to (default: localhost)
            port: Port to bind to (default: 8000)
        """
        from contextlib import asynccontextmanager

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
                    await self.server.run(
                        streams[0],
                        streams[1],
                        self.server.create_initialization_options(),
                    )
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

        @asynccontextmanager
        async def lifespan(app):
            """Handle startup and shutdown events"""
            # Startup
            yield
            # Shutdown - this runs when server exits (SIGINT, SIGTERM, etc.)
            if self.state_loader and self.context:
                try:
                    logger.info("Exporting state on shutdown...")
                    msg = self.state_loader.export(self.context.export_state())
                    if msg:
                        logger.info(f"State export: {msg}")
                except Exception as e:
                    logger.exception(f"Failed to export state on shutdown: {e}")

        # Create Starlette app with lifespan
        app = Starlette(
            debug=self.mcp_logger.debug,
            routes=[
                Route("/health", endpoint=handle_health_check, methods=["GET"]),
                Route("/sse", endpoint=handle_sse_request, methods=["GET"]),
                Mount("/", app=handle_post_message),
            ],
            lifespan=lifespan,
        )

        # Run with uvicorn
        logger.info(f"Starting Recce MCP Server in HTTP mode on {host}:{port}")
        logger.info(f"Connection URL: http://{host}:{port}/sse")
        config = uvicorn.Config(app, host=host, port=port, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()


async def run_mcp_server(
    sse: bool = False,
    host: str = "localhost",
    port: int = 8000,
    cloud: bool = False,
    session: Optional[str] = None,
    **kwargs,
):
    """
    Entry point for running the MCP server

    Args:
        sse: Whether to run in HTTP/SSE mode (default: False for stdio mode)
        host: Host to bind to in SSE mode (default: localhost)
        port: Port to bind to in SSE mode (default: 8000)
        **kwargs: Arguments for loading RecceContext (dbt options, etc.)
               Optionally includes 'state_loader' for persisting state on shutdown
               Optionally includes 'mode' for server mode (server, preview, read-only)
               Optionally includes 'debug' flag for enabling MCP logging
    """
    state_loader = kwargs.get("state_loader", None)
    # Extract single_env flag before load_context (not a dbt kwarg)
    single_env = kwargs.pop("single_env", False)

    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Extract debug flag from kwargs
    debug = kwargs.get("debug", False)

    if session and not cloud:
        raise ValueError("--cloud is required when --session is provided")

    # Resolve initial mode from CLI hints. Both unset is allowed: the server starts
    # unconfigured and the agent flips it via the set_backend tool. Failed local-context
    # load also falls through to unconfigured so the long-lived MCP keeps running.
    mode_str = kwargs.get("mode")
    server_mode = None
    if mode_str:
        try:
            server_mode = RecceServerMode(mode_str)
        except ValueError:
            logger.warning(f"Invalid mode '{mode_str}', using default server mode")

    api_token = kwargs.get("api_token")
    if not api_token:
        from recce.event import get_recce_api_token

        api_token = get_recce_api_token()

    if cloud:
        if not session:
            raise ValueError("--session is required when --cloud is provided")
        if not api_token:
            raise ValueError("Recce Cloud API token not found. Run `recce connect-to-cloud` first.")

        backend = await CloudBackend.create(session_id=session, api_token=api_token)
        server = RecceMCPServer(
            backend=backend,
            mode=server_mode or RecceServerMode.server,
            debug=debug,
            api_token=api_token,
        )
    else:
        context = None
        try:
            context = load_context(**kwargs)
        except Exception as e:
            logger.warning(
                f"[MCP] No local dbt context loaded ({e}); starting unconfigured. "
                "Use the set_backend tool to attach a backend."
            )

        server = RecceMCPServer(
            context,
            mode=server_mode,
            debug=debug,
            state_loader=state_loader,
            single_env=single_env,
            api_token=api_token,
        )
        if context is not None:
            cache_key = (
                kwargs.get("project_dir"),
                kwargs.get("target_path", "target"),
                kwargs.get("target_base_path", "target-base"),
            )
            server._local_cache_key = cache_key

    # Run in either stdio or SSE mode
    if sse:
        # SSE mode: lifespan handler in Starlette manages shutdown and state export
        await server.run_sse(host=host, port=port)
    else:
        # Stdio mode: run() method handles shutdown and state export via try-finally
        await server.run()
