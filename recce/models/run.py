from .state import RecceState
from .types import Run


class RunDAO:
    def __init__(self, state: RecceState = None):
        from .state import recce_state
        self.state = state if state else recce_state

    def create(self, run: Run):
        self.state.runs.append(run)

    def find_run_by_id(self, run_id):
        for _run in self.state.runs:
            if str(run_id) == str(_run.run_id):
                return _run

        return None

    def list(self):
        return self.state.runs

    def list_by_check_id(self, check_id):
        runs = []
        for run in self.state.runs:
            if str(check_id) == str(run.check_id):
                runs.append(run)
        return runs
