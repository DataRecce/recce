import type { CllInput, ColumnLineageData } from "../../api/cll";

/**
 * Client-side filtering of a full CLL map.
 *
 * Replicates the backend's anchor + reachability filtering:
 *   - No params        → return full map (impact overview)
 *   - node_id          → anchor node + reachable upstream/downstream
 *   - node_id + column → BFS from anchor column through parent/child maps
 */
export function sliceCllMap(
  fullMap: ColumnLineageData,
  params: CllInput,
): ColumnLineageData {
  const { node_id, column, no_upstream, no_downstream } = params;

  // Impact overview — filter to changed nodes + reachable lineage
  if (!node_id) {
    return sliceImpactOverview(fullMap, params);
  }

  const { nodes, columns, parent_map, child_map } = fullMap.current;

  if (column) {
    // Column-level: BFS from anchor column through column maps only
    const anchorKey = `${node_id}_${column}`;
    const reachable = new Set<string>([anchorKey]);

    if (!no_upstream) {
      bfs(anchorKey, parent_map, reachable);
    }
    if (!no_downstream) {
      bfs(anchorKey, child_map, reachable);
    }

    // Split into nodes and columns (BFS may reach node keys too)
    const reachableNodes = new Set<string>();
    const reachableColumns = new Set<string>();
    for (const key of reachable) {
      if (nodes[key]) {
        reachableNodes.add(key);
      } else if (columns[key]) {
        reachableColumns.add(key);
      }
    }

    return buildSlice(fullMap, reachableNodes, reachableColumns);
  }

  // Node-level: build anchors based on change_analysis, then BFS
  const anchors = new Set<string>([node_id]);
  const extraNodes = new Set<string>();

  if (params.change_analysis) {
    const node = nodes[node_id];
    if (node?.change_status && node.change_status !== "removed") {
      // Node has changes — anchor on changed columns, not the node itself
      // (unless category is breaking/unknown)
      anchors.delete(node_id);
      extraNodes.add(node_id);

      if (
        node.change_category === "breaking" ||
        node.change_category === "unknown"
      ) {
        anchors.add(node_id);
      }

      // Add changed columns as anchors
      for (const colKey of Object.keys(columns)) {
        if (
          colKey.startsWith(`${node_id}_`) &&
          columns[colKey]?.change_status
        ) {
          anchors.add(colKey);
        }
      }
    }
    // else: no changes — anchor stays as just node_id (no column anchors)
  } else {
    // No change_analysis — anchor on node + all its columns
    for (const colKey of Object.keys(columns)) {
      if (colKey.startsWith(`${node_id}_`)) {
        anchors.add(colKey);
      }
    }
  }

  // BFS upstream and downstream separately, then union (matches backend)
  const reachable = bfsFromAnchors(
    anchors,
    parent_map,
    child_map,
    no_upstream,
    no_downstream,
  );

  // Split into nodes and columns
  const reachableNodes = new Set<string>();
  const reachableColumns = new Set<string>();
  for (const key of reachable) {
    if (nodes[key]) {
      reachableNodes.add(key);
    } else if (columns[key]) {
      reachableColumns.add(key);
    }
  }

  // Extra nodes: visible in nodes dict but NOT in maps (matches backend).
  // Only truly "extra" if not already reached by BFS.
  const onlyExtra = new Set<string>();
  for (const nid of extraNodes) {
    if (!reachable.has(nid)) {
      onlyExtra.add(nid);
    }
    reachableNodes.add(nid);
  }

  return buildSlice(fullMap, reachableNodes, reachableColumns, onlyExtra);
}

/**
 * Impact overview: find changed nodes, build anchors, BFS to reachable set.
 * Matches the backend's anchor logic for node_id=None + change_analysis.
 */
