from enum import Enum

from recce.util.recce_cloud import (
    get_recce_cloud_onboarding_state,
    set_recce_cloud_onboarding_state,
)


class OnboardingState(Enum):
    NEW = 1
    LAUNCHED = 2
    LAUNCHED_WITH_TWO_ENVS = 3


def update_onboarding_state(api_token: str | bool | None, is_single_env: bool) -> OnboardingState:
    if api_token:
        # existing onboarding_state values -> new, launched, launched_with_two_envs
        #   new -> launched
        #   new -> launched_with_two_envs
        #   launched -> launched_with_two_envs
        cloud_onboarding_state = get_recce_cloud_onboarding_state(api_token)

        if cloud_onboarding_state == "new":
            # User has an API Token and is a "new" user
            if is_single_env:
                # Mark the onboarding state as "launched" if the user is new
                set_recce_cloud_onboarding_state(api_token, "launched")
                return OnboardingState.LAUNCHED
            else:
                set_recce_cloud_onboarding_state(api_token, "launched_with_two_envs")
                return OnboardingState.LAUNCHED_WITH_TWO_ENVS
        elif cloud_onboarding_state == "launched":
            # User has an API Token and has Two Environments
            if is_single_env:
                # Just return the current state
                return OnboardingState.LAUNCHED
            else:
                set_recce_cloud_onboarding_state(api_token, "launched_with_two_envs")
                return OnboardingState.LAUNCHED_WITH_TWO_ENVS
        elif cloud_onboarding_state == "launched_with_two_envs":
            # Just return the current state
            return OnboardingState.LAUNCHED_WITH_TWO_ENVS

    return OnboardingState.NEW
