-- MyDays — Unified weekly planning: default weekdays + nullable placements
-- Run AFTER 0012_weight.sql. Safe to run multiple times.
--
-- Placement rows with weekday = NULL sit in the week backlog until dragged
-- onto a day. Templates seed new weeks from default_weekday when set.

-- weekly task templates
alter table public.weekly_tasks
    add column if not exists default_weekday integer
    check (default_weekday is null or default_weekday between 1 and 7);

-- allow unplaced rows (backlog) for the week
alter table public.weekly_task_placements
    alter column weekday drop not null;

alter table public.gym_week_placements
    alter column weekday drop not null;

alter table public.cardio_week_placements
    alter column weekday drop not null;

-- default weigh-in day (per-user; week can still be toggled off)
alter table public.profiles
    add column if not exists default_weight_weekday integer
    check (default_weight_weekday is null or default_weight_weekday between 1 and 7);
