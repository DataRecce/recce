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
