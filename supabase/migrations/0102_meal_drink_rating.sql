-- Optional drink and rating on meals and snacks.
-- A drink with an amount is stored as a normal water_logs row so it shows
-- in the drink list and counts toward the daily water total.

alter table public.meal_entries
    add column if not exists drink_note text,
    add column if not exists rating smallint;

alter table public.meal_entries
    drop constraint if exists meal_entries_rating_check;
alter table public.meal_entries
    add constraint meal_entries_rating_check
    check (rating is null or (rating >= 1 and rating <= 10));

alter table public.meal_entries
    drop constraint if exists meal_entries_drink_note_check;
alter table public.meal_entries
    add constraint meal_entries_drink_note_check
    check (drink_note is null or length(trim(drink_note)) > 0);

alter table public.snack_checks
    add column if not exists water_log_id uuid references public.water_logs(id) on delete set null,
    add column if not exists drink_note text,
    add column if not exists rating smallint;

alter table public.snack_checks
    drop constraint if exists snack_checks_rating_check;
alter table public.snack_checks
    add constraint snack_checks_rating_check
    check (rating is null or (rating >= 1 and rating <= 10));

alter table public.snack_checks
    drop constraint if exists snack_checks_drink_note_check;
alter table public.snack_checks
    add constraint snack_checks_drink_note_check
    check (drink_note is null or length(trim(drink_note)) > 0);
