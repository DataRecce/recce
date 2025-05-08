# Configuration file for recce
from rich.console import Console

from recce import yaml
from recce.exceptions import RecceConfigException
from recce.util import SingletonMeta

RECCE_CONFIG_FILE = "recce.yml"
RECCE_PRESET_CHECK_COMMENT = """Preset Checks
Please see https://docs.datarecce.io/features/preset-checks/
"""
RECCE_ERROR_LOG_FILE = "recce_error.log"
console = Console()


class RecceConfig(metaclass=SingletonMeta):
    def __init__(self, config_file=RECCE_CONFIG_FILE):
        self.config_file = config_file
        self.config = None
        self.load()

    def load(self):
        try:
            with open(self.config_file, "r") as f:
                config = yaml.safe_load(f)
                self.config = config if config else {}
            self._verify_preset_checks()
        except FileNotFoundError:
            console.print(f"Recce config file not found. Generating default config file at '{self.config_file}'")
            self.config = self.generate_template()
            self.save()

    def _verify_preset_checks(self):
        from recce.tasks.core import CheckValidator

        if not self.config.get("checks"):
            return

        for check in self.config["checks"]:
            try:
                check_type = check.get("type")
                if check_type is None:
                    raise ValueError(f'Check type is required for check "{check}"')
                if check_type == "lineage_diff":
                    from recce.tasks.lineage import LineageDiffCheckValidator

                    validator = LineageDiffCheckValidator()
                elif check_type == "schema_diff":
                    from recce.tasks.schema import SchemaDiffCheckValidator

                    validator = SchemaDiffCheckValidator()
                elif check_type == "row_count_diff":
                    from recce.tasks.rowcount import RowCountDiffCheckValidator

                    validator = RowCountDiffCheckValidator()
                elif check_type == "query":
                    from recce.tasks.query import QueryCheckValidator

                    validator = QueryCheckValidator()
                elif check_type == "query_diff":
                    from recce.tasks.query import QueryDiffCheckValidator

                    validator = QueryDiffCheckValidator()
                elif check_type == "value_diff" or check_type == "value_diff_detail":
                    from recce.tasks.valuediff import ValueDiffCheckValidator

                    validator = ValueDiffCheckValidator()
                elif check_type == "profile_diff":
                    from recce.tasks.profile import ProfileCheckValidator

                    validator = ProfileCheckValidator()
                elif check_type == "top_k_diff":
                    from recce.tasks.top_k import TopKDiffCheckValidator

                    validator = TopKDiffCheckValidator()
                elif check_type == "histogram_diff":
                    from recce.tasks.histogram import HistogramDiffCheckValidator

                    validator = HistogramDiffCheckValidator()
                else:
                    validator = CheckValidator()
                validator.validate(check)
            except Exception as e:
                import json

                raise RecceConfigException(
                    f"Load preset checks failed from '{self.config_file}'\n{json.dumps(check, indent=2)}", cause=e
                )

    def generate_template(self):
        data = yaml.CommentedMap(checks=yaml.CommentedSeq())
        data.yaml_set_comment_before_after_key("checks", before=RECCE_PRESET_CHECK_COMMENT)
        # Define default preset checks
        default_checks = [
            yaml.CommentedMap(
                name="Row count diff",
                description="Check the row count diff for all table models.",
                type="row_count_diff",
                params={"select": "state:modified,config.materialized:table"},
            ),
            yaml.CommentedMap(
                name="Schema diff",
                description="Check the schema diff for all nodes.",
                type="schema_diff",
            ),
        ]

        for check in default_checks:
            data["checks"].append(check)

        return data

    def get(self, key, default=None):
        return self.config.get(key, default)

    def set(self, key, value):
        self.config[key] = value

    def save(self):
        with open(RECCE_CONFIG_FILE, "w") as f:
            yaml.dump(self.config, f)

    def __str__(self):
        return yaml.dump(self.config)

    def __repr__(self):
        return self.__str__()
