import logging
import threading
import time
from abc import ABC, abstractmethod
from typing import Dict, Literal, Optional, Tuple, Union, final

from recce.exceptions import RecceException
from recce.pull_request import fetch_pr_metadata

from ..util.io import SupportedFileTypes, file_io_factory
from .const import (
    RECCE_CLOUD_TOKEN_MISSING,
)
from .state import RecceState

logger = logging.getLogger("uvicorn")


class RecceStateLoader(ABC):
    def __init__(
        self,
        review_mode: bool = False,
        cloud_mode: bool = False,
        state_file: Optional[str] = None,
        cloud_options: Optional[Dict[str, str]] = None,
        initial_state: Optional[RecceState] = None,
    ):
        self.review_mode = review_mode
        self.cloud_mode = cloud_mode
        self.state_file = state_file
        self.cloud_options = cloud_options or {}
        self.error_message = None
        self.hint_message = None
        self.state: RecceState | None = initial_state
        self.state_lock = threading.Lock()
        self.state_etag = None
        self.pr_info = None
        self.catalog: Literal["github", "preview", "snapshot"] = "github"
        self.share_id = None
        self.snapshot_id = None

        if self.cloud_mode:
            if self.cloud_options.get("github_token"):
                self.catalog = "github"
                self.pr_info = fetch_pr_metadata(
                    cloud=self.cloud_mode, github_token=self.cloud_options.get("github_token")
                )
                if self.pr_info.id is None:
                    raise RecceException("Cannot get the pull request information from GitHub.")
            elif self.cloud_options.get("api_token"):
                if self.cloud_options.get("snapshot_id"):
                    self.catalog = "snapshot"
                    self.snapshot_id = self.cloud_options.get("snapshot_id")
                else:
                    self.catalog = "preview"
                    self.share_id = self.cloud_options.get("share_id")
            else:
                raise RecceException(RECCE_CLOUD_TOKEN_MISSING.error_message)

    @property
    def token(self):
        return self.cloud_options.get("github_token") or self.cloud_options.get("api_token")

    @abstractmethod
    def verify(self) -> bool:
        """
        Verify the state loader configuration.
        Returns:
            bool: True if the configuration is valid, False otherwise.
        """
        raise NotImplementedError("Subclasses must implement this method.")

    @property
    def error_and_hint(self) -> (Union[str, None], Union[str, None]):
        return self.error_message, self.hint_message

    def update(self, state: RecceState):
        self.state = state

    @final
    def load(self, refresh=False) -> RecceState:
        if self.state is not None and refresh is False:
            return self.state
        self.state_lock.acquire()
        try:
            self.state, self.state_etag = self._load_state()
        finally:
            self.state_lock.release()
        return self.state

    @abstractmethod
    def _load_state(self) -> Tuple[RecceState, str]:
        """
        Load the state from the specified source (file or cloud).
        Returns:
            RecceState: The loaded state object.
            str: The etag of the state file (if applicable).
        """
        raise NotImplementedError("Subclasses must implement this method.")

    def save_as(self, state_file: str, state: RecceState = None):
        if self.cloud_mode:
            raise Exception("Cannot save the state to Recce Cloud.")

        self.state_file = state_file
        self.export(state)

    @final
    def export(self, state: RecceState = None) -> Union[str, None]:
        if state is not None:
            self.update(state)

        start_time = time.time()
        self.state_lock.acquire()
        try:
            message, state_etag = self._export_state()
            self.state_etag = state_etag
            end_time = time.time()
            elapsed_time = end_time - start_time
        finally:
            self.state_lock.release()
        logger.info(f"Store state completed in {elapsed_time:.2f} seconds")
        return message

    @abstractmethod
    def _export_state(self) -> Tuple[Union[str, None], str]:
        """
        Export the current Recce state to a file or cloud storage.
        Returns:
            str: A message indicating the result of the export operation.
            str: The etag of the exported state file (if applicable).
        """
        raise NotImplementedError("Subclasses must implement this method.")

    def _export_state_to_file(self, file_path: str, file_type: SupportedFileTypes = SupportedFileTypes.FILE) -> str:
        """
        Store the state to a file. Store happens when terminating the server or run instance.
        """

        json_data = self.state.to_json()
        io = file_io_factory(file_type)

        io.write(file_path, json_data)
        return f"The state file is stored at '{file_path}'"

    def refresh(self):
        new_state = self.load(refresh=True)
        return new_state

    def check_conflict(self) -> bool:
        return False

    def info(self) -> dict:
        if self.state is None:
            self.error_message = "No state is loaded."
            return None

        state_info = {
            "mode": "cloud" if self.cloud_mode else "local",
            "source": None,
        }
        if self.cloud_mode:
            state_info["source"] = "Recce Cloud"
            state_info["pull_request"] = self.pr_info
        else:
            state_info["source"] = self.state_file
        return state_info

    @abstractmethod
    def purge(self) -> bool:
        """
        Purge the state file or cloud storage.
        Returns:
            bool: True if the purge was successful, False otherwise.
        """
        raise NotImplementedError("Subclasses must implement this method.")
