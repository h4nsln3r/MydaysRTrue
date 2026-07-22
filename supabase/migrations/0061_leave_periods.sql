-- Leave periods (semester / ledig) — suppress jobb start/slut on those days.
-- Run AFTER 0060_music_task_gig_live.sql. Safe to run multiple times.

create table if not exists public.leave_periods (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    kind text not null check (kind in ('vacation', 'day_off')),
    start_date date not null,
    end_date date not null,
    note text check (note is null or char_length(note) <= 280),
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint leave_periods_range_ok check (end_date >= start_date)
);

create index if not exists leave_periods_user_range_idx
    on public.leave_periods (user_id, start_date, end_date);

alter table public.leave_periods enable row level security;

drop policy if exists "leave_periods select own" on public.leave_periods;
create policy "leave_periods select own"
on public.leave_periods for select using (auth.uid() = user_id);

drop policy if exists "leave_periods insert own" on public.leave_periods;
create policy "leave_periods insert own"
on public.leave_periods for insert with check (auth.uid() = user_id);

drop policy if exists "leave_periods update own" on public.leave_periods;
create policy "leave_periods update own"
on public.leave_periods for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leave_periods delete own" on public.leave_periods;
create policy "leave_periods delete own"
on public.leave_periods for delete using (auth.uid() = user_id);

drop trigger if exists leave_periods_set_updated_at on public.leave_periods;
create trigger leave_periods_set_updated_at
before update on public.leave_periods
for each row execute function public.set_updated_at();
