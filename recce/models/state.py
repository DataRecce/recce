from typing import List

from .types import Run, Check


class RecceState:

    def __init__(self):
        self.runs: List[Run] = []
        self.checks: List[Check] = []

    def store(self):
        pass

    def load(self):
        pass


recce_state = RecceState()
