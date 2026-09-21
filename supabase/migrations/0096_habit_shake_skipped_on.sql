-- Skip Gör shake on a single day from the day plan.
-- Run AFTER 0095. Safe to run multiple times.

alter table public.habits
    add column if not exists shake_skipped_on date;
