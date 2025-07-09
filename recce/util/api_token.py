import click
from rich.console import Console

from recce import event
from recce.event import get_recce_api_token, update_recce_api_token
from recce.exceptions import RecceConfigException
from recce.util.recce_cloud import (
    RECCE_CLOUD_BASE_URL,
    RecceCloud,
)

console = Console()


def show_invalid_api_token_message():
    """
    Show the message when the API token is invalid.
    """
    console.print("[[red]Error[/red]] Invalid Recce Cloud API token.")
    console.print("Please associate with your Recce Cloud account by the following command 'recce connect-to-cloud'.")
    console.print(
        "For more information, please visit: https://docs.reccehq.com/recce-cloud/share-recce-session-securely/#configure-recce-cloud-association-manually")


def prepare_api_token(
    interaction=False,
    **kwargs,
):
    """
    Prepare the API token for the request.
    """
    # Verify the API token for Recce Cloud Share Link
    api_token = get_recce_api_token()
    new_api_token = kwargs.get("api_token")
    if api_token != new_api_token and new_api_token is not None:
        # Handle the API token provided by option `--api-token`
        valid = RecceCloud(new_api_token).verify_token()
        if not valid:
            raise RecceConfigException("Invalid Recce Cloud API token")
        event.log_connected_to_cloud()
        api_token = new_api_token
        update_recce_api_token(api_token)
        console.print(
            "[[green]Success[/green]] User profile has been updated to include the Recce Cloud API Token. "
            "You no longer need to append --api-token to the recce command"
        )
    elif api_token:
        # Verify the API token from the user profile
        valid = RecceCloud(api_token).verify_token()
        if not valid:
            console.print("[[yellow]Warning[/yellow]] Invalid Recce Cloud API token. Skipping the share link.")
            api_token = None
        if valid:
            event.log_connected_to_cloud()
    else:
        # No api_token provided
        if interaction:
            console.print(
                "An API token is required for this feature. This can be obtained in your user account settings.\n"
                f"{RECCE_CLOUD_BASE_URL}/settings#tokens\n"
                "Your API token can be added to '~/.recce/profile.yml' for more convenient sharing."
            )
            api_token = click.prompt("Your Recce API token", type=str, hide_input=True, show_default=False)
            valid = RecceCloud(api_token).verify_token()
            if not valid:
                raise RecceConfigException("Invalid Recce Cloud API token")
            update_recce_api_token(api_token)
            console.print(
                "[[green]Success[/green]] User profile has been updated to include the Recce Cloud API Token. "
                "You no longer need to append --api-token to the recce command"
            )

    return api_token
