-- Daily work log (weekdays) — jobb start / jobb slut with optional notes
-- Run AFTER 0022_journal.sql. Safe to run multiple times.

create table if not exists public.work_daily_logs (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    started_at timestamptz,
    start_note text check (start_note is null or char_length(start_note) <= 500),
    ended_at timestamptz,
    end_note text check (end_note is null or char_length(end_note) <= 500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, local_date)
);

alter table public.work_daily_logs enable row level security;

drop policy if exists "work_daily_logs select own" on public.work_daily_logs;
create policy "work_daily_logs select own"
on public.work_daily_logs for select using (auth.uid() = user_id);

drop policy if exists "work_daily_logs insert own" on public.work_daily_logs;
create policy "work_daily_logs insert own"
on public.work_daily_logs for insert with check (auth.uid() = user_id);

drop policy if exists "work_daily_logs update own" on public.work_daily_logs;
create policy "work_daily_logs update own"
on public.work_daily_logs for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "work_daily_logs delete own" on public.work_daily_logs;
create policy "work_daily_logs delete own"
on public.work_daily_logs for delete using (auth.uid() = user_id);

drop trigger if exists work_daily_logs_set_updated_at on public.work_daily_logs;
create trigger work_daily_logs_set_updated_at
before update on public.work_daily_logs
for each row execute function public.set_updated_at();
