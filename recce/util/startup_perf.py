import functools
import os
import time
from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class StartupPerfTracker:
    """
    Tracks startup performance metrics for Recce server.

    Timing metrics are recorded in nanoseconds internally but converted
    to milliseconds in to_dict() for consistency with other trackers.
    """

    # Total startup timing
    _total_start: Optional[int] = None
    total_elapsed_ms: Optional[float] = None

    # Server lifespan setup (manual timing - wraps multiple calls)
    _server_setup_start: Optional[int] = None
    server_setup_elapsed_ms: Optional[float] = None

    # All phase/artifact timings (populated by @track_timing decorator)
    timings: Dict[str, float] = field(default_factory=dict)

    # Metadata
    cloud_mode: bool = False
    adapter_type: Optional[str] = None
    catalog_type: Optional[str] = None  # github, preview, session

    # Artifact sizes (in bytes)
    base_manifest_size: Optional[int] = None
    base_catalog_size: Optional[int] = None
    curr_manifest_size: Optional[int] = None
    curr_catalog_size: Optional[int] = None

    # Node counts
    base_node_count: Optional[int] = None
    curr_node_count: Optional[int] = None

    # --- Total timing ---
    def start_total(self):
        self._total_start = time.perf_counter_ns()

    def end_total(self):
        if self._total_start is not None:
            self.total_elapsed_ms = (time.perf_counter_ns() - self._total_start) / 1_000_000

    # --- Server setup (manual - wraps multiple calls in async context) ---
    def start_server_setup(self):
        self._server_setup_start = time.perf_counter_ns()

    def end_server_setup(self):
        if self._server_setup_start is not None:
            self.server_setup_elapsed_ms = (time.perf_counter_ns() - self._server_setup_start) / 1_000_000

    # --- Generic timing recording ---
    def record_timing(self, name: str, elapsed_ms: float):
        """Record timing for a named phase or artifact"""
        self.timings[name] = elapsed_ms

    # --- Metadata setters ---
    def set_cloud_mode(self, cloud_mode: bool):
        self.cloud_mode = cloud_mode

    def set_adapter_type(self, adapter_type: str):
        self.adapter_type = adapter_type

    def set_catalog_type(self, catalog_type: str):
        self.catalog_type = catalog_type

    def set_artifact_size(self, artifact_name: str, size_bytes: int):
        """Set artifact size by name"""
        if artifact_name == "base_manifest":
            self.base_manifest_size = size_bytes
        elif artifact_name == "base_catalog":
            self.base_catalog_size = size_bytes
        elif artifact_name == "curr_manifest":
            self.curr_manifest_size = size_bytes
        elif artifact_name == "curr_catalog":
            self.curr_catalog_size = size_bytes

    def set_node_counts(
        self,
        base_node_count: Optional[int] = None,
        curr_node_count: Optional[int] = None,
    ):
        if base_node_count is not None:
            self.base_node_count = base_node_count
        if curr_node_count is not None:
            self.curr_node_count = curr_node_count

    def to_dict(self) -> Dict:
        return {
            # Timing metrics (all in milliseconds)
            "total_elapsed_ms": self.total_elapsed_ms,
            "server_setup_elapsed_ms": self.server_setup_elapsed_ms,
            "timings": self.timings if self.timings else None,
            # Metadata
            "cloud_mode": self.cloud_mode,
            "adapter_type": self.adapter_type,
            "catalog_type": self.catalog_type,
            # Sizes (in bytes)
            "base_manifest_size_bytes": self.base_manifest_size,
            "base_catalog_size_bytes": self.base_catalog_size,
            "curr_manifest_size_bytes": self.curr_manifest_size,
            "curr_catalog_size_bytes": self.curr_catalog_size,
            # Node counts
            "base_node_count": self.base_node_count,
            "curr_node_count": self.curr_node_count,
        }


# Module-level singleton for tracking startup across the call stack
_startup_tracker: Optional[StartupPerfTracker] = None


def get_startup_tracker() -> Optional[StartupPerfTracker]:
    """Get the global startup tracker instance"""
    return _startup_tracker


def set_startup_tracker(tracker: StartupPerfTracker):
    """Set the global startup tracker instance"""
    global _startup_tracker
    _startup_tracker = tracker


def clear_startup_tracker():
    """Clear the global startup tracker instance"""
    global _startup_tracker
    _startup_tracker = None


def track_timing(timing_name: str = None, *, record_size: bool = False):
    """
    Decorator factory to track timing for any operation.

    Args:
        timing_name: Name for the timing. If None, expects 'timing_name' kwarg at call time.
        record_size: If True, record file size from 'path' kwarg.

    Usage:
        # Name at decoration time
        @track_timing("state_loader_init")
        def create_state_loader_by_args(...):
            ...

        # Name at call time (for reusable functions)
        @track_timing(record_size=True)
        def load_manifest(path=None, data=None):
            ...

        load_manifest(path=p, timing_name="curr_manifest")
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Get timing name from decorator arg or from kwargs
            name = timing_name
            if name is None:
                name = kwargs.pop("timing_name", None)

            path = kwargs.get("path") or (args[0] if args else None)

            start = time.perf_counter_ns()
            result = func(*args, **kwargs)
            elapsed_ms = (time.perf_counter_ns() - start) / 1_000_000

            if tracker := get_startup_tracker():
                if name:
                    tracker.record_timing(name, elapsed_ms)
                if record_size and name and path and os.path.exists(path):
                    tracker.set_artifact_size(name, os.path.getsize(path))

            return result

        return wrapper

    return decorator
