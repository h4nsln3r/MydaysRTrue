-- Daily journal / dagbok — manual notes per day
-- Run AFTER 0021_mood.sql. Safe to run multiple times.

create table if not exists public.journal_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists journal_entries_user_date_idx
    on public.journal_entries (user_id, local_date desc, created_at desc);

alter table public.journal_entries enable row level security;

drop policy if exists "journal_entries select own" on public.journal_entries;
create policy "journal_entries select own"
on public.journal_entries for select using (auth.uid() = user_id);

drop policy if exists "journal_entries insert own" on public.journal_entries;
create policy "journal_entries insert own"
on public.journal_entries for insert with check (auth.uid() = user_id);

drop policy if exists "journal_entries update own" on public.journal_entries;
create policy "journal_entries update own"
on public.journal_entries for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "journal_entries delete own" on public.journal_entries;
create policy "journal_entries delete own"
on public.journal_entries for delete using (auth.uid() = user_id);

drop trigger if exists journal_entries_set_updated_at on public.journal_entries;
create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row execute function public.set_updated_at();