function sliceImpactOverview(
  fullMap: ColumnLineageData,
  params: CllInput,
): ColumnLineageData {
  const { nodes, columns, parent_map, child_map } = fullMap.current;
  const { no_upstream, no_downstream } = params;

  if (!params.change_analysis) {
    // Without change_analysis, all changed nodes are anchors
    const anchors = new Set<string>();
    for (const [nid, node] of Object.entries(nodes)) {
      if (node.change_status) {
        anchors.add(nid);
      }
    }
    const reachable = bfsFromAnchors(
      anchors,
      parent_map,
      child_map,
      no_upstream,
      no_downstream,
    );
    const reachableNodes = new Set<string>();
    const reachableColumns = new Set<string>();
    for (const key of reachable) {
      if (nodes[key]) reachableNodes.add(key);
      else if (columns[key]) reachableColumns.add(key);
    }
    return buildSlice(fullMap, reachableNodes, reachableColumns);
  }

  // change_analysis: replicate backend's per-status anchor logic
  const anchors = new Set<string>();
  const extraNodes = new Set<string>();

  for (const [nid, node] of Object.entries(nodes)) {
    if (!node.change_status) continue;

    if (node.change_status === "added") {
      // Added node + all its columns → anchors
      anchors.add(nid);
      for (const colKey of Object.keys(columns)) {
        if (colKey.startsWith(`${nid}_`)) {
          anchors.add(colKey);
        }
      }
      continue;
    }

    if (node.change_status === "removed") {
      extraNodes.add(nid);
      continue;
    }

    // Modified: node → extra; breaking/unknown → also anchor; changed cols → anchors
    extraNodes.add(nid);
    if (
      node.change_category === "breaking" ||
      node.change_category === "unknown"
    ) {
      anchors.add(nid);
    }
    for (const colKey of Object.keys(columns)) {
      if (colKey.startsWith(`${nid}_`) && columns[colKey]?.change_status) {
        anchors.add(colKey);
      }
    }
  }

  // BFS upstream and downstream separately, then union (matches backend)
  const reachable = bfsFromAnchors(
    anchors,
    parent_map,
    child_map,
    no_upstream,
    no_downstream,
  );

  // Split into nodes and columns
  const reachableNodes = new Set<string>();
  const reachableColumns = new Set<string>();
  for (const key of reachable) {
    if (nodes[key]) reachableNodes.add(key);
    else if (columns[key]) reachableColumns.add(key);
  }

  // Extra nodes: visible but not in maps
  const onlyExtra = new Set<string>();
  for (const nid of extraNodes) {
    if (!reachable.has(nid)) onlyExtra.add(nid);
    reachableNodes.add(nid);
  }

  return buildSlice(fullMap, reachableNodes, reachableColumns, onlyExtra);
}

/**
 * BFS upstream and downstream separately from anchors, then union results.
 * Matches the backend's find_upstream/find_downstream pattern — separate
 * traversals prevent upstream BFS from "poisoning" downstream visited set.
 */
function bfsFromAnchors(
  anchors: Set<string>,
  parentMap: Record<string, string[]>,
  childMap: Record<string, string[]>,
  noUpstream?: boolean,
  noDownstream?: boolean,
): Set<string> {
  const result = new Set<string>(anchors);

  if (!noUpstream) {
    const upstream = new Set<string>(anchors);
    for (const anchor of anchors) {
      bfs(anchor, parentMap, upstream);
    }
    for (const key of upstream) result.add(key);
  }

  if (!noDownstream) {
    const downstream = new Set<string>(anchors);
    for (const anchor of anchors) {
      bfs(anchor, childMap, downstream);
    }
    for (const key of downstream) result.add(key);
  }

  return result;
}

function bfs(
  start: string,
  adjacency: Record<string, string[]>,
  visited: Set<string>,
): void {
  const queue = [start];
  let item: string | undefined;
  while ((item = queue.pop()) !== undefined) {
    for (const neighbor of adjacency[item] ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
}

function buildSlice(
  fullMap: ColumnLineageData,
  reachableNodes: Set<string>,
  reachableColumns: Set<string>,
  extraNodes?: Set<string>,
): ColumnLineageData {
  const { nodes, columns, parent_map } = fullMap.current;

  const slicedNodes: typeof nodes = {};
  for (const nid of reachableNodes) {
    if (nodes[nid]) {
      slicedNodes[nid] = nodes[nid];
    }
  }

  const slicedColumns: typeof columns = {};
  for (const colKey of reachableColumns) {
    if (columns[colKey]) {
      slicedColumns[colKey] = columns[colKey];
    }
  }

  // Maps use BFS-reachable keys only (extra nodes appear in nodes but not maps)
  const mapKeys = new Set([...reachableNodes, ...reachableColumns]);
  if (extraNodes) {
    for (const nid of extraNodes) {
      mapKeys.delete(nid);
    }
  }
  const allReachable = mapKeys;

  const slicedParentMap: Record<string, string[]> = {};
  for (const key of allReachable) {
    if (parent_map[key]) {
      slicedParentMap[key] = parent_map[key].filter((v) => allReachable.has(v));
    }
  }

  // Build child_map by inverting parent_map (same as backend)
  const slicedChildMap: Record<string, string[]> = {};
  for (const [childKey, parents] of Object.entries(slicedParentMap)) {
    for (const parentKey of parents) {
      if (!slicedChildMap[parentKey]) {
        slicedChildMap[parentKey] = [];
      }
      slicedChildMap[parentKey].push(childKey);
    }
  }

  return {
    current: {
      nodes: slicedNodes,
      columns: slicedColumns,
      parent_map: slicedParentMap,
      child_map: slicedChildMap,
    },
  };
}
