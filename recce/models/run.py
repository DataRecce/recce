from typing import List

from .types import Run, RunType

_runs: List[Run] = []


class RunDAO:
    """
    Data Access Object for Run. Currently, we store runs in memory, in the future, we can store them in a database.
    """

    def create(self, run: Run):
        _runs.append(run)

    def find_run_by_id(self, run_id):
        for run in _runs:
            if str(run_id) == str(run.run_id):
                return run

        return None

    def list(self, type_filter: RunType = None):
        if type_filter:
            return list(filter(lambda run: run.type == type_filter, _runs))
        return list(_runs)

    def list_by_check_id(self, check_id):
        runs = []
        for run in _runs:
            if str(check_id) == str(run.check_id):
                runs.append(run)
        return runs

    def delete(self, run_id):
        for run in _runs:
            if str(run_id) == str(run.run_id):
                _runs.remove(run)
                return True

        return False

    def clear(self):
        _runs.clear()


def load_runs(runs: List[Run]):
    global _runs
    _runs = runs
