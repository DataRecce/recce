from dataclasses import dataclass

from tests.dbt_flags import temporarily_set_state_modified_compare_flag


@dataclass(frozen=True)
class FrozenFlags:
    """Mirror dbt 1.12's immutable flag object."""


def test_temporarily_set_state_modified_compare_flag_handles_frozen_flags(monkeypatch):
    flags = FrozenFlags()
    monkeypatch.setattr("tests.dbt_flags.get_flags", lambda: flags)

    restore = temporarily_set_state_modified_compare_flag()

    assert flags.state_modified_compare_more_unrendered_values is False
    restore()
    assert not hasattr(flags, "state_modified_compare_more_unrendered_values")
