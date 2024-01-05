from abc import ABC, abstractmethod

from recce.exceptions import RecceCancelException


class Task(ABC):
    def __init__(self):
        self.isCancelled = False

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
        self.isCancelled = True

    def check_cancel(self):
        """
        Check if the run is canceled. If so, raise an exception.
        """

        if self.isCancelled:
            raise RecceCancelException()
