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


class DuckDBExternalAccessBlocked(RecceException):
    """Raised when DuckDB's external-access sandbox rejects a user query."""

    def __init__(self, original_message: str):
        message = (
            f"This SQL is blocked by recce's DuckDB external-access sandbox: {original_message}. "
            "To allow, restart with --duckdb-external-access or set "
            "duckdb_external_access: true in recce.yml."
        )
        super().__init__(message, is_raise=True)
