-- MyDays — permanently enable/disable weekly and monthly task templates

alter table public.weekly_tasks
    add column if not exists enabled boolean not null default true;

alter table public.monthly_tasks
    add column if not exists enabled boolean not null default true;
