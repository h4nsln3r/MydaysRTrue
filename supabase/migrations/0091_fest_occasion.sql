-- Occasion label for repeatable monthly Fest instances.
-- Run AFTER 0090_monthly_fest.sql. Safe to run multiple times.

alter table public.monthly_task_completions
    add column if not exists occasion text;

comment on column public.monthly_task_completions.occasion is
    'Free-text kind of party (or other repeatable monthly instance), e.g. kräftskiva.';
