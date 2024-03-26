from recce.models.state import RecceState
from recce.models.types import Lineage


class LineageDAO:
    def __init__(self, state: RecceState = None):
        from .state import recce_state
        self.state = state if state else recce_state

    def set(self, lineage: Lineage):
        self.state.lineage = lineage

    def get(self) -> Lineage:
        return self.state.lineage
