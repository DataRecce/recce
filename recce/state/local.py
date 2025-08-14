import logging
import os
from typing import Optional, Tuple, Union

from .state import RecceState
from .state_loader import RecceStateLoader

logger = logging.getLogger("uvicorn")


class FileStateLoader(RecceStateLoader):
    def __init__(
        self,
        review_mode: bool = False,
        state_file: Optional[str] = None,
        initial_state: Optional[RecceState] = None,
    ):
        super().__init__(review_mode=review_mode, state_file=state_file, initial_state=initial_state)

    def verify(self) -> bool:
        if self.review_mode is True and self.state_file is None:
            self.error_message = "Recce can not launch without a state file."
            self.hint_message = "Please provide a state file in the command argument."
            return False
        return True

    def _load_state(self) -> Tuple[RecceState, str]:
        state = RecceState.from_file(self.state_file) if self.state_file else None
        state_tag = None
        return state, state_tag

    def _export_state(self, state: RecceState = None) -> Tuple[Union[str, None], str]:
        """
        Store the state to a file. Store happens when terminating the server or run instance.
        """

        if self.state_file is None:
            return "No state file is provided. Skip storing the state.", None

        logger.info(f"Store recce state to '{self.state_file}'")
        message = self._export_state_to_file(self.state_file)
        tag = None

        return message, tag

    def purge(self) -> bool:
        if self.state_file is not None:
            try:
                os.remove(self.state_file)
                return True
            except Exception as e:
                self.error_message = f"Failed to remove the state file: {e}"
                return False
        else:
            self.error_message = "No state file is provided. Skip removing the state file."
            return False
