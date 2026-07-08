-- Per-week pause state for weekly task placements (primarily one-off tasks).
alter table weekly_task_placements
  add column if not exists on_hold boolean not null default false;
