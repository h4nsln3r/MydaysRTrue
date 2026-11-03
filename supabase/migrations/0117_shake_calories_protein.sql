-- Optional calories and protein on a logged shake.
-- Either value, both, or neither may be filled in.

alter table public.intake_entries
    add column if not exists calories integer,
    add column if not exists protein_g integer;

alter table public.intake_entries
    drop constraint if exists intake_entries_calories_check;
alter table public.intake_entries
    add constraint intake_entries_calories_check
    check (calories is null or (calories >= 0 and calories <= 20000));

alter table public.intake_entries
    drop constraint if exists intake_entries_protein_g_check;
alter table public.intake_entries
    add constraint intake_entries_protein_g_check
    check (protein_g is null or (protein_g >= 0 and protein_g <= 1000));
