import re
from typing import Optional


def _get_ref_model(sql_template: str) -> Optional[str]:
    """Extract a single model reference from a SQL template.

    Matches patterns like `ref('model_name')}}` or `ref("model_name")}}`
    commonly found in dbt-style SQL templates.

    Args:
        sql_template: A SQL template string that may contain ref() calls.

    Returns:
        The model name if exactly one ref() match is found, otherwise None.
    """
    pattern = r'\bref\(["\']?(\w+)["\']?\)\s*}}'
    matches = re.findall(pattern, sql_template)
    if len(matches) == 1:
        ref = matches[0]
        return ref

    return None
