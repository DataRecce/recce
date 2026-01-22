import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class PerformanceTracker(ABC):
    """
    Base class for performance tracking with timing methods.

    Subclasses should define their specific counters and checkpoints,
    then use _start_timer(), _end_timer(), and _record_checkpoint()
    for timing operations.
    """
    _timers: Dict[str, Optional[int]] = field(default_factory=dict, repr=False)
    _elapsed: Dict[str, Optional[float]] = field(default_factory=dict, repr=False)
    _checkpoints: Dict[str, float] = field(default_factory=dict, repr=False)

    def _start_timer(self, name: str) -> None:
        """Start a timer with the given name."""
        self._timers[name] = time.perf_counter_ns()

    def _end_timer(self, name: str) -> None:
        """End a timer and store the elapsed time in milliseconds."""
        start_time = self._timers.get(name)
        if start_time is None:
            return
        self._elapsed[name] = (time.perf_counter_ns() - start_time) / 1000000

    def _get_elapsed(self, name: str) -> Optional[float]:
        """Get the elapsed time in milliseconds for a timer."""
        return self._elapsed.get(name)

    def _record_checkpoint(self, label: str, base_timer: str) -> None:
        """Record a checkpoint relative to a base timer's start time."""
        start_time = self._timers.get(base_timer)
        if start_time is None:
            return
        self._checkpoints[label] = (time.perf_counter_ns() - start_time) / 1000000

    def _reset_timers(self) -> None:
        """Reset all timers and elapsed times."""
        self._timers.clear()
        self._elapsed.clear()
        self._checkpoints.clear()

    @abstractmethod
    def to_dict(self) -> Dict[str, Any]:
        """Return a dictionary representation of the tracker's data."""
        pass

    @abstractmethod
    def reset(self) -> None:
        """Reset all tracking data."""
        pass
