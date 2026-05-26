-- MyDays — Meals (Breakfast / Lunch / Dinner)
-- Run AFTER 0003_habits.sql. Safe to run multiple times.
--
-- Design notes
--   * Meals are a special kind of habit. Three slots per day (breakfast,
--     lunch, dinner). Each slot needs a description (what was eaten); water
--     drunk with the meal is optional.
--   * When water is logged with a meal we also insert a regular `water_logs`
--     row, linked from `meal_entries.water_log_id`. That way the same log
--     shows up in /water's Today's log AND in the day's water totals — the
--     user only types it once.
--   * The "Meals" habit row sits on `public.habits` with kind='meal'.
--     Daily rollup (for week/month dots): 3 logged = yes, 2 = half, 0-1 = no.

-- =========================================================
-- Extend habits.kind to allow 'meal'
-- =========================================================
alter table public.habits drop constraint if exists habits_kind_check;
alter table public.habits add constraint habits_kind_check
    check (kind in ('tri_state', 'water', 'meal'));

-- =========================================================
-- meal_entries
-- =========================================================
create table if not exists public.meal_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    meal text not null check (meal in ('breakfast', 'lunch', 'dinner')),
    description text not null check (length(trim(description)) > 0),
    water_log_id uuid references public.water_logs(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, local_date, meal)
);

create index if not exists meal_entries_user_date_idx
    on public.meal_entries (user_id, local_date desc);

alter table public.meal_entries enable row level security;

drop policy if exists "meal_entries select own" on public.meal_entries;
create policy "meal_entries select own"
on public.meal_entries for select
using (auth.uid() = user_id);

drop policy if exists "meal_entries insert own" on public.meal_entries;
create policy "meal_entries insert own"
on public.meal_entries for insert
with check (auth.uid() = user_id);

drop policy if exists "meal_entries update own" on public.meal_entries;
create policy "meal_entries update own"
on public.meal_entries for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meal_entries delete own" on public.meal_entries;
create policy "meal_entries delete own"
on public.meal_entries for delete
using (auth.uid() = user_id);

drop trigger if exists meal_entries_set_updated_at on public.meal_entries;
create trigger meal_entries_set_updated_at
before update on public.meal_entries
for each row execute function public.set_updated_at();

-- =========================================================
-- Default-habit seeding includes Meals from now on.
-- New sort order: water (0), meals (1), smoke_free (2), sugar_free (3).
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
        (p_user_id, 'meals',      'Meals',      'meal',      '🍽',  '#ff9a3c', 1),
        (p_user_id, 'smoke_free', 'Smoke-free', 'tri_state', '🚭', '#6ee7a3', 2),
        (p_user_id, 'sugar_free', 'Sugar-free', 'tri_state', '🍭', '#ffcf3a', 3)
    on conflict (user_id, key) do nothing;
end;
$$;

-- Backfill — give existing users their Meals habit. Bump any tri-state
-- defaults out of the way first so the order stays water → meals → others.
do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        if not exists (
            select 1 from public.habits where user_id = u.id and key = 'meals'
        ) then
            update public.habits
            set sort_order = sort_order + 1
            where user_id = u.id and key in ('smoke_free', 'sugar_free');
        end if;
        perform public.seed_default_habits(u.id);
    end loop;
end;
$$;
