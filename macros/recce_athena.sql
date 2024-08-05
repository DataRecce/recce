{% macro athena__compare_column_values(a_query, b_query, primary_key, column_to_compare, emojis, a_relation_name, b_relation_name) -%}
with a_query as (
    {{ a_query }}
),

b_query as (
    {{ b_query }}
),

joined as (
    select
        coalesce(a_query.{{ primary_key }}, b_query.{{ primary_key }}) as {{ primary_key }},
        a_query.{{ column_to_compare }} as a_query_value,
        b_query.{{ column_to_compare }} as b_query_value,
        case
            when a_query.{{ column_to_compare }} = b_query.{{ column_to_compare }} then '{% if emojis %}✅: {% endif %}perfect match'
            when a_query.{{ column_to_compare }} is null and b_query.{{ column_to_compare }} is null then '{% if emojis %}✅: {% endif %}both are null'
            when a_query.{{ primary_key }} is null then '{% if emojis %}🤷: {% endif %}missing from {{ a_relation_name }}'
            when b_query.{{ primary_key }} is null then '{% if emojis %}🤷: {% endif %}missing from {{ b_relation_name }}'
            when a_query.{{ column_to_compare }} is null then '{% if emojis %}🤷: {% endif %}value is null in {{ a_relation_name }} only'
            when b_query.{{ column_to_compare }} is null then '{% if emojis %}🤷: {% endif %}value is null in {{ b_relation_name }} only'
            when a_query.{{ column_to_compare }} != b_query.{{ column_to_compare }} then '{% if emojis %}❌: {% endif %}‍values do not match'
            else 'unknown' -- this should never happen
        end as match_status,
        case
            when a_query.{{ column_to_compare }} = b_query.{{ column_to_compare }} then 0
            when a_query.{{ column_to_compare }} is null and b_query.{{ column_to_compare }} is null then 1
            when a_query.{{ primary_key }} is null then 2
            when b_query.{{ primary_key }} is null then 3
            when a_query.{{ column_to_compare }} is null then 4
            when b_query.{{ column_to_compare }} is null then 5
            when a_query.{{ column_to_compare }} != b_query.{{ column_to_compare }} then 6
            else 7 -- this should never happen
        end as match_order

    from a_query

    full outer join b_query on a_query.{{ primary_key }} = b_query.{{ primary_key }}
),

aggregated as (
    select
        '{{ column_to_compare }}' as column_name,
        match_status,
        match_order,
        count(*) as count_records
    from joined

    group by '{{ column_to_compare }}', match_status, match_order
)

select
    column_name,
    match_status,
    count_records,
    round(100.0 * count_records / sum(count_records) over (), 2) as percent_of_total

from aggregated

order by match_order

{% endmacro %}


{%- macro athena__measure_median(column_name, data_type, cte_name) -%}

{%- if dbt_profiler.is_numeric_dtype(data_type) and not dbt_profiler.is_struct_dtype(data_type) -%}
    approx_percentile( {{ adapter.quote(column_name) }}, 0.5)
{%- else -%}
    cast(null as {{ dbt.type_numeric() }})
{%- endif -%}

{%- endmacro -%}