from typing import Optional, Literal

from pydantic import BaseModel

from recce.models import Check
from recce.tasks.core import CheckValidator


class LineageDiffParams(BaseModel):
    select: Optional[str] = None
    exclude: Optional[str] = None
    packages: Optional[list[str]] = None
    view_mode: Optional[Literal['all', 'changed_models']] = None


class LineageDiffCheckValidator(CheckValidator):
    def validate_check(self, check: Check):
        LineageDiffParams(**check.params)
        LineageDiffParams(**check.view_options)
