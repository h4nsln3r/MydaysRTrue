-- MyDays — habits + daily habit checks
-- Run AFTER 0001_init.sql and 0002_auto_rls_event_trigger.sql.
-- Safe to run multiple times.
--
-- Design notes
--   * `habits` defines the trackables for a user. Three defaults are seeded
--     (water, smoke-free, sugar-free). Users can add their own tri-state
--     habits later via the Profile screen.
--   * Water is stored as a habit row with kind='water' for uniform listing,
--     but its daily status is derived from water_logs — not habit_checks.
--   * Tri-state habits write to `habit_checks`. One row per (user, habit, day).
--     Absence of a row = "unset" (visually dim in the UI).

-- =========================================================
-- habits
-- =========================================================
create table if not exists public.habits (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,                  -- stable slug, e.g. 'smoke_free'
    label text not null,                -- display label
    kind text not null default 'tri_state'
        check (kind in ('tri_state', 'water')),
    icon text not null default '✓',     -- short emoji/text shown in chip
    accent text not null default '#ff7a1a',  -- accent color (hex)
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, key)
);

create index if not exists habits_user_active_idx
    on public.habits (user_id, sort_order)
    where archived_at is null;

alter table public.habits enable row level security;

drop policy if exists "habits select own" on public.habits;
create policy "habits select own"
on public.habits for select
using (auth.uid() = user_id);

drop policy if exists "habits insert own" on public.habits;
create policy "habits insert own"
on public.habits for insert
with check (auth.uid() = user_id);

drop policy if exists "habits update own" on public.habits;
create policy "habits update own"
on public.habits for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "habits delete own" on public.habits;
create policy "habits delete own"
on public.habits for delete
using (auth.uid() = user_id);

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

-- =========================================================
-- habit_checks — one row per (user, habit, local_date)
-- =========================================================
create table if not exists public.habit_checks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    habit_id uuid not null references public.habits(id) on delete cascade,
    local_date date not null,
    status text not null check (status in ('yes', 'half', 'no')),
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, habit_id, local_date)
);

create index if not exists habit_checks_user_date_idx
    on public.habit_checks (user_id, local_date desc);
create index if not exists habit_checks_user_habit_date_idx
    on public.habit_checks (user_id, habit_id, local_date desc);

alter table public.habit_checks enable row level security;

drop policy if exists "habit_checks select own" on public.habit_checks;
create policy "habit_checks select own"
on public.habit_checks for select
using (auth.uid() = user_id);

drop policy if exists "habit_checks insert own" on public.habit_checks;
create policy "habit_checks insert own"
on public.habit_checks for insert
with check (auth.uid() = user_id);

drop policy if exists "habit_checks update own" on public.habit_checks;
create policy "habit_checks update own"
on public.habit_checks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "habit_checks delete own" on public.habit_checks;
create policy "habit_checks delete own"
on public.habit_checks for delete
using (auth.uid() = user_id);

drop trigger if exists habit_checks_set_updated_at on public.habit_checks;
create trigger habit_checks_set_updated_at
before update on public.habit_checks
for each row execute function public.set_updated_at();

-- =========================================================
-- Default habit seeding
--   * Called from handle_new_user (signup) and from a backfill loop at the
--     bottom of this migration for users created before this ran.
-- =========================================================
create or replace function public.seed_default_habits(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.habits (user_id, key, label, kind, icon, accent, sort_order)
    values
        (p_user_id, 'water',      'Water',      'water',     '💧', '#5fb6ff', 0),
        (p_user_id, 'smoke_free', 'Smoke-free', 'tri_state', '🚭', '#6ee7a3', 1),
        (p_user_id, 'sugar_free', 'Sugar-free', 'tri_state', '🍭', '#ffcf3a', 2)
    on conflict (user_id, key) do nothing;
end;
$$;

-- Extend the signup trigger so new users get their defaults automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;

    perform public.seed_default_habits(new.id);

    return new;
end;
$$;

-- Backfill defaults for users that signed up before this migration.
do $$
declare
    u record;
begin
    for u in select id from auth.users
    loop
        perform public.seed_default_habits(u.id);
    end loop;
end;
$$;
