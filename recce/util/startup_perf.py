import functools
import os
import time
from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class StartupPerfTracker:
    """
    Tracks startup performance metrics for Recce server.
    All timing values are in milliseconds.
    """

    # All timings in ms (populated by @track_timing decorator)
    timings: Dict[str, float] = field(default_factory=dict)

    # Artifact sizes in bytes
    artifact_sizes: Dict[str, int] = field(default_factory=dict)

    # Metadata
    cloud_mode: bool = False
    catalog_type: Optional[str] = None  # github, preview, session
    adapter_type: Optional[str] = None
    node_count: Optional[int] = None
    command: Optional[str] = None  # server, read-only, preview

    def record_timing(self, name: str, elapsed_ms: float):
        """Record timing for a named phase or artifact"""
        self.timings[name] = elapsed_ms

    def set_cloud_mode(self, cloud_mode: bool):
        self.cloud_mode = cloud_mode

    def set_catalog_type(self, catalog_type: str):
        self.catalog_type = catalog_type

    def set_artifact_size(self, name: str, size_bytes: int):
        """Set artifact size by name"""
        self.artifact_sizes[name] = size_bytes

    def to_dict(self) -> Dict:
        return {
            "timings": self.timings if self.timings else None,
            "artifact_sizes": self.artifact_sizes if self.artifact_sizes else None,
            "cloud_mode": self.cloud_mode,
            "catalog_type": self.catalog_type,
            "adapter_type": self.adapter_type,
            "node_count": self.node_count,
            "command": self.command,
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
