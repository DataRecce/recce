from abc import ABC, abstractmethod
from typing import List, Literal, Optional, Union

from pydantic import BaseModel

from recce.core import default_context
from recce.exceptions import RecceCancelException
from recce.models import Check, Run
from recce.util.pydantic_model import pydantic_model_dump


class Task(ABC):
    def __init__(self):
        self.is_cancelled = False
        self._progress_listener = None

    @property
    def progress_listener(self):
        return self._progress_listener

    @progress_listener.setter
    def progress_listener(self, value):
        self._progress_listener = value

    @abstractmethod
    def execute(self):
        """
        Execute the run.
        """
        raise NotImplementedError()

    def cancel(self):
        """
        Cancel the run. Subclass should override this method to implement the cancellation logic.
        """
        self.is_cancelled = True

    def check_cancel(self):
        """
        Check if the run is canceled. If so, raise an exception.
        """

        if self.is_cancelled:
            raise RecceCancelException()

    def update_progress(self, message=None, percentage=None):
        if self.progress_listener is not None:
            self.progress_listener(message=message, percentage=percentage)


class TaskResultDiffer(ABC):
    related_node_ids: List[str] = None

    def __init__(self, run: Run):
        # Dump the result to a dict when we create summary from recce run
        if isinstance(run.result, BaseModel):
            run.result = pydantic_model_dump(run.result)
        self.run = run
        self.changes = self._check_result_changed_fn(run.result) if run.result else None
        self.related_node_ids = self._get_related_node_ids()
        self.changed_nodes = self._get_changed_nodes()

    @staticmethod
    def diff(base, current):
        from deepdiff import DeepDiff

        diff = DeepDiff(base, current, ignore_order=True)
        return diff if diff else None

    @staticmethod
    def get_node_id_by_name(name):
        node = default_context().adapter.get_node_by_name(name)
        return node.unique_id if node else None

    @staticmethod
    def get_node_ids_by_selector(
        select: Optional[str] = None,
        exclude: Optional[str] = None,
        packages: Optional[list[str]] = None,
        view_mode: Optional[Literal["all", "changed_models"]] = None,
    ) -> List[str]:
        nodes = default_context().adapter.select_nodes(
            select=select, exclude=exclude, packages=packages, view_mode=view_mode
        )
        return [node for node in nodes if not node.startswith("test.")]

    @abstractmethod
    def _check_result_changed_fn(self, result):
        """
        Check if the result is changed.
        Should be implemented by subclass.
        """
        raise NotImplementedError()

    def _get_related_node_ids(self) -> Union[List[str], None]:
        """
        Get the related node ids.
        Should be implemented by subclass.
        """
        params = self.run.params
        if params.get("model"):
            return [TaskResultDiffer.get_node_id_by_name(params.get("model"))]
        elif params.get("node_names"):
            names = params.get("node_names", [])
            return [TaskResultDiffer.get_node_id_by_name(name) for name in names]
        else:
            # No related node ids in the params
            return None

    def _get_changed_nodes(self) -> Union[List[str], None]:
        """
        Get the changed node ids.
        Should be implemented by subclass.
        """
        return None


class CheckValidator:
    def __init__(self):
        pass

    def validate(self, check: dict):
        try:
            check = Check(**check)
        except Exception as e:
            raise ValueError(f"Invalid check format. {str(e)}")

        self.validate_check(check)

    def validate_check(self, check: Check):
        """
        Validate the check. This is supposed to be overridden by subclass. Throw ValueError if the check is invalid.
        """
        pass
