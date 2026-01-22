class DbtVersion:

    def __init__(self):
        from dbt import version as dbt_version

        dbt_version = self.parse(dbt_version.__version__)
        if dbt_version.is_prerelease:
            dbt_version = self.parse(dbt_version.base_version)
        self.dbt_version = dbt_version

    @staticmethod
    def parse(version: str):
        from packaging import version as v

        return v.parse(version)

    def as_version(self, other):
        from packaging.version import Version

        if isinstance(other, Version):
            return other
        if isinstance(other, str):
            return self.parse(other)
        return self.parse(str(other))

    def __ge__(self, other):
        return self.dbt_version >= self.as_version(other)

    def __gt__(self, other):
        return self.dbt_version > self.as_version(other)

    def __lt__(self, other):
        return self.dbt_version < self.as_version(other)

    def __le__(self, other):
        return self.dbt_version <= self.as_version(other)

    def __eq__(self, other):
        return self.dbt_version.release[:2] == self.as_version(other).release[:2]

    def __str__(self):
        return ".".join([str(x) for x in list(self.dbt_version.release)])

    # Semantic version properties for cleaner version-specific logic

    @property
    def supports_new_connection_api(self) -> bool:
        """v1.8+ moved Connection to dbt.adapters.contracts.connection"""
        return self >= "v1.8"

    @property
    def requires_mp_context(self) -> bool:
        """v1.8+ requires mp_context for adapter instantiation"""
        return self >= "v1.8"

    @property
    def requires_invocation_context(self) -> bool:
        """v1.8+ requires invocation context setup"""
        return self >= "v1.8"

    @property
    def supports_dbt_common_modules(self) -> bool:
        """v1.8+ uses dbt_common package for helpers like merge_tables"""
        return self >= "v1.8"

    @property
    def supports_manifest_from_writable(self) -> bool:
        """v1.8+ supports Manifest.from_writable_manifest()"""
        return self >= "v1.8"

    @property
    def supports_limit_in_execute(self) -> bool:
        """v1.6+ supports limit parameter in adapter.execute()"""
        return self >= "v1.6"

    @property
    def supports_previous_state_project_root(self) -> bool:
        """v1.5.2+ requires project_root in PreviousState constructor"""
        return self >= "v1.5.2"

    @property
    def uses_eager_selector_mode(self) -> bool:
        """v1.7 and below use 'eager' mode in parse_difference"""
        return self < "v1.8"

    @property
    def supports_macro_context_generator(self) -> bool:
        """v1.8+ uses set_macro_resolver and set_macro_context_generator"""
        return self >= "v1.8"

    @property
    def supports_warn_error_options_silence(self) -> bool:
        """v1.8+ has WARN_ERROR_OPTIONS.silence for NoNodesForSelectionCriteria"""
        return self >= "v1.8"
