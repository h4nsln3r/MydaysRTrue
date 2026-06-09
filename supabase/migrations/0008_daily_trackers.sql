-- MyDays — daily tracker toggles, steps & activity hours
-- Run AFTER 0007_gym.sql. Safe to run multiple times.

-- =========================================================
-- habits.enabled — turn trackers on/off without archiving
-- =========================================================
alter table public.habits
    add column if not exists enabled boolean not null default true;

-- =========================================================
-- Extend habits.kind for steps + activity hours
-- =========================================================
alter table public.habits drop constraint if exists habits_kind_check;
alter table public.habits add constraint habits_kind_check
    check (kind in ('tri_state', 'water', 'meal', 'steps', 'activity_hours'));

-- =========================================================
-- Profile goals for steps & activity
-- =========================================================
alter table public.profiles
    add column if not exists daily_steps_goal integer not null default 8000
        check (daily_steps_goal between 100 and 100000);

alter table public.profiles
    add column if not exists daily_activity_hours_goal numeric(4, 1) not null default 12
        check (daily_activity_hours_goal between 0 and 24);

-- =========================================================
-- daily_activity_logs — one row per (user, day)
-- =========================================================
create table if not exists public.daily_activity_logs (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    steps integer check (steps is null or (steps >= 0 and steps <= 200000)),
    activity_hours numeric(4, 1) check (
        activity_hours is null or (activity_hours >= 0 and activity_hours <= 24)
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, local_date)
);

create index if not exists daily_activity_logs_user_date_idx
    on public.daily_activity_logs (user_id, local_date desc);

alter table public.daily_activity_logs enable row level security;

drop policy if exists "daily_activity select own" on public.daily_activity_logs;
create policy "daily_activity select own"
on public.daily_activity_logs for select
using (auth.uid() = user_id);

drop policy if exists "daily_activity insert own" on public.daily_activity_logs;
create policy "daily_activity insert own"
on public.daily_activity_logs for insert
with check (auth.uid() = user_id);

drop policy if exists "daily_activity update own" on public.daily_activity_logs;
create policy "daily_activity update own"
on public.daily_activity_logs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_activity delete own" on public.daily_activity_logs;
create policy "daily_activity delete own"
on public.daily_activity_logs for delete
using (auth.uid() = user_id);

drop trigger if exists daily_activity_logs_set_updated_at on public.daily_activity_logs;
create trigger daily_activity_logs_set_updated_at
before update on public.daily_activity_logs
for each row execute function public.set_updated_at();

-- =========================================================
-- Seed steps + activity habits; keep handle_new_user in sync
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
        (p_user_id, 'water',           'Water',           'water',           '💧', '#5fb6ff', 0),
        (p_user_id, 'smoke_free',      'Smoke-free',      'tri_state',       '🚭', '#6ee7a3', 1),
        (p_user_id, 'sugar_free',      'Sugar-free',      'tri_state',       '🍭', '#ffcf3a', 2),
        (p_user_id, 'steps',           'Steps',           'steps',           '👟', '#5fb6ff', 3),
        (p_user_id, 'activity_hours',  'Activity',        'activity_hours',  '⏱', '#c084fc', 4)
    on conflict (user_id, key) do nothing;
end;
$$;

-- Backfill new habits for existing users.
do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_habits(u.id);
    end loop;
end;
$$;
