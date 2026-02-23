import pytest

from recce.tasks.core import WhereFilter, build_where_clause


class TestWhereFilter:
    def test_basic_comparison(self):
        wf = WhereFilter(column="age", operator=">", value="30")
        clause = build_where_clause(wf)
        assert clause == '"age" > \'30\''

    def test_equality(self):
        wf = WhereFilter(column="status", operator="=", value="active")
        clause = build_where_clause(wf)
        assert clause == '"status" = \'active\''

    def test_not_equal(self):
        wf = WhereFilter(column="status", operator="!=", value="deleted")
        clause = build_where_clause(wf)
        assert clause == '"status" != \'deleted\''

    def test_is_null(self):
        wf = WhereFilter(column="deleted_at", operator="is_null")
        clause = build_where_clause(wf)
        assert clause == '"deleted_at" IS NULL'

    def test_is_not_null(self):
        wf = WhereFilter(column="created_at", operator="is_not_null")
        clause = build_where_clause(wf)
        assert clause == '"created_at" IS NOT NULL'

    def test_value_with_single_quote_escaped(self):
        wf = WhereFilter(column="name", operator="=", value="O'Brien")
        clause = build_where_clause(wf)
        assert clause == '"name" = \'O\'\'Brien\''

    def test_invalid_operator_rejected(self):
        with pytest.raises(ValueError):
            WhereFilter(column="x", operator="DROP TABLE", value="1")

    def test_value_required_for_comparison_operators(self):
        with pytest.raises(ValueError):
            WhereFilter(column="x", operator=">")

    def test_column_name_rejects_sql_injection(self):
        with pytest.raises(ValueError):
            WhereFilter(column='"; DROP TABLE users; --', operator="=", value="1")

    def test_column_name_rejects_double_quotes(self):
        with pytest.raises(ValueError):
            WhereFilter(column='col"name', operator="=", value="1")

    def test_column_name_rejects_semicolons(self):
        with pytest.raises(ValueError):
            WhereFilter(column="col;name", operator="=", value="1")

    def test_column_name_allows_qualified_names(self):
        wf = WhereFilter(column="schema.table.column", operator="=", value="1")
        clause = build_where_clause(wf)
        assert clause == '"schema.table.column" = \'1\''

    def test_column_name_allows_underscores(self):
        wf = WhereFilter(column="created_at", operator=">=", value="2024-01-01")
        clause = build_where_clause(wf)
        assert clause == '"created_at" >= \'2024-01-01\''
