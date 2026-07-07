-- Repair one-off weekly tasks wrongly pinned to a future week (carryOver bug).
-- Re-pin to the ISO week the task was created in. Safe to run multiple times.
-- Run AFTER 0051_utgifter_no_seed_tasks.sql.

with created_week as (
    select
        id,
        (
            created_at::date
            - (extract(isodow from created_at::date)::int - 1)
        )::date as week_start
    from public.weekly_tasks
    where archived_at is null
      and single_week_start is not null
)
update public.weekly_tasks wt
set single_week_start = cw.week_start
from created_week cw
where wt.id = cw.id
  and wt.single_week_start > cw.week_start;

-- Ensure a placement row exists on the corrected week (copy weekday from a later week if any).
insert into public.weekly_task_placements (
    user_id,
    task_id,
    week_start,
    weekday,
    day_sort_order
)
select
    wt.user_id,
    wt.id,
    wt.single_week_start,
    src.weekday,
    coalesce(src.day_sort_order, 0)
from public.weekly_tasks wt
left join lateral (
    select p.weekday, p.day_sort_order
    from public.weekly_task_placements p
    where p.user_id = wt.user_id
      and p.task_id = wt.id
      and p.week_start > wt.single_week_start
    order by p.week_start
    limit 1
) src on true
where wt.archived_at is null
  and wt.single_week_start is not null
  and not exists (
      select 1
      from public.weekly_task_placements p
      where p.user_id = wt.user_id
        and p.task_id = wt.id
        and p.week_start = wt.single_week_start
  );
