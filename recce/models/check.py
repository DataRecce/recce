from typing import Optional, List

from recce.exceptions import RecceException
from .state import RecceState
from .types import Check


class CheckDAO:
    def __init__(self, state: RecceState = None):
        from .state import recce_state
        self.state = state if state else recce_state

    def create(self, check) -> None:
        self.state.checks.append(check)

    def find_check_by_id(self, check_id) -> Optional[Check]:
        for _check in self.state.checks:
            if str(check_id) == str(_check.check_id):
                return _check

        return None

    def delete(self, check_id) -> bool:
        for _check in self.state.checks:
            if str(check_id) == str(_check.check_id):
                self.state.checks.remove(_check)
                return True

        return False

    def list(self) -> List[Check]:
        return self.state.checks

    def reorder(self, source: int, destination: int):
        checks = self.state.checks

        if source < 0 or source >= len(checks):
            raise RecceException('Failed to reorder checks. Source index out of range')

        if destination < 0 or destination >= len(checks):
            raise RecceException('Failed to reorder checks. Destination index out of range')

        check_to_move = checks.pop(source)
        checks.insert(destination, check_to_move)
