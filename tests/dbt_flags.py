from collections.abc import Callable

from dbt.flags import get_flags


def temporarily_set_state_modified_compare_flag() -> Callable[[], None]:
    """Set dbt's optional comparison flag and return its restoration callback."""
    flags = get_flags()
    flag_name = "state_modified_compare_more_unrendered_values"
    had_flag = hasattr(flags, flag_name)
    previous_flag = getattr(flags, flag_name, None)
    object.__setattr__(flags, flag_name, False)

    def restore() -> None:
        if had_flag:
            object.__setattr__(flags, flag_name, previous_flag)
        else:
            object.__delattr__(flags, flag_name)

    return restore
