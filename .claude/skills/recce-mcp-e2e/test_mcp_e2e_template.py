"""MCP E2E — temporary, delete after verification."""

import asyncio
import json
import os
import sys

PROJECT_DIR = "PROJECT_DIR_PLACEHOLDER"
os.chdir(PROJECT_DIR)

TOOL_METHODS = {
    "lineage_diff": "_tool_lineage_diff",
    "schema_diff": "_tool_schema_diff",
    "row_count_diff": "_tool_row_count_diff",
    "query": "_tool_query",
    "query_diff": "_tool_query_diff",
    "profile_diff": "_tool_profile_diff",
    "list_checks": "_tool_list_checks",
    "run_check": "_tool_run_check",
}


def discover_model(manifest_path):
    with open(manifest_path) as f:
        manifest = json.load(f)
    for uid, node in manifest.get("nodes", {}).items():
        if node.get("resource_type") == "model":
            return node["name"]
    return None


MODEL = discover_model(os.path.join(PROJECT_DIR, "target", "manifest.json"))
if not MODEL:
    print("ERROR: No model found in manifest")
    sys.exit(1)

TOOL_ARGS = {
    "lineage_diff": {"select": MODEL, "view_mode": "all"},
    "schema_diff": {"select": MODEL},
    "row_count_diff": {"node_names": [MODEL]},
    "query": {"sql_template": f"SELECT count(*) as cnt FROM {{{{ ref('{MODEL}') }}}}"},
    "query_diff": {"sql_template": f"SELECT count(*) as cnt FROM {{{{ ref('{MODEL}') }}}}"},
    "profile_diff": {"model": MODEL},
    "list_checks": {},
    "run_check": None,  # resolved after list_checks
}

WARNING_TOOLS = {"row_count_diff", "query_diff", "profile_diff"}
NO_WARNING_TOOLS = {"lineage_diff", "schema_diff"}


async def call_tool(server, name, args):
    return await getattr(server, TOOL_METHODS[name])(args)


async def test_full_mode(ctx):
    from recce.config import RecceConfig
    from recce.mcp_server import RecceMCPServer
    from recce.run import load_preset_checks

    config_file = os.path.join(PROJECT_DIR, "recce.yml")
    if os.path.exists(config_file):
        config = RecceConfig(config_file=config_file)
        preset_checks = config.get("checks", [])
        if preset_checks:
            load_preset_checks(preset_checks)

    server = RecceMCPServer(ctx)
    results = {}

    for name, args in TOOL_ARGS.items():
        if name == "run_check":
            continue
        try:
            result = await call_tool(server, name, args)
            ok = result is not None and isinstance(result, (dict, list))
            results[name] = "PASS" if ok else "FAIL (empty)"
            if name == "list_checks" and isinstance(result, dict):
                checks = result.get("checks", [])
                if checks:
                    TOOL_ARGS["run_check"] = {"check_id": checks[0]["check_id"]}
        except Exception as e:
            results[name] = f"ERROR: {e}"

    if TOOL_ARGS["run_check"]:
        try:
            result = await call_tool(server, "run_check", TOOL_ARGS["run_check"])
            results["run_check"] = "PASS" if result else "FAIL"
        except Exception as e:
            results["run_check"] = f"ERROR: {e}"
    else:
        results["run_check"] = "SKIP (no checks in recce.yml)"

    return results


async def test_single_env(ctx):
    from recce.mcp_server import SINGLE_ENV_WARNING, RecceMCPServer

    server = RecceMCPServer(ctx, single_env=True)
    results = {}

    for name in WARNING_TOOLS:
        try:
            result = await call_tool(server, name, TOOL_ARGS[name])
            has = "_warning" in result and result["_warning"] == SINGLE_ENV_WARNING
            results[f"{name} (_warning)"] = "PASS" if has else "FAIL"
        except Exception as e:
            results[f"{name} (_warning)"] = f"ERROR: {e}"

    for name in NO_WARNING_TOOLS:
        try:
            result = await call_tool(server, name, TOOL_ARGS[name])
            has = "_warning" in result if isinstance(result, dict) else False
            results[f"{name} (no _warning)"] = "PASS" if not has else "FAIL"
        except Exception as e:
            results[f"{name} (no _warning)"] = f"ERROR: {e}"

    return results


async def main():
    from recce.core import load_context

    ctx = load_context(target_path="target", target_base_path="target-base")

    print("=== FULL MODE (8 tools) ===")
    full = await test_full_mode(ctx)
    for k, v in full.items():
        print(f"  {'PASS' if 'PASS' in v else 'FAIL'} {k}: {v}")

    print("\n=== SINGLE-ENV MODE ===")
    single = await test_single_env(ctx)
    for k, v in single.items():
        print(f"  {'PASS' if 'PASS' in v else 'FAIL'} {k}: {v}")

    all_pass = all("PASS" in v for v in {**full, **single}.values())
    print(f"\n{'ALL PASS' if all_pass else 'SOME FAILED'}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
