-- Per-task repeatable weekly goals.
-- Run AFTER 0075_repeatable_bas_and_sport.sql. Safe to run multiple times.

alter table public.weekly_tasks
    add column if not exists is_repeatable boolean not null default false;

alter table public.weekly_tasks
    add column if not exists weekly_goal integer not null default 2
        check (weekly_goal between 1 and 14);

-- Backfill known repeatable templates.
update public.weekly_tasks
set
    is_repeatable = true,
    weekly_goal = greatest(1, least(14, weekly_goal))
where archived_at is null
  and key in (
      'dev_code',
      'home_handla',
      'life_ring_mamma',
      'music_rep',
      'music_bas'
  );

-- Keep seed defaults in sync for new users (music already updated in 0075).
-- Home/dev/life seeds still create canonical keys; ensureRepeatableWeeklyTasks
-- also sets is_repeatable on load.
