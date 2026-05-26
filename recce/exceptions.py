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


class UnsafeSqlException(RecceException):
    """Raised when the DuckDB sandbox blocks a user-submitted SQL query.

    This is a subclass of RecceException so it is automatically mapped to
    HTTP 400 by the /api/runs handler.
    """

    def __init__(self, original_message: str):
        message = (
            f"This SQL is blocked by the recce DuckDB sandbox: {original_message}. "
            "If you trust the source of this query, restart recce with --unsafe-sql "
            "or set unsafe_sql: true in recce.yml."
        )
        super().__init__(message, is_raise=True)
