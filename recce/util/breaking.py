# DEPRECATED 2026-05-25: import from recce.util.change_classifier instead.
# recce.util.breaking will be removed in the next Recce release.
#
# DRC-3553: this module was renamed to recce.util.change_classifier as part of
# the dual-vocabulary aliasing window. This thin shim re-exports the public
# symbols so existing imports (`from recce.util.breaking import ...`) keep
# working during the deprecation window.

from recce.util.change_classifier import (  # noqa: F401
    CHANGE_CATEGORY_ALIASES,
    CHANGE_CATEGORY_ALIASES_INVERSE,
    CHANGE_CATEGORY_BREAKING,
    CHANGE_CATEGORY_UNKNOWN,
    BreakingPerformanceTracking,
    normalize_change_category,
    parse_change_category,
    to_v2_change_category,
)

__all__ = [
    "CHANGE_CATEGORY_ALIASES",
    "CHANGE_CATEGORY_ALIASES_INVERSE",
    "CHANGE_CATEGORY_BREAKING",
    "CHANGE_CATEGORY_UNKNOWN",
    "BreakingPerformanceTracking",
    "normalize_change_category",
    "parse_change_category",
    "to_v2_change_category",
]
