-- MyDays — per-month week placement for monthly tasks (week-only or day-in-week planning)

alter table public.monthly_task_completions
    add column if not exists scheduled_week_start date;

comment on column public.monthly_task_completions.scheduled_week_start is
    'ISO week (Monday) when this task is planned. Set with or without scheduled_day_of_month.';
