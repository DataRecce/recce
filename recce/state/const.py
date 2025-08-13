from dataclasses import dataclass

RECCE_STATE_FILE = "recce-state.json"
RECCE_STATE_COMPRESSED_FILE = f"{RECCE_STATE_FILE}.gz"


@dataclass
class ErrorMessage:
    error_message: str
    hint_message: str


RECCE_CLOUD_TOKEN_MISSING = ErrorMessage(
    error_message="No GitHub token is provided to access the pull request information",
    hint_message="Please provide a GitHub token in the command argument",
)

RECCE_CLOUD_PASSWORD_MISSING = ErrorMessage(
    error_message="No password provided to access the state file in Recce Cloud",
    hint_message='Please provide a password with the option "--password <compress-password>"',
)

RECCE_API_TOKEN_MISSING = ErrorMessage(
    error_message="No Recc API token is provided",
    hint_message="Please login to Recce Cloud and copy the API token from the settings page",
)
