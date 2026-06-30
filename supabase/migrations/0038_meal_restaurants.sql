-- MyDays — Meal restaurants & extended cooking metadata
-- Run AFTER 0037_monthly_salary.sql. Safe to run multiple times.
--
-- Adds reusable restaurants per user and extends lunch/dinner cooking options
-- with "restaurant" (linked name) and "other" (free-text cook name).

-- =========================================================
-- meal_restaurants
-- =========================================================
create table if not exists public.meal_restaurants (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (length(trim(name)) > 0 and length(name) <= 120),
    created_at timestamptz not null default now()
);

create unique index if not exists meal_restaurants_user_name_lower_idx
    on public.meal_restaurants (user_id, lower(trim(name)));

create index if not exists meal_restaurants_user_idx
    on public.meal_restaurants (user_id, name);

alter table public.meal_restaurants enable row level security;

drop policy if exists "meal_restaurants select own" on public.meal_restaurants;
create policy "meal_restaurants select own"
on public.meal_restaurants for select
using (auth.uid() = user_id);

drop policy if exists "meal_restaurants insert own" on public.meal_restaurants;
create policy "meal_restaurants insert own"
on public.meal_restaurants for insert
with check (auth.uid() = user_id);

drop policy if exists "meal_restaurants update own" on public.meal_restaurants;
create policy "meal_restaurants update own"
on public.meal_restaurants for update
using (auth.uid() = user_id);

drop policy if exists "meal_restaurants delete own" on public.meal_restaurants;
create policy "meal_restaurants delete own"
on public.meal_restaurants for delete
using (auth.uid() = user_id);

-- =========================================================
-- meal_entries — restaurant + other cook
-- =========================================================
alter table public.meal_entries
  add column if not exists restaurant_id uuid
    references public.meal_restaurants(id) on delete set null,
  add column if not exists cooked_by_name text
    check (
      cooked_by_name is null
      or (length(trim(cooked_by_name)) > 0 and length(cooked_by_name) <= 80)
    );

alter table public.meal_entries drop constraint if exists meal_entries_cooked_by_check;
alter table public.meal_entries add constraint meal_entries_cooked_by_check
    check (cooked_by is null or cooked_by in ('self', 'julia', 'bought', 'restaurant', 'other'));

create index if not exists meal_entries_restaurant_idx
    on public.meal_entries (user_id, restaurant_id)
    where restaurant_id is not null;
