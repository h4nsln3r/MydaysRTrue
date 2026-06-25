-- MyDays — default monthly cost per bill (Räkningar)
-- Run AFTER 0035_dedupe_monthly_tasks.sql. Safe to run multiple times.

alter table public.monthly_tasks
    add column if not exists default_amount_kr numeric
        check (default_amount_kr is null or default_amount_kr >= 0);
