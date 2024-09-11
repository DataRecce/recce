from typing import Optional, List

from recce.exceptions import RecceException
from .types import Check


class CheckDAO:
    """
    Data Access Object for Check. Currently, we store runs in memory, in the future, we can store them in a database.
    """

    @property
    def _checks(self):
        from recce.core import default_context
        return default_context().checks

    def create(self, check) -> None:
        self._checks.append(check)

    def find_check_by_id(self, check_id) -> Optional[Check]:
        for check in self._checks:
            if str(check_id) == str(check.check_id):
                return check

        return None

    def delete(self, check_id) -> bool:
        for check in self._checks:
            if str(check_id) == str(check.check_id):
                self._checks.remove(check)
                return True

        return False

    def list(self) -> List[Check]:
        return list(self._checks)

    def reorder(self, source: int, destination: int):

        if source < 0 or source >= len(self._checks):
            raise RecceException('Failed to reorder checks. Source index out of range')

        if destination < 0 or destination >= len(self._checks):
            raise RecceException('Failed to reorder checks. Destination index out of range')

        check_to_move = self._checks.pop(source)
        self._checks.insert(destination, check_to_move)

    def clear(self):
        self._checks.clear()

    def status(self):
        return {
            'total': len(self._checks),
            'approved': len([c for c in self._checks if c.is_checked])
        }
