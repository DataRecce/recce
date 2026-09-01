from dataclasses import dataclass

import pytest

from tests.dbt_flags import temporarily_set_state_modified_compare_flag


@dataclass(frozen=True)
class FrozenFlags:
    """Mirror dbt 1.12's immutable flag object, before set_from_args."""


@dataclass(frozen=True)
class FrozenFlagsWithValue:
    """The shape real dbt produces: get_flags() after set_from_args already
    carries the attribute, so the restore path that actually fires in a test
    run is the `had_flag` one."""

    state_modified_compare_more_unrendered_values: bool = True


def test_absent_flag_is_deleted_on_restore(monkeypatch):
    flags = FrozenFlags()
    monkeypatch.setattr("tests.dbt_flags.get_flags", lambda: flags)

    restore = temporarily_set_state_modified_compare_flag()

    assert flags.state_modified_compare_more_unrendered_values is False
    restore()
    assert not hasattr(flags, "state_modified_compare_more_unrendered_values")


@pytest.mark.parametrize("previous", [True, False], ids=["was-true", "was-false"])
def test_pre_existing_flag_is_restored_not_deleted(monkeypatch, previous: bool):
    """Deleting a real dbt flag instead of restoring it leaks mutated global
    state into every later test in the process."""
    flags = FrozenFlagsWithValue(state_modified_compare_more_unrendered_values=previous)
    monkeypatch.setattr("tests.dbt_flags.get_flags", lambda: flags)

    restore = temporarily_set_state_modified_compare_flag()

    assert flags.state_modified_compare_more_unrendered_values is False
    restore()
    assert hasattr(flags, "state_modified_compare_more_unrendered_values")
    assert flags.state_modified_compare_more_unrendered_values is previous
