{#
  Snowflake variant of the synthetic wide-table fixture.

  Reduced column count vs the DuckDB pass (~30 cols vs ~95) so the mini
  Snowflake confirm stays under ~3 min of warehouse compute. The relative
  ordering of strategies is what we care about.

  Snowflake-specific syntax:
    - generator(rowcount => N) + seq4() in place of duckdb's range()
    - dateadd(second, n, ts) in place of interval-second arithmetic
    - hash() returns signed bigint already (no ubigint dance)
#}

{%- set rows = var("wide_rows", 100000) | int -%}
{%- set seed = var("wide_seed", 1) | int -%}
{%- set drift = var("wide_drift", 0.0) | float -%}

{%- set n_continuous = var("n_continuous", 15) | int -%}
{%- set n_lowcard = var("n_lowcard", 6) | int -%}
{%- set n_highcard = var("n_highcard", 3) | int -%}
{%- set n_bool = var("n_bool", 2) | int -%}
{%- set n_ts = var("n_ts", 2) | int -%}
{%- set n_uuid = var("n_uuid", 2) | int -%}

{%- set cols = [] -%}

{%- for i in range(n_continuous) -%}
    {%- if i < 3 -%}
        {%- set _ = cols.append(
            "abs(mod(hash(to_varchar(row_id) || '|num|" ~ i ~ "|" ~ seed ~ "'), 1000000)) / 1000000.0 + (" ~ drift ~ " * " ~ (i + 1) ~ ") as num_continuous_" ~ i
        ) -%}
    {%- else -%}
        {%- set _ = cols.append(
            "abs(mod(hash(to_varchar(row_id) || '|num|" ~ i ~ "|" ~ seed ~ "'), 1000000)) / 1000000.0 as num_continuous_" ~ i
        ) -%}
    {%- endif -%}
{%- endfor -%}

{%- for i in range(n_lowcard) -%}
    {%- set _ = cols.append(
        "'cat_' || to_varchar(abs(mod(hash(to_varchar(row_id) || '|lc|" ~ i ~ "|" ~ seed ~ "'), 12))) as lowcard_str_" ~ i
    ) -%}
{%- endfor -%}

{%- for i in range(n_highcard) -%}
    {%- if i < 1 -%}
        {%- set _ = cols.append(
            "'hk_' || to_varchar(abs(mod(hash(to_varchar(row_id) || '|hc|" ~ i ~ "|" ~ seed ~ "') + cast(" ~ drift ~ " * 1000 as bigint), 500))) as highcard_str_" ~ i
        ) -%}
    {%- else -%}
        {%- set _ = cols.append(
            "'hk_' || to_varchar(abs(mod(hash(to_varchar(row_id) || '|hc|" ~ i ~ "|" ~ seed ~ "'), 500))) as highcard_str_" ~ i
        ) -%}
    {%- endif -%}
{%- endfor -%}

{%- for i in range(n_bool) -%}
    {%- if i == 0 -%}
        {%- set _ = cols.append(
            "mod(abs(hash(to_varchar(row_id) || '|bool|" ~ i ~ "|" ~ seed ~ "')) + cast(" ~ drift ~ " * 30 as bigint), 2) = 0 as bool_" ~ i
        ) -%}
    {%- else -%}
        {%- set _ = cols.append(
            "mod(abs(hash(to_varchar(row_id) || '|bool|" ~ i ~ "|" ~ seed ~ "')), 2) = 0 as bool_" ~ i
        ) -%}
    {%- endif -%}
{%- endfor -%}

{%- for i in range(n_ts) -%}
    {%- set _ = cols.append(
        "dateadd(second, abs(mod(hash(to_varchar(row_id) || '|ts|" ~ i ~ "|" ~ seed ~ "'), 31536000)), '2025-01-01 00:00:00'::timestamp) as ts_" ~ i
    ) -%}
{%- endfor -%}

{%- for i in range(n_uuid) -%}
    {%- set _ = cols.append(
        "'u_' || to_varchar(row_id) || '_' || '" ~ i ~ "' as uuid_" ~ i
    ) -%}
{%- endfor -%}

with base as (
    select seq4() as row_id from table(generator(rowcount => {{ rows }}))
)
select
    row_id,
    {{ cols | join(',\n    ') }}
from base
