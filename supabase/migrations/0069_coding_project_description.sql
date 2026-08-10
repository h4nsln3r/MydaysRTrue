-- Optional description on coding projects (year view).
-- Run AFTER 0068_repeatable_weekly_tasks.sql. Safe to run multiple times.

alter table public.coding_projects
    add column if not exists description text;
