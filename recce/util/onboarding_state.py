from enum import Enum
from typing import Union

from recce.util.recce_cloud import (
    get_recce_cloud_onboarding_state,
    set_recce_cloud_onboarding_state,
)


class OnboardingState(Enum):
    NEW = "signup_successful"
    LAUNCHED = "launched_with_token"
    LAUNCHED_WITH_TWO_ENVS = "configure_two_env"


def update_onboarding_state(api_token: Union[str, bool, None], is_single_env: bool) -> OnboardingState:
    if api_token:
        # existing onboarding_state values -> new, launched, launched_with_two_envs
        #   new -> launched
        #   new -> launched_with_two_envs
        #   launched -> launched_with_two_envs
        cloud_onboarding_state = get_recce_cloud_onboarding_state(api_token)

        if cloud_onboarding_state == OnboardingState.NEW.value:
            # User has an API Token and is a "new" user
            if is_single_env:
                # Mark the onboarding state as "launched" if the user is new
                set_recce_cloud_onboarding_state(api_token, OnboardingState.LAUNCHED.value)
                return OnboardingState.LAUNCHED
            else:
                set_recce_cloud_onboarding_state(api_token, OnboardingState.LAUNCHED_WITH_TWO_ENVS.value)
                return OnboardingState.LAUNCHED_WITH_TWO_ENVS
        elif cloud_onboarding_state == OnboardingState.LAUNCHED.value:
            # User has an API Token and has Two Environments
            if is_single_env:
                # Just return the current state
                return OnboardingState.LAUNCHED
            else:
                set_recce_cloud_onboarding_state(api_token, OnboardingState.LAUNCHED_WITH_TWO_ENVS.value)
                return OnboardingState.LAUNCHED_WITH_TWO_ENVS
        elif cloud_onboarding_state == OnboardingState.LAUNCHED_WITH_TWO_ENVS.value:
            # Just return the current state
            return OnboardingState.LAUNCHED_WITH_TWO_ENVS

    return OnboardingState.NEW
