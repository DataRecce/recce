from abc import ABC, abstractmethod

from recce.dbt import default_dbt_context
from recce.exceptions import RecceCancelException, RecceException


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

    def pre_execute(self):
        """
        Pre-execute the run. Subclass should override this method to implement the pre-execution logic.
        """
        dbt_context = default_dbt_context()
        if dbt_context.adapter is None:
            raise RecceException("Recce Server is not launched under DBT project folder.")
        pass

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
