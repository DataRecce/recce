{#
  Synthetic wide-table fixture for DRC-3389 paired-histogram perf benchmarks.

  Configurable knobs (project vars in dbt_project.yml):
    - wide_rows:  number of rows. Default 100_000.
    - wide_seed:  rng seed mixed into every column hash. Default 1.
    - wide_drift: 0.0 = identical to base. >0.0 shifts a few columns so the
                  current run's distribution differs measurably from base.

  Columns produced (default = 95 total — matches the ~50–100 col realistic
  workload called out in DRC-3389):
    - num_continuous_0..49 : numeric, continuous → histogram
    - lowcard_str_0..19    : low-card strings (~12 distinct) → topk
    - highcard_str_0..9    : high-card strings (~500 distinct) → topk capped
    - bool_0..4            : booleans → topk
    - ts_0..4              : timestamps over a year → histogram
    - uuid_0..4            : all-distinct strings → ideally skipped
#}

{%- set rows = var("wide_rows", 100000) | int -%}
{%- set seed = var("wide_seed", 1) | int -%}
{%- set drift = var("wide_drift", 0.0) | float -%}

{%- set n_continuous = 50 -%}
{%- set n_lowcard = 20 -%}
{%- set n_highcard = 10 -%}
{%- set n_bool = 5 -%}
{%- set n_ts = 5 -%}
{%- set n_uuid = 5 -%}

{%- set cols = [] -%}

{%- for i in range(n_continuous) -%}
    {%- if i < 5 -%}
        {%- set _ = cols.append(
            "cast(hash(row_id || '|num|" ~ i ~ "|" ~ seed ~ "') % 1000000 as bigint) / 1000000.0 + (" ~ drift ~ " * " ~ (i + 1) ~ ") as num_continuous_" ~ i
        ) -%}
    {%- else -%}
        {%- set _ = cols.append(
            "cast(hash(row_id || '|num|" ~ i ~ "|" ~ seed ~ "') % 1000000 as bigint) / 1000000.0 as num_continuous_" ~ i
        ) -%}
    {%- endif -%}
{%- endfor -%}

{%- for i in range(n_lowcard) -%}
    {%- set _ = cols.append(
        "'cat_' || cast(cast(hash(row_id || '|lc|" ~ i ~ "|" ~ seed ~ "') % 12 as bigint) as varchar) as lowcard_str_" ~ i
    ) -%}
{%- endfor -%}

{%- for i in range(n_highcard) -%}
    {%- if i < 2 -%}
        {%- set _ = cols.append(
            "'hk_' || cast(cast((hash(row_id || '|hc|" ~ i ~ "|" ~ seed ~ "') + cast(" ~ drift ~ " * 1000 as ubigint)) % 500 as bigint) as varchar) as highcard_str_" ~ i
        ) -%}
    {%- else -%}
        {%- set _ = cols.append(
            "'hk_' || cast(cast(hash(row_id || '|hc|" ~ i ~ "|" ~ seed ~ "') % 500 as bigint) as varchar) as highcard_str_" ~ i
        ) -%}
    {%- endif -%}
{%- endfor -%}

{%- for i in range(n_bool) -%}
    {%- if i == 0 -%}
        {%- set _ = cols.append(
            "cast((hash(row_id || '|bool|" ~ i ~ "|" ~ seed ~ "') % 100 + cast(" ~ drift ~ " * 30 as ubigint)) % 2 as bigint) = 0 as bool_" ~ i
        ) -%}
    {%- else -%}
        {%- set _ = cols.append(
            "cast(hash(row_id || '|bool|" ~ i ~ "|" ~ seed ~ "') % 2 as bigint) = 0 as bool_" ~ i
        ) -%}
    {%- endif -%}
{%- endfor -%}

{%- for i in range(n_ts) -%}
    {%- set _ = cols.append(
        "timestamp '2025-01-01 00:00:00' + interval (cast(hash(row_id || '|ts|" ~ i ~ "|" ~ seed ~ "') % 31536000 as bigint)) second as ts_" ~ i
    ) -%}
{%- endfor -%}

{%- for i in range(n_uuid) -%}
    {%- set _ = cols.append(
        "'u_' || cast(row_id as varchar) || '_' || cast(" ~ i ~ " as varchar) as uuid_" ~ i
    ) -%}
{%- endfor -%}

with base as (
    select range as row_id from range(0, {{ rows }})
)
select
    row_id,
    {{ cols | join(',\n    ') }}
from base
