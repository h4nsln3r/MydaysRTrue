-- MyDays — one-off weekly tasks (single week only).
-- Run AFTER 0028_shared_task_categories.sql. Safe to run multiple times.
--
-- A normal weekly task is a permanent template that appears every week. A
-- one-off task is pinned to a single week via `single_week_start` (the Monday
-- of that ISO week). It shows up only for that week and is hidden from the
-- profile editor / future weeks.

alter table public.weekly_tasks
    add column if not exists single_week_start date;

create index if not exists weekly_tasks_single_week_idx
    on public.weekly_tasks (user_id, single_week_start)
    where single_week_start is not null;
