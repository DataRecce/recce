from recce.models.state import recce_state
from .types import Run


class RunDAO:
    def create(self, run: Run):
        recce_state.runs.append(run)

    def find_run_by_id(self, run_id):
        for _run in recce_state.runs:
            if str(run_id) == str(_run.run_id):
                return _run

        return None

    def list(self):
        return recce_state.runs

    def list_by_check_id(self, check_id):
        runs = []
        for run in recce_state.runs:
            if str(check_id) == str(run.check_id):
                runs.append(run)
        return runs
