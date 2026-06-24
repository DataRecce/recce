class RecceException(Exception):
    def __init__(self, message, is_raise=True):
        self.message = message
        self.is_raise = is_raise
        super().__init__(self.message)


class RecceCancelException(RecceException):
    def __init__(self):
        super().__init__("Cancelled", False)


class RecceConfigException(RecceException):
    def __init__(self, message, cause=None):
        super().__init__(message)
        self.cause = cause

    def __str__(self):
        if self.cause:
            return f"{super().__str__()}\n{str(self.cause)}"
        return super().__str__()


class UnsupportedDbtSchemaError(RecceException):
    """Raised when a dbt artifact's schema is newer than Recce's bundled dbt supports.

    dbt v2 / Fusion emits a v20 manifest; Recce's dbt 1.x tops out at manifest v12 /
    catalog v1. Translates dbt's cryptic ``IncompatibleSchemaError`` into a clear,
    Recce-branded message instead of letting the dbt-internal one surface.
    """

    def __init__(self, artifact: str, found_version: int):
        message = (
            f"dbt v2 / Fusion {artifact}s (schema v{found_version}) are not yet "
            f"supported by Recce. Recce supports dbt 1.x artifacts (manifest schema up "
            f"to v12, catalog v1). Re-generate the {artifact} with dbt 1.x."
        )
        super().__init__(message, is_raise=True)


class DuckDBExternalAccessBlocked(RecceException):
    """Raised when DuckDB rejects a query because external access is disabled."""

    def __init__(self, original_message: str):
        message = (
            f"DuckDB external access is disabled — {original_message}. "
            "To allow, restart with --duckdb-external-access or set "
            "duckdb_external_access: true in recce.yml."
        )
        super().__init__(message, is_raise=True)


# String-match against DuckDB internals. Pinned by test_duckdb_external_access.py.
_DUCKDB_EXTERNAL_ACCESS_DENIAL_MESSAGES = (
    "file system operations are disabled by configuration",
    "Loading external extensions is disabled through configuration",
    # DuckDB <= 1.4.x
    "Cannot change enable_external_access setting while database is running",
    # DuckDB >= 1.5.x reworded this denial
    "Cannot enable external access while database is running",
)


def is_duckdb_external_access_blocked(exc: BaseException) -> bool:
    msg = str(exc)
    return any(sig in msg for sig in _DUCKDB_EXTERNAL_ACCESS_DENIAL_MESSAGES)
