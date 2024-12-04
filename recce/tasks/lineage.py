from typing_extensions import override

from recce.models import Check
from recce.tasks.core import CheckValidator


class LineageDiffCheckValidator(CheckValidator):

    @override
    def validate_check(self, check: Check):
        if check.params is None and check.view_options is None:
            raise ValueError('"params" or "view_options" must be provided')
