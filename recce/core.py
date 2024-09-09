import hashlib
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Callable, Dict, Optional, List

from recce.adapter.base import BaseAdapter
from recce.models import Check, Run
from recce.state import RecceState, RecceStateMetadata, GitRepoInfo, PullRequestInfo, RecceStateLoader

logger = logging.getLogger('uvicorn')


@dataclass
class RecceContext:
    review_mode: bool = False
    adapter_type: str = None
    adapter: BaseAdapter = None
    state_loader: RecceStateLoader = None
    review_state: RecceState = None
    runs: List[Run] = field(default_factory=list)
    checks: List[Check] = field(default_factory=list)

    @classmethod
    def load(cls, **kwargs):
        state_loader: RecceStateLoader = kwargs.get('state_loader')
        is_review_mode = kwargs.get('review', False)

        context = cls(
            review_mode=is_review_mode,
            state_loader=state_loader,
        )

        # Initiate the adapter
        if kwargs.get('sqlmesh', False):
            logger.warning('SQLMesh adapter is still in EXPERIMENTAL mode.')
            from recce.adapter.sqlmesh_adapter import SqlmeshAdapter
            context.adapter_type = 'sqlmesh'
            context.adapter = SqlmeshAdapter.load(**kwargs)
        else:
            from recce.adapter.dbt_adapter import DbtAdapter
            context.adapter_type = 'dbt'
            context.adapter = DbtAdapter.load(**kwargs)

        # Import state
        if state_loader:
            state = state_loader.load()
            if state:
                context.import_state(state)

            if is_review_mode:
                if not state:
                    raise Exception('The state file is required for review mode')
                context.review_state = state

        return context

    def get_model(self, model_id: str, base=False):
        return self.adapter.get_model(model_id, base=base)

    def get_node_name_by_id(self, unique_id: object) -> object:
        return self.adapter.get_node_name_by_id(unique_id)

    def generate_sql(self, sql_template: str, base: bool = False, context: Dict = {}):
        self.adapter.generate_sql(sql_template, base=base, context=context)

    def get_lineage(self, base: Optional[bool] = False):
        return self.adapter.get_lineage(base=base)

    def build_name_to_unique_id_index(self) -> Dict[str, str]:
        name_to_unique_id = {}
        curr = self.get_lineage(base=False)
        base = self.get_lineage(base=True)

        for unique_id, node in curr['nodes'].items():
            name_to_unique_id[node['name']] = unique_id
        for unique_id, node in base['nodes'].items():
            name_to_unique_id[node['name']] = unique_id
        return name_to_unique_id

    def start_monitor_artifacts(self, callback: Callable = None):
        self.adapter.start_monitor_artifacts(callback=callback)

    def stop_monitor_artifacts(self):
        self.adapter.stop_monitor_artifacts()

    def refresh_manifest(self, refresh_file_path: str = None):
        self.adapter.refresh(refresh_file_path)

    def export_state(self) -> RecceState:
        """
        Export the state to a RecceState object.
        """
        state = RecceState()
        state.metadata = RecceStateMetadata()

        # runs & checks
        state.runs = self.runs
        state.checks = self.checks

        # artifacts & git & pull_request. If in review mode, use the review state
        if self.review_mode:
            state.artifacts = self.review_state.artifacts
            state.git = self.review_state.git
            state.pull_request = self.review_state.pull_request
        else:
            state.artifacts = self.adapter.export_artifacts()
            git = GitRepoInfo.from_current_repositroy()
            if git:
                state.git = git

        return state

    def export_demo_state(self) -> RecceState:
        """
        Export the demo state to a RecceState object for the demo sites.
        """
        state = RecceState()
        state.metadata = RecceStateMetadata()

        # runs & checks
        state.runs = self.runs
        state.checks = self.checks
        state.artifacts = self.adapter.export_artifacts()
        git = GitRepoInfo.from_current_repositroy()
        if git:
            state.git = git
        pr = PullRequestInfo(url=os.getenv('RECCE_PR_URL'))
        state.pull_request = pr

        return state

    def sync_state(self, method: str):
        """
        Sync the state with the remote.

        :param method: merge, revert, overwrite

        """
        if method == 'merge':
            self.state_loader.refresh()
            self.import_state(self.state_loader.state, merge=True)
            state = self.export_state()
            self.state_loader.export(state)
        elif method == 'revert':
            self.state_loader.refresh()
            self.import_state(self.state_loader.state, merge=False)
        elif method == 'overwrite':
            state = self.export_state()
            self.state_loader.export(state)
        else:
            raise Exception(f'Unsupported method: {method}')

    def import_state(self, import_state: RecceState, merge: bool = True):
        """
        Import the state. It would
        1. Merge runs
        2. Merge checks
            2.1 If both checks are preset, use the new one
            2.2 If the check is not preset, append the check if not found
        """
        checks = list(import_state.checks)
        runs = list(import_state.runs)

        def _calculate_checksum(c: Check):
            payload = json.dumps({
                'name': c.name.strip(),
                'description': c.description.strip(),
                'type': str(c.type),
                'params': c.params,
                'view_options': c.view_options,
            }, sort_keys=True)
            return hashlib.sha256(payload.encode()).hexdigest()

        current_preset_check_checksums = {_calculate_checksum(c): index for index, c in enumerate(checks) if
                                          c.is_preset}

        # merge checks
        import_checks = 0
        if merge:
            for check in self.checks:
                if check.is_preset:
                    # Replace the preset check if the checksum is the same
                    check_checksum = _calculate_checksum(check)
                    if check_checksum in current_preset_check_checksums:
                        index = current_preset_check_checksums[check_checksum]
                        checks[index] = check
                    else:
                        checks.append(check)
                    import_checks += 1
                else:
                    for c in checks:
                        if c.check_id == check.check_id:
                            c.merge(check)
                            break
                    else:
                        # Merge the check
                        checks.append(check)
                        import_checks += 1
        else:
            import_checks = len(checks)

        # merge runs
        import_runs = 0
        if merge:
            current_run_ids = {str(run.run_id) for run in runs}
            for run in self.runs:
                if str(run.run_id) not in current_run_ids:
                    runs.append(run)
                    import_runs += 1
        else:
            import_runs = len(runs)

        runs.sort(key=lambda x: x.run_at)

        self.checks = checks
        self.runs = runs

        # merge artifacts
        if self.adapter:
            self.adapter.import_artifacts(import_state.artifacts)

        return import_runs, import_checks


recce_context: Optional[RecceContext] = None


def load_context(**kwargs) -> RecceContext:
    global recce_context
    if recce_context is None:
        recce_context = RecceContext.load(**kwargs)
    return recce_context


def default_context() -> RecceContext:
    global recce_context
    return recce_context


def set_default_context(context: RecceContext):
    """
    Set the default context for the recce. This is for test purpose.
    """

    global recce_context
    recce_context = context
