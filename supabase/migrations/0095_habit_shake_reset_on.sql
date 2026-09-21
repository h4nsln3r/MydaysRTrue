-- Gör shake: week-plan drag resets stock so the next batch starts on that day.
-- Run AFTER 0094. Safe to run multiple times.

alter table public.habits
    add column if not exists shake_reset_on date;
