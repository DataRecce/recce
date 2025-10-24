import time
from dataclasses import dataclass


@dataclass
class LineagePerfTracker:
    lineage_start = None
    lineage_elapsed = None
    column_lineage_start = None
    column_lineage_elapsed = None

    total_nodes = None
    model_nodes = None
    source_nodes = None
    init_nodes = None
    cll_nodes = 0
    change_analysis_nodes = 0
    anchor_nodes = None
    change_status = None  # Dict with 'models' and 'sources', each with new/modified/unchanged counts

    params = None

    def start_lineage(self):
        self.lineage_start = time.perf_counter_ns()

    def end_lineage(self):
        if self.lineage_start is None:
            return
        self.lineage_elapsed = (time.perf_counter_ns() - self.lineage_start) / 1000000

    def start_column_lineage(self):
        self.column_lineage_start = time.perf_counter_ns()

    def end_column_lineage(self):
        if self.column_lineage_start is None:
            return
        self.column_lineage_elapsed = (time.perf_counter_ns() - self.column_lineage_start) / 1000000

    def set_total_nodes(self, total_nodes):
        self.total_nodes = total_nodes

    def set_model_nodes(self, model_nodes):
        self.model_nodes = model_nodes

    def set_source_nodes(self, source_nodes):
        self.source_nodes = source_nodes

    def set_init_nodes(self, init_nodes):
        self.init_nodes = init_nodes

    def set_anchor_nodes(self, anchor_nodes):
        self.anchor_nodes = anchor_nodes

    def increment_cll_nodes(self):
        self.cll_nodes += 1

    def increment_change_analysis_nodes(self):
        self.change_analysis_nodes += 1

    def set_change_status(self, change_status):
        self.change_status = change_status

    def set_params(self, has_node, has_column, change_analysis, no_cll, no_upstream, no_downstream):
        self.params = {
            "has_node": has_node,
            "has_column": has_column,
            "change_analysis": change_analysis,
            "no_cll": no_cll,
            "no_upstream": no_upstream,
            "no_downstream": no_downstream,
        }

    def to_dict(self):
        return {
            "lineage_elapsed_ms": self.lineage_elapsed,
            "column_lineage_elapsed_ms": self.column_lineage_elapsed,
            "total_nodes": self.total_nodes,
            "model_nodes": self.model_nodes,
            "source_nodes": self.source_nodes,
            "init_nodes": self.init_nodes,
            "cll_nodes": self.cll_nodes,
            "change_analysis_nodes": self.change_analysis_nodes,
            "anchor_nodes": self.anchor_nodes,
            "params": self.params,
            "change_status": self.change_status,
        }

    def reset(self):
        self.lineage_start = None
        self.lineage_elapsed = None
        self.column_lineage_start = None
        self.column_lineage_elapsed = None

        self.total_nodes = None
        self.model_nodes = None
        self.source_nodes = None
        self.init_nodes = None
        self.change_analysis_nodes = 0
        self.cll_nodes = 0
        self.anchor_nodes = 0
        self.change_status = None

        self.params = None
