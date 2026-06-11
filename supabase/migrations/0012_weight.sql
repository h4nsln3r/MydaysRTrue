-- MyDays — Weekly weight check (plan per week + daily log)
-- Run AFTER 0011_cardio.sql. Safe to run multiple times.
--
-- Design notes
--   * One weight check per ISO week — toggled on/off in veckoplanering.
--   * When enabled, drag to a weekday (or leave unplaced in backlog).
--   * On the scheduled day the user logs time-of-day (morning/day/evening) + kg.

-- =========================================================
-- weight_week_plans — per-user, per-week scheduling
-- =========================================================
create table if not exists public.weight_week_plans (
    user_id uuid not null references auth.users(id) on delete cascade,
    week_start date not null,
    enabled boolean not null default true,
    weekday integer check (weekday is null or weekday between 1 and 7),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, week_start)
);

create index if not exists weight_week_plans_user_week_idx
    on public.weight_week_plans (user_id, week_start desc);

alter table public.weight_week_plans enable row level security;

drop policy if exists "weight_week_plans select own" on public.weight_week_plans;
create policy "weight_week_plans select own"
on public.weight_week_plans for select
using (auth.uid() = user_id);

drop policy if exists "weight_week_plans insert own" on public.weight_week_plans;
create policy "weight_week_plans insert own"
on public.weight_week_plans for insert
with check (auth.uid() = user_id);

drop policy if exists "weight_week_plans update own" on public.weight_week_plans;
create policy "weight_week_plans update own"
on public.weight_week_plans for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "weight_week_plans delete own" on public.weight_week_plans;
create policy "weight_week_plans delete own"
on public.weight_week_plans for delete
using (auth.uid() = user_id);

drop trigger if exists weight_week_plans_set_updated_at on public.weight_week_plans;
create trigger weight_week_plans_set_updated_at
before update on public.weight_week_plans
for each row execute function public.set_updated_at();

-- =========================================================
-- weight_logs — one weigh-in per calendar day
-- =========================================================
create table if not exists public.weight_logs (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    time_of_day text not null check (time_of_day in ('morning', 'day', 'evening')),
    weight_kg numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 500),
    logged_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, local_date)
);

create index if not exists weight_logs_user_date_idx
    on public.weight_logs (user_id, local_date desc);

alter table public.weight_logs enable row level security;

drop policy if exists "weight_logs select own" on public.weight_logs;
create policy "weight_logs select own"
on public.weight_logs for select
using (auth.uid() = user_id);

drop policy if exists "weight_logs insert own" on public.weight_logs;
create policy "weight_logs insert own"
on public.weight_logs for insert
with check (auth.uid() = user_id);

drop policy if exists "weight_logs update own" on public.weight_logs;
create policy "weight_logs update own"
on public.weight_logs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "weight_logs delete own" on public.weight_logs;
create policy "weight_logs delete own"
on public.weight_logs for delete
using (auth.uid() = user_id);

drop trigger if exists weight_logs_set_updated_at on public.weight_logs;
create trigger weight_logs_set_updated_at
before update on public.weight_logs
for each row execute function public.set_updated_at();
