"""
Change Detection - Compares two invocations via checksums.

This module implements the core change detection logic that identifies
which models have been added, removed, or modified between invocations.
"""

from enum import Enum
from typing import Dict, List, Tuple

from recce.adapter.metadata_adapter.models import ModelInfo
from recce.models.types import LineageDiff, NodeDiff


class ChangeType(Enum):
    """Classification of model changes between invocations."""

    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    UNCHANGED = "unchanged"


def list_modified_nodes(
    base_models: Dict[str, ModelInfo], curr_models: Dict[str, ModelInfo]
) -> List[Tuple[str, ChangeType]]:
    """
    Compare two invocations and classify changes.

    Uses checksums for O(1) per-model comparison, making this efficient
    even for large projects with thousands of models.

    Args:
        base_models: Models from the base invocation (keyed by unique_id)
        curr_models: Models from the current invocation (keyed by unique_id)

    Returns:
        List of (unique_id, change_type) tuples for all changed models.
        Unchanged models are not included in the output.
    """
    changes = []
    all_ids = set(base_models.keys()) | set(curr_models.keys())

    for unique_id in all_ids:
        base = base_models.get(unique_id)
        curr = curr_models.get(unique_id)

        if base is None:
            changes.append((unique_id, ChangeType.ADDED))
        elif curr is None:
            changes.append((unique_id, ChangeType.REMOVED))
        elif base.checksum != curr.checksum:
            changes.append((unique_id, ChangeType.MODIFIED))
        # else: unchanged, skip

    return changes


def build_lineage_from_models(models: Dict[str, ModelInfo]) -> dict:
    """
    Build lineage structure from ModelInfo objects.

    Creates the DAG structure expected by Recce's lineage visualization,
    including nodes and their parent/child relationships.

    Args:
        models: Dictionary of ModelInfo objects keyed by unique_id

    Returns:
        Dictionary with 'nodes' key containing node metadata
    """
    nodes = {}
    parent_map = {}
    child_map = {}

    for unique_id, model in models.items():
        # Build node data
        nodes[unique_id] = model.to_lineage_node()

        # Build parent map (this node's parents)
        parent_map[unique_id] = model.depends_on

        # Build child map (nodes that depend on this one)
        for parent_id in model.depends_on:
            if parent_id not in child_map:
                child_map[parent_id] = []
            child_map[parent_id].append(unique_id)

    return {
        "nodes": nodes,
        "parent_map": parent_map,
        "child_map": child_map,
    }


def get_lineage_diff(base_models: Dict[str, ModelInfo], curr_models: Dict[str, ModelInfo]) -> LineageDiff:
    """
    Generate LineageDiff compatible with existing Recce UI.

    This mirrors the logic in recce/adapter/base.py:get_lineage_diff()
    but operates on ModelInfo objects instead of manifest nodes.

    Args:
        base_models: Models from the base invocation
        curr_models: Models from the current invocation

    Returns:
        LineageDiff containing base lineage, current lineage, and diff map
    """
    changes = list_modified_nodes(base_models, curr_models)

    diff_map = {}
    for unique_id, change_type in changes:
        if change_type == ChangeType.MODIFIED:
            diff_map[unique_id] = NodeDiff(change_status="modified", change_category="breaking")
        elif change_type == ChangeType.REMOVED:
            diff_map[unique_id] = NodeDiff(change_status="removed")
        elif change_type == ChangeType.ADDED:
            diff_map[unique_id] = NodeDiff(change_status="added")

    return LineageDiff(
        base=build_lineage_from_models(base_models),
        current=build_lineage_from_models(curr_models),
        diff=diff_map,
    )


def get_modified_model_names(
    base_models: Dict[str, ModelInfo], curr_models: Dict[str, ModelInfo], include_downstream: bool = False
) -> List[str]:
    """
    Get list of modified model names for easy iteration.

    Useful for running diff checks on all modified models.

    Args:
        base_models: Models from the base invocation
        curr_models: Models from the current invocation
        include_downstream: If True, include models downstream of modified ones

    Returns:
        List of model names (not unique_ids) that have changed
    """
    changes = list_modified_nodes(base_models, curr_models)
    modified_ids = {uid for uid, _ in changes}

    if include_downstream:
        # Build child map from current models
        child_map = {}
        for unique_id, model in curr_models.items():
            for parent_id in model.depends_on:
                if parent_id not in child_map:
                    child_map[parent_id] = []
                child_map[parent_id].append(unique_id)

        # BFS to find all downstream models
        queue = list(modified_ids)
        visited = set(modified_ids)
        while queue:
            current = queue.pop(0)
            for child_id in child_map.get(current, []):
                if child_id not in visited:
                    visited.add(child_id)
                    queue.append(child_id)
        modified_ids = visited

    # Convert unique_ids to names
    names = []
    for uid in modified_ids:
        model = curr_models.get(uid) or base_models.get(uid)
        if model:
            names.append(model.name)

    return names
