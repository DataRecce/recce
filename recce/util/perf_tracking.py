from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from recce.util.base_perf_tracker import PerformanceTracker


@dataclass
class LineagePerfTracker(PerformanceTracker):
    total_nodes: Optional[int] = None
    init_nodes: Optional[int] = None
    cll_nodes: int = 0
    change_analysis_nodes: int = 0
    anchor_nodes: Optional[int] = None
    params: Optional[Dict[str, Any]] = None

    def start_lineage(self):
        self._start_timer("lineage")

    def end_lineage(self):
        self._end_timer("lineage")

    def start_column_lineage(self):
        self._start_timer("column_lineage")

    def end_column_lineage(self):
        self._end_timer("column_lineage")

    def set_total_nodes(self, total_nodes):
        self.total_nodes = total_nodes

    def set_init_nodes(self, init_nodes):
        self.init_nodes = init_nodes

    def set_anchor_nodes(self, anchor_nodes):
        self.anchor_nodes = anchor_nodes

    def increment_cll_nodes(self):
        self.cll_nodes += 1

    def increment_change_analysis_nodes(self):
        self.change_analysis_nodes += 1

    def set_params(self, has_node, has_column, change_analysis, no_cll, no_upstream, no_downstream):
        self.params = {
            "has_node": has_node,
            "has_column": has_column,
            "change_analysis": change_analysis,
            "no_cll": no_cll,
            "no_upstream": no_upstream,
            "no_downstream": no_downstream,
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "lineage_elapsed_ms": self._get_elapsed("lineage"),
            "column_lineage_elapsed_ms": self._get_elapsed("column_lineage"),
            "total_nodes": self.total_nodes,
            "init_nodes": self.init_nodes,
            "cll_nodes": self.cll_nodes,
            "change_analysis_nodes": self.change_analysis_nodes,
            "anchor_nodes": self.anchor_nodes,
            "params": self.params,
        }

    def reset(self):
        self._reset_timers()
        self.total_nodes = None
        self.init_nodes = None
        self.change_analysis_nodes = 0
        self.cll_nodes = 0
        self.anchor_nodes = 0
        self.params = None
