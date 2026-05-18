"""Smoke test for the analyze_model MCP tool against a real dbt project.

Usage:
    cd <your dbt project>
    dbt compile                              # populate target/manifest.json with compiled_code
    python /path/to/recce/scripts/smoke_analyze_model.py <model_id>

If target-base/ does not exist, the script auto-detects single-env mode and points
target_base_path at target/ — mirrors the CLI behavior in recce/cli.py:559-566.

Example:
    python scripts/smoke_analyze_model.py model.jaffle_shop.orders
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from recce.core import load_context
from recce.mcp_server import RecceMCPServer


def build_context_kwargs(project_dir: str, target_path: str, target_base_path: str) -> dict:
    project = Path(project_dir)
    has_target = (project / target_path / "manifest.json").is_file()
    has_base = (project / target_base_path / "manifest.json").is_file()

    if not has_target:
        sys.exit(
            f"No {target_path}/manifest.json found in {project}. " "Run `dbt compile` (or `dbt docs generate`) first."
        )

    kwargs = {"project_dir": str(project), "target_path": target_path, "target_base_path": target_base_path}
    if not has_base:
        print(
            f"[single-env] {target_base_path}/manifest.json not found — " f"using {target_path}/ as base too.",
            file=sys.stderr,
        )
        kwargs["target_base_path"] = target_path
    return kwargs


async def main():
    parser = argparse.ArgumentParser(description="Smoke test analyze_model")
    parser.add_argument("model_id", help="dbt model unique_id, e.g. model.jaffle_shop.orders")
    parser.add_argument("--project-dir", default=".", help="dbt project root (default: cwd)")
    parser.add_argument("--target-path", default="target", help="dbt target path (default: target)")
    parser.add_argument("--target-base-path", default="target-base", help="dbt base target path (default: target-base)")
    args = parser.parse_args()

    context_kwargs = build_context_kwargs(args.project_dir, args.target_path, args.target_base_path)
    context = load_context(**context_kwargs)
    server = RecceMCPServer(context=context)
    result = await server._tool_analyze_model({"model_id": args.model_id})
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
