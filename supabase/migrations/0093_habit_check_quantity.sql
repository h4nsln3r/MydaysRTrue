-- Gör shake: store how many shakes were made so the next occurrence
-- can land the calendar day before stock runs out.
-- Run AFTER 0092. Safe to run multiple times.

alter table public.habit_checks
    add column if not exists quantity integer;

alter table public.habit_checks
    drop constraint if exists habit_checks_quantity_check;

alter table public.habit_checks
    add constraint habit_checks_quantity_check
    check (quantity is null or (quantity >= 1 and quantity <= 14));
