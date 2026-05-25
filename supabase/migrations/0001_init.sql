-- MyDays - initial schema
-- Run this in the Supabase SQL editor (Project -> SQL -> New query)
-- Safe to run multiple times.

-- =========================================================
-- Extensions
-- =========================================================
create extension if not exists "pgcrypto";

-- =========================================================
-- profiles
-- One row per auth user. Created automatically on signup.
-- =========================================================
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    daily_water_goal_ml integer not null default 2500
        check (daily_water_goal_ml between 250 and 20000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by owner" on public.profiles;
create policy "profiles are viewable by owner"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles are insertable by owner" on public.profiles;
create policy "profiles are insertable by owner"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles are updatable by owner" on public.profiles;
create policy "profiles are updatable by owner"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create a profile when a new auth user signs up
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
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- water_logs
-- Every drink the user logs.
-- local_date is the user's local date (YYYY-MM-DD) so daily totals
-- behave intuitively regardless of UTC.
-- =========================================================
create table if not exists public.water_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    amount_ml integer not null check (amount_ml > 0 and amount_ml <= 5000),
    logged_at timestamptz not null default now(),
    local_date date not null,
    note text,
    created_at timestamptz not null default now()
);

create index if not exists water_logs_user_date_idx
    on public.water_logs (user_id, local_date desc);

alter table public.water_logs enable row level security;

drop policy if exists "water_logs select own" on public.water_logs;
create policy "water_logs select own"
on public.water_logs for select
using (auth.uid() = user_id);

drop policy if exists "water_logs insert own" on public.water_logs;
create policy "water_logs insert own"
on public.water_logs for insert
with check (auth.uid() = user_id);

drop policy if exists "water_logs update own" on public.water_logs;
create policy "water_logs update own"
on public.water_logs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "water_logs delete own" on public.water_logs;
create policy "water_logs delete own"
on public.water_logs for delete
using (auth.uid() = user_id);
