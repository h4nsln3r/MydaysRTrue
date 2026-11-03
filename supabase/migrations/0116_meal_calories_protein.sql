-- Optional calories and protein on meals and snacks.
-- Either value, both, or neither may be filled in.

alter table public.meal_entries
    add column if not exists calories integer,
    add column if not exists protein_g integer;

alter table public.meal_entries
    drop constraint if exists meal_entries_calories_check;
alter table public.meal_entries
    add constraint meal_entries_calories_check
    check (calories is null or (calories >= 0 and calories <= 20000));

alter table public.meal_entries
    drop constraint if exists meal_entries_protein_g_check;
alter table public.meal_entries
    add constraint meal_entries_protein_g_check
    check (protein_g is null or (protein_g >= 0 and protein_g <= 1000));

alter table public.snack_checks
    add column if not exists calories integer,
    add column if not exists protein_g integer;

alter table public.snack_checks
    drop constraint if exists snack_checks_calories_check;
alter table public.snack_checks
    add constraint snack_checks_calories_check
    check (calories is null or (calories >= 0 and calories <= 20000));

alter table public.snack_checks
    drop constraint if exists snack_checks_protein_g_check;
alter table public.snack_checks
    add constraint snack_checks_protein_g_check
    check (protein_g is null or (protein_g >= 0 and protein_g <= 1000));
