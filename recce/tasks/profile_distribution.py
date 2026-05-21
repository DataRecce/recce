"""Paired column-distribution task — PR 1 stub (DRC-3390).

This file is the registration anchor for ``RunType.PROFILE_DISTRIBUTION``.
PR 1 (the polyglot foundation) ships only the wire: the run type, the CLI
flag, the per-dialect SQL renderers, and the capability table. PR 2 wires
the ``approx_all`` pipeline that fills in this task's :meth:`execute`.

The stub returns an empty payload tagged ``status: "ok"`` so end-to-end flag
plumbing can be validated before PR 2 lands.
"""

from typing import List, Optional

from pydantic import BaseModel

from recce.tasks import Task


class ProfileDistributionParams(BaseModel):
    """Input parameters for the profile-distribution task."""

    model: str
    columns: Optional[List[str]] = None


class ProfileDistributionTask(Task):
    """Stub for the paired-distribution backend task.

    PR 2 replaces the body of :meth:`execute` with the ``approx_all`` pipeline
    (HLL probe + ``APPROX_PERCENTILE`` per env + ``APPROX_TOP_K`` per env)
    composed from :mod:`recce.adapter.approx_aggregates` and gated on
    :func:`recce.adapter.capabilities.detect_capabilities`.
    """

    def __init__(self, params):
        super().__init__()
        self.params = ProfileDistributionParams(**params)

    def execute(self):
        return {
            "columns": {},
            "status": "ok",
        }
