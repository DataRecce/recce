import click
from click import Abort
from rich.console import Console

from recce.event import get_recce_api_token, update_recce_api_token
from recce.util.recce_cloud import RecceCloud, get_recce_cloud_onboarding_state, set_recce_cloud_onboarding_state, \
    RECCE_CLOUD_BASE_URL

console = Console()


def show_invalid_api_token_message():
    """
    Show the message when the API token is invalid.
    """
    console.print("[[red]Error[/red]] Invalid Recce Cloud API token.")
    console.print(f"Please check your API token from {RECCE_CLOUD_BASE_URL}/settings#tokens")


def prepare_api_token(interaction=False, **kwargs, ) -> str | None:
    """
    Prepare the API token for the request.
    """
    # Verify the API token for Recce Clous Share Link
    api_token = get_recce_api_token()
    new_api_token = kwargs.get('api_token')
    if api_token != new_api_token and new_api_token is not None:
        # Handle the API token provided by option `--api-token`
        valid = RecceCloud(new_api_token).verify_token()
        if not valid:
            show_invalid_api_token_message()
            exit(1)
        api_token = new_api_token
        update_recce_api_token(api_token)
        console.print("[[green]Success[/green]] Update the user profile for Recce Cloud API Token.")
    elif api_token:
        # Verify the API token from the user profile
        valid = RecceCloud(api_token).verify_token()
        if not valid:
            console.print("[[yellow]Warning[/yellow]] Invalid Recce Cloud API token. Skipping the share link.")
            api_token = None
    else:
        # No api_token provided
        if interaction is True:
            console.print(
                "An API token is required to this. This can be obtained in your user account settings.\n"
                f"{RECCE_CLOUD_BASE_URL}/settings#tokens\n"
                "Your API token will be added to '~/.recce/profile.yml' for more convenient sharing."
            )
            try:
                api_token = click.prompt("Your Recce API token", type=str, hide_input=True, show_default=False)
            except Abort:
                console.print("[yellow]Aborted[/yellow]")
                exit(1)
            valid = RecceCloud(api_token).verify_token()
            if not valid:
                show_invalid_api_token_message()
                exit(1)
            update_recce_api_token(api_token)
            console.print("[[green]Success[/green]] Update the user profile for Recce Cloud API Token.")

    if api_token:
        cloud_onboarding_state = get_recce_cloud_onboarding_state(api_token)
        if cloud_onboarding_state == "new":
            # Mark the onboarding state as "installed" if the user is new
            set_recce_cloud_onboarding_state(api_token, "installed")

    return api_token
