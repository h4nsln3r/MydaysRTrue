-- Non-repeatable weekly tasks default to goal 1 (e.g. Städning).
-- Run AFTER 0077_weekly_live_and_category_goals.sql. Safe to run multiple times.

update public.weekly_tasks
set weekly_goal = 1
where archived_at is null
  and is_repeatable = false
  and weekly_goal = 2;
