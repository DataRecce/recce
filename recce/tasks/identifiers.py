"""Verified model/column identifier helpers shared by the diff tasks (DRC-5336).

User-supplied model and column names must never reach SQL text unless they were
resolved against the project graph / the warehouse's canonical column list, and
even then they are emitted through a quoting helper that doubles embedded quote
characters (dbt's ``adapter.quote`` does not).
"""

from typing import Iterable, List, Optional

from recce.exceptions import RecceException

_TEMPLATE_CHARS = ("{", "}")


def _reject_template_chars(kind: str, name: str):
    # Identifiers are re-embedded into templates that are later rendered under the
    # sandboxed Jinja environment; a brace would be re-interpreted there.
    if any(c in name for c in _TEMPLATE_CHARS):
        raise RecceException(f"Invalid {kind} name: template characters are not allowed")


def resolve_verified_model(dbt_adapter, model: str, bases: Iterable[bool] = (False,)) -> str:
    """Return ``model`` only if it exists in the manifest for every env in ``bases``."""
    if not isinstance(model, str) or not model:
        raise RecceException("Model name cannot be empty")
    _reject_template_chars("model", model)
    if any(c in model for c in "\"'\\"):
        # Models are embedded as ref("<name>"); no legitimate dbt node name contains these.
        raise RecceException("Invalid model name: quote characters are not allowed")
    for base in bases:
        if dbt_adapter.find_node_by_name(model, base=base) is None:
            env = "base" if base else "current"
            raise RecceException(f"Model '{model}' does not exist in {env} environment")
    return model


def _column_name(col) -> str:
    return col.column if hasattr(col, "column") else col.name


def get_canonical_columns(dbt_adapter, model: str, bases: Iterable[bool]) -> List[dict]:
    """One {lower(name): physical_name} lookup per env. Errors propagate (fail closed)."""
    lookups = []
    for base in bases:
        lookups.append({_column_name(c).lower(): _column_name(c) for c in dbt_adapter.get_columns(model, base=base)})
    return lookups


def resolve_verified_column(dbt_adapter, model: str, column: str, bases: Iterable[bool] = (True, False)) -> str:
    """Resolve ``column`` to its canonical physical name; raise if absent in any env.

    Matching is case-insensitive (Snowflake folds unquoted identifiers to upper case) and
    returns the name from ``get_columns``, never the user's spelling.
    """
    if not isinstance(column, str) or not column:
        raise RecceException("Column name cannot be empty")
    bases = tuple(bases)
    resolved: Optional[str] = None
    for base, lookup in zip(bases, get_canonical_columns(dbt_adapter, model, bases)):
        physical = lookup.get(column.lower())
        if physical is None:
            env = "base" if base else "current"
            raise RecceException(f"Column '{column}' does not exist in model '{model}' ({env} environment)")
        resolved = resolved or physical
    _reject_template_chars("column", resolved)
    return resolved


def quote_identifier(dbt_adapter, name: str) -> str:
    """Quote ``name`` for the active dialect, doubling any embedded closing quote character."""
    open_q, close_q = '"', '"'
    try:
        probe = dbt_adapter.adapter.quote("x")
        if isinstance(probe, str) and len(probe) == 3 and probe[1] == "x":
            open_q, close_q = probe[0], probe[2]
    except Exception:
        pass
    return f"{open_q}{name.replace(close_q, close_q * 2)}{close_q}"


# ---------------------------------------------------------------------------
# Primary keys of ad-hoc query diffs: the columns come from the user's own SQL, so there is
# no catalog to resolve them against. We infer the output columns statically and fall back
# to a strict syntactic check when that is impossible.

import re  # noqa: E402

_SIMPLE_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")
_REF_CALL = re.compile(r"""\{\{\s*ref\(\s*(?:['"][^'"]*['"]\s*,\s*)?['"]([^'"]+)['"]\s*\)\s*\}\}""")


def infer_output_columns(sql_template: str, resolve_star=None) -> Optional[List[str]]:
    """Statically infer a query's output column names, or None when it cannot be done reliably.

    Only plain ``ref()`` calls are understood; any other Jinja makes the result unknown.
    ``resolve_star(model)`` expands ``select *`` from a single ref'd model.
    """
    try:
        import sqlglot
        from sqlglot import exp

        refs = {}

        def sub(match):
            name = f"__recce_ref_{len(refs)}"
            refs[name] = match.group(1)
            return name

        text = _REF_CALL.sub(sub, sql_template or "")
        if "{{" in text or "{%" in text or "{#" in text:
            return None
        tree = sqlglot.parse_one(text)
        if not isinstance(tree, exp.Query):
            return None
        select = tree.this if isinstance(tree, exp.Subquery) else tree
        while isinstance(select, exp.SetOperation):
            select = select.left
        if not isinstance(select, exp.Select):
            return None
        names: List[str] = []
        for projection in select.expressions:
            if projection.is_star or (isinstance(projection, exp.Column) and isinstance(projection.this, exp.Star)):
                from_ = select.args.get("from_") or select.args.get("from")
                table = from_.this if from_ is not None else None
                if (
                    resolve_star is None
                    or select.args.get("joins")
                    or not isinstance(table, exp.Table)
                    or table.name not in refs
                ):
                    return None
                names.extend(resolve_star(refs[table.name]))
            elif projection.alias_or_name:
                names.append(projection.alias_or_name)
        return names
    except RecceException:
        raise
    except Exception:
        return None


def resolve_order_by_identifiers(dbt_adapter, names: List[str], sql_template: str, resolve_star=None) -> List[str]:
    """Validate query-diff primary keys and return SQL-safe identifiers for ORDER BY."""
    inferred = infer_output_columns(sql_template, resolve_star)
    lookup = {n.lower(): n for n in inferred} if inferred is not None else None
    safe = []
    for name in names:
        if not isinstance(name, str) or not name:
            raise RecceException("Primary key cannot be empty")
        if lookup is not None:
            if name.lower() not in lookup:
                raise RecceException(f"Primary key '{name}' is not a column of the query")
        elif not _SIMPLE_IDENT.match(name):
            raise RecceException(f"Invalid primary key '{name}'")
        # Simple names stay unquoted so dialect case folding keeps working for ad-hoc SQL;
        # anything else is quoted with embedded quotes doubled.
        safe.append(name if _SIMPLE_IDENT.match(name) else quote_identifier(dbt_adapter, name))
    return safe
