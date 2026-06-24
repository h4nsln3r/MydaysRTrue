-- MyDays — archive duplicate monthly tasks (same title per user).
-- Run AFTER 0034_monthly_finance.sql. Safe to run multiple times.
--
-- Keeps one row per (user, lower(title)): prefers seeded keys, then lowest sort_order.

with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, lower(trim(title))
            order by
                (key is not null and key <> '') desc,
                (key = 'bill_hyra') desc,
                sort_order,
                created_at,
                id
        ) as rn
    from public.monthly_tasks
    where archived_at is null
)
update public.monthly_tasks t
set archived_at = now()
from ranked r
where t.id = r.id
  and r.rn > 1;
