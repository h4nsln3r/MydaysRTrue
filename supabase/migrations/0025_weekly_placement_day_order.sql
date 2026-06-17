-- Per-day sort order for weekly task placements (week plan column order).
-- Run AFTER 0024_weekly_music.sql. Safe to run multiple times.

alter table public.weekly_task_placements
    add column if not exists day_sort_order integer not null default 0;

create index if not exists weekly_placements_user_week_day_order_idx
    on public.weekly_task_placements (user_id, week_start, weekday, day_sort_order)
    where weekday is not null;

-- Backfill: preserve created_at order within each placed day.
with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, week_start, weekday
            order by created_at, id
        ) - 1 as rn
    from public.weekly_task_placements
    where weekday is not null
)
update public.weekly_task_placements p
set day_sort_order = ranked.rn
from ranked
where p.id = ranked.id;
