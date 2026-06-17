-- Unified per-day sort order for all week-plan placements.
-- Run AFTER 0025_weekly_placement_day_order.sql. Safe to run multiple times.

alter table public.gym_week_placements
    add column if not exists day_sort_order integer not null default 0;

alter table public.cardio_week_placements
    add column if not exists day_sort_order integer not null default 0;

alter table public.bathing_week_placements
    add column if not exists day_sort_order integer not null default 0;

alter table public.weight_week_plans
    add column if not exists day_sort_order integer not null default 0;

alter table public.monthly_task_completions
    add column if not exists day_sort_order integer not null default 0;

-- Backfill gym / cardio / bathing from created_at within each placed day.
with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, week_start, weekday
            order by created_at, id
        ) - 1 as rn
    from public.gym_week_placements
    where weekday is not null
)
update public.gym_week_placements p
set day_sort_order = ranked.rn
from ranked
where p.id = ranked.id;

with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, week_start, weekday
            order by created_at, id
        ) - 1 as rn
    from public.cardio_week_placements
    where weekday is not null
)
update public.cardio_week_placements p
set day_sort_order = ranked.rn
from ranked
where p.id = ranked.id;

with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, week_start, weekday
            order by created_at, id
        ) - 1 as rn
    from public.bathing_week_placements
    where weekday is not null
)
update public.bathing_week_placements p
set day_sort_order = ranked.rn
from ranked
where p.id = ranked.id;

-- Weight: only one row per week/day when placed.
update public.weight_week_plans
set day_sort_order = 0
where weekday is not null and day_sort_order = 0;
