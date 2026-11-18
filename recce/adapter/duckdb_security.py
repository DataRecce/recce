"""DuckDB sandbox settings shared by dbt and SQLMesh."""

from recce.exceptions import RecceConfigException


# dbt-duckdb applies credentials.settings on every new cursor. Keep that
# lifecycle intact; SQLMesh applies the policy directly to its execution cursor.
def duckdb_external_access_settings() -> dict[str, str]:
    return {"enable_external_access": "false"}


_SQLMESH_SANDBOX_SETTINGS = {
    "autoinstall_known_extensions": "false",
    "autoload_known_extensions": "false",
    # These exemptions override enable_external_access=false.
    "allowed_paths": "[]",
    "allowed_directories": "[]",
    # DuckDB otherwise adds the spill directory to allowed_directories when
    # external access is disabled, reopening file access inside that directory.
    "temp_directory": "''",
    **duckdb_external_access_settings(),
    # Lock last so the preceding restrictions cannot be undone by a query.
    "lock_configuration": "true",
}


def lock_down_duckdb(cursor) -> None:
    """Apply and verify the sandbox on the cursor that will execute a query.

    Idempotent for an already restricted connection, including sibling cursors.
    Conflicting locked settings or a failed SET abort before query dispatch.
    """
    settings_query = "SELECT " + ", ".join(f"current_setting('{name}')" for name in _SQLMESH_SANDBOX_SETTINGS)
    expected = (False, False, [], [], "", False, True)
    try:
        # DuckDB automatically exempts its open database files and WALs when
        # external access is disabled. These are needed for local model reads.
        cursor.execute("SELECT path FROM duckdb_databases() WHERE path IS NOT NULL")
        database_paths = {
            path + suffix
            for (path,) in cursor.fetchall()
            for suffix in ("", ".wal", ".wal.checkpoint", ".wal.recovery")
        }

        def matches_policy(settings):
            return (
                settings[:2] == expected[:2]
                and set(settings[2]).issubset(database_paths)
                and settings[3:] == expected[3:]
            )

        cursor.execute(settings_query)
        current = cursor.fetchone()
        if matches_policy(current):
            return
        for index, (name, value) in enumerate(_SQLMESH_SANDBOX_SETTINGS.items()):
            if current[index] != expected[index]:
                cursor.execute(f"SET {name} = {value}")
        cursor.execute(settings_query)
        if not matches_policy(cursor.fetchone()):
            raise ValueError("DuckDB sandbox settings did not take effect")
    except Exception as exc:
        raise RecceConfigException("Unable to apply the DuckDB external-access sandbox.") from exc
