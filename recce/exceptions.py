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


class DbtUnavailableError(RecceException):
    """Raised when the dbt adapter cannot import dbt: dbt is not installed, or dbt v2 (Fusion) is installed."""


class UnsupportedDbtSchemaError(RecceException):
    """Raised when a dbt artifact's schema is newer than Recce supports.
    The version limits are in _DBT1X_MAX_SCHEMA in the dbt adapter."""

    def __init__(self, artifact: str, found_version: int):
        message = (
            f"The {artifact} uses schema v{found_version}, which is newer than Recce "
            f"supports (manifest up to v12, catalog v1). Re-generate the {artifact} "
            f"with dbt-core 1.x."
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
