"""
Capture CLL fixtures from a running recce server that has actual dbt changes.

Usage:
    python capture_diff_fixtures.py [--port 8000] [--output-dir ./diff]

Prerequisites:
    - recce server running with jaffle_shop_duckdb (with base vs current diff)
    - Changes should include: added column, modified column def, WHERE clause added
"""

import argparse
import json
import os
import sys
from urllib.request import urlopen, Request


def fetch_cll(base_url: str, params: dict) -> dict:
    """Fetch CLL data from the server via POST."""
    url = f"{base_url}/api/cll"
    body = json.dumps(params).encode()
    req = Request(url, data=body, headers={"Content-Type": "application/json"})
    with urlopen(req) as resp:
        return json.loads(resp.read().decode())


def save_fixture(output_dir: str, name: str, data: dict):
    path = os.path.join(output_dir, f"{name}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  saved: {name}.json")


def main():
    parser = argparse.ArgumentParser(description="Capture CLL diff fixtures")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--output-dir", default=os.path.join(os.path.dirname(__file__), "diff"))
    args = parser.parse_args()

    base_url = f"http://localhost:{args.port}"
    output_dir = args.output_dir
    os.makedirs(output_dir, exist_ok=True)

    # 1. Impact overview (no node_id = all changed nodes + their lineage)
    print("Fetching impact overview (full map with change_analysis)...")
    full_map = fetch_cll(base_url, {"change_analysis": True})
    save_fixture(output_dir, "cll-diff-full-map", full_map)

    # Find nodes with changes
    nodes_with_changes = {}
    for nid, node in full_map["current"]["nodes"].items():
        if node.get("change_status"):
            nodes_with_changes[nid] = node
            print(f"  changed node: {nid} (status={node['change_status']}, category={node.get('change_category', 'n/a')})")

    if not nodes_with_changes:
        print("ERROR: No nodes with change_status found. Is the server running with a diff?")
        sys.exit(1)

    # Find columns with changes
    cols_with_changes = {}
    for cid, col in full_map["current"]["columns"].items():
        if col.get("change_status"):
            cols_with_changes[cid] = col
            print(f"  changed column: {cid} ({col['change_status']})")

    # 2. Node-level queries for changed nodes
    print("\nFetching node-level fixtures for changed nodes...")
    for nid in nodes_with_changes:
        safe_name = nid.replace(".", "_")

        data = fetch_cll(base_url, {"node_id": nid, "change_analysis": True})
        save_fixture(output_dir, f"cll-diff-node-{safe_name}", data)

        data = fetch_cll(base_url, {"node_id": nid, "change_analysis": True, "no_upstream": True})
        save_fixture(output_dir, f"cll-diff-node-{safe_name}-no-upstream", data)

        data = fetch_cll(base_url, {"node_id": nid, "change_analysis": True, "no_downstream": True})
        save_fixture(output_dir, f"cll-diff-node-{safe_name}-no-downstream", data)

    # 3. Column-level queries for changed columns
    print("\nFetching column-level fixtures for changed columns...")
    for cid, col in cols_with_changes.items():
        node_id = None
        col_name = None
        for nid in full_map["current"]["nodes"]:
            if cid.startswith(f"{nid}_"):
                node_id = nid
                col_name = cid[len(nid) + 1:]
                break

        if not node_id or not col_name:
            print(f"  WARNING: could not parse node_id/column from {cid}, skipping")
            continue

        safe_name = cid.replace(".", "_")
        data = fetch_cll(base_url, {"node_id": node_id, "column": col_name, "change_analysis": True})
        save_fixture(output_dir, f"cll-diff-col-{safe_name}", data)

    # 4. A few impacted (downstream, not directly changed) nodes
    print("\nFetching impacted (not directly changed) node fixtures...")
    impacted_nodes = [
        nid for nid, node in full_map["current"]["nodes"].items()
        if node.get("impacted") and not node.get("change_status")
    ]
    for nid in impacted_nodes[:3]:
        safe_name = nid.replace(".", "_")
        data = fetch_cll(base_url, {"node_id": nid, "change_analysis": True})
        save_fixture(output_dir, f"cll-diff-node-{safe_name}", data)

    print(f"\nDone! {len(os.listdir(output_dir))} fixtures in {output_dir}")


if __name__ == "__main__":
    main()
