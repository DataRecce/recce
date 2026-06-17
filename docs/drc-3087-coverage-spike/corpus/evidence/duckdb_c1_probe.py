import duckdb

con = duckdb.connect()
sql = """
select
    order_id,
    status,
    case
        when status in ('placed', 'shipped') then 'open'
        when status = 'completed' then 'fulfilled'
        when status = 'returned' then 'reversed'
        when status = 'cancelled' then 'reversed'
        else 'unknown'
    end as status_bucket
from (values (1,'placed'),(3,'completed')) as t(order_id, status)
order by order_id
"""
rows = con.execute(sql).fetchall()
print("duckdb rows:", rows)
