from typing import Optional, List

from recce.exceptions import RecceException
from .types import Check

_checks: List[Check] = []


class CheckDAO:
    """
    Data Access Object for Check. Currently, we store runs in memory, in the future, we can store them in a database.
    """

    def create(self, check) -> None:
        _checks.append(check)

    def find_check_by_id(self, check_id) -> Optional[Check]:
        for check in _checks:
            if str(check_id) == str(check.check_id):
                return check

        return None

    def delete(self, check_id) -> bool:
        for check in _checks:
            if str(check_id) == str(check.check_id):
                _checks.remove(check)
                return True

        return False

    def list(self) -> List[Check]:
        return list(_checks)

    def reorder(self, source: int, destination: int):

        if source < 0 or source >= len(_checks):
            raise RecceException('Failed to reorder checks. Source index out of range')

        if destination < 0 or destination >= len(_checks):
            raise RecceException('Failed to reorder checks. Destination index out of range')

        check_to_move = _checks.pop(source)
        _checks.insert(destination, check_to_move)


def load_checks(checks: List[Check]):
    global _checks
    _checks = checks
