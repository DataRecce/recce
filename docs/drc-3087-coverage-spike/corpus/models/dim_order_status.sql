-- C1: Multi-branch CASE (3+ WHEN + ELSE).
-- Maps a raw order status onto a coarse bucket. Four explicit branches plus an
-- ELSE fallthrough -- the canonical fine-grained-coverage unit. A unit test
-- whose fixtures only emit a subset of statuses leaves the other branches
-- uncovered, which is exactly the partial-coverage signal both spikes target.
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
from {{ ref('raw_orders') }}
