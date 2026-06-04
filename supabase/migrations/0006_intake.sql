-- MyDays — Daily intake (Fruit, Creatine, Vitamins, Shake)
-- Run AFTER 0005_tasks.sql. Safe to run multiple times.
--
-- Design notes
--   * Mirrors meal_entries but for the user's other daily intakes:
--       fruit:    1/day, must say which fruit.
--       creatine: 1/day, water amount optional and linked to water_logs.
--       vitamin: 1/day on weekdays, must list which kinds.
--       shake:   1/day on weekdays, just a tap (description optional).
--   * Uniqueness is per (user, date, kind) → "fill in once per day".
--   * "Weekdays only" is enforced in the UI, not the schema, so weekend
--     backfills aren't blocked at the DB level if the user wants them.
--   * Just like meals: when water is logged with creatine we also create a
--     `water_logs` row, linked via `intake_entries.water_log_id`. The same
--     liquid only has to be typed once and shows up in /water automatically.

create table if not exists public.intake_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    kind text not null check (kind in ('fruit', 'creatine', 'vitamin', 'shake')),
    description text not null default '',
    water_log_id uuid references public.water_logs(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, local_date, kind)
);

create index if not exists intake_entries_user_date_idx
    on public.intake_entries (user_id, local_date desc);

alter table public.intake_entries enable row level security;

drop policy if exists "intake_entries select own" on public.intake_entries;
create policy "intake_entries select own"
on public.intake_entries for select
using (auth.uid() = user_id);

drop policy if exists "intake_entries insert own" on public.intake_entries;
create policy "intake_entries insert own"
on public.intake_entries for insert
with check (auth.uid() = user_id);

drop policy if exists "intake_entries update own" on public.intake_entries;
create policy "intake_entries update own"
on public.intake_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "intake_entries delete own" on public.intake_entries;
create policy "intake_entries delete own"
on public.intake_entries for delete
using (auth.uid() = user_id);

drop trigger if exists intake_entries_set_updated_at on public.intake_entries;
create trigger intake_entries_set_updated_at
before update on public.intake_entries
for each row execute function public.set_updated_at();
