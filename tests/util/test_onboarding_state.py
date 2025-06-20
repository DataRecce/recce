import unittest
from unittest.mock import patch

from recce.util.onboarding_state import OnboardingState


class OnboardingStateTest(unittest.TestCase):

    @patch("recce.util.onboarding_state.set_recce_cloud_onboarding_state")
    @patch("recce.util.onboarding_state.get_recce_cloud_onboarding_state", return_value=OnboardingState.NEW.value)
    def test_update_onboarding_state_sanity_check(self, mock_get_onboard, mock_set_onboard):
        from recce.util.onboarding_state import update_onboarding_state

        return_value = update_onboarding_state("some_token", True)
        self.assertEqual(True, isinstance(return_value, OnboardingState))

    @patch("recce.util.onboarding_state.set_recce_cloud_onboarding_state")
    @patch("recce.util.onboarding_state.get_recce_cloud_onboarding_state", return_value=OnboardingState.NEW.value)
    def test_update_onboarding_state_new_single_env_user(self, mock_get_onboard, mock_set_onboard):
        from recce.util.onboarding_state import update_onboarding_state

        return_value = update_onboarding_state("some_token", True)
        self.assertEqual(OnboardingState.LAUNCHED, return_value)

    @patch("recce.util.onboarding_state.set_recce_cloud_onboarding_state")
    @patch("recce.util.onboarding_state.get_recce_cloud_onboarding_state", return_value=OnboardingState.NEW.value)
    def test_update_onboarding_state_new_dual_env_user(self, mock_get_onboard, mock_set_onboard):
        from recce.util.onboarding_state import update_onboarding_state

        return_value = update_onboarding_state("some_token", False)
        self.assertEqual(OnboardingState.LAUNCHED_WITH_TWO_ENVS, return_value)

    @patch("recce.util.onboarding_state.set_recce_cloud_onboarding_state")
    @patch("recce.util.onboarding_state.get_recce_cloud_onboarding_state", return_value=OnboardingState.LAUNCHED.value)
    def test_update_onboarding_state_launched_single_env_user(self, mock_get_onboard, mock_set_onboard):
        from recce.util.onboarding_state import update_onboarding_state

        return_value = update_onboarding_state("some_token", True)
        self.assertEqual(OnboardingState.LAUNCHED, return_value)

    @patch("recce.util.onboarding_state.set_recce_cloud_onboarding_state")
    @patch("recce.util.onboarding_state.get_recce_cloud_onboarding_state", return_value=OnboardingState.LAUNCHED.value)
    def test_update_onboarding_state_launched_dual_env_user(self, mock_get_onboard, mock_set_onboard):
        from recce.util.onboarding_state import update_onboarding_state

        return_value = update_onboarding_state("some_token", False)
        self.assertEqual(OnboardingState.LAUNCHED_WITH_TWO_ENVS, return_value)

    @patch("recce.util.onboarding_state.set_recce_cloud_onboarding_state")
    @patch(
        "recce.util.onboarding_state.get_recce_cloud_onboarding_state",
        return_value=OnboardingState.LAUNCHED_WITH_TWO_ENVS.value,
    )
    def test_update_onboarding_state_launched_with_two_envs_single_env_user(self, mock_get_onboard, mock_set_onboard):
        from recce.util.onboarding_state import update_onboarding_state

        return_value = update_onboarding_state("some_token", True)
        self.assertEqual(OnboardingState.LAUNCHED_WITH_TWO_ENVS, return_value)

    @patch("recce.util.onboarding_state.set_recce_cloud_onboarding_state")
    @patch(
        "recce.util.onboarding_state.get_recce_cloud_onboarding_state",
        return_value=OnboardingState.LAUNCHED_WITH_TWO_ENVS.value,
    )
    def test_update_onboarding_state_launched_with_two_envs_dual_env_user(self, mock_get_onboard, mock_set_onboard):
        from recce.util.onboarding_state import update_onboarding_state

        return_value = update_onboarding_state("some_token", False)
        self.assertEqual(OnboardingState.LAUNCHED_WITH_TWO_ENVS, return_value)
