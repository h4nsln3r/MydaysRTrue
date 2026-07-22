-- Body text overrides for auto journal entries (gym, tasks, etc.).
-- Manual notes still live in journal_entries. Safe to run multiple times.

create table if not exists public.journal_entry_edits (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    entry_id text not null check (length(trim(entry_id)) > 0),
    body text not null check (char_length(body) <= 2000),
    updated_at timestamptz not null default now(),
    primary key (user_id, local_date, entry_id)
);

create index if not exists journal_entry_edits_user_date_idx
    on public.journal_entry_edits (user_id, local_date);

alter table public.journal_entry_edits enable row level security;

drop policy if exists "journal_entry_edits select own" on public.journal_entry_edits;
create policy "journal_entry_edits select own"
on public.journal_entry_edits for select
using (auth.uid() = user_id);

drop policy if exists "journal_entry_edits insert own" on public.journal_entry_edits;
create policy "journal_entry_edits insert own"
on public.journal_entry_edits for insert
with check (auth.uid() = user_id);

drop policy if exists "journal_entry_edits update own" on public.journal_entry_edits;
create policy "journal_entry_edits update own"
on public.journal_entry_edits for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "journal_entry_edits delete own" on public.journal_entry_edits;
create policy "journal_entry_edits delete own"
on public.journal_entry_edits for delete
using (auth.uid() = user_id);

drop trigger if exists journal_entry_edits_set_updated_at on public.journal_entry_edits;
create trigger journal_entry_edits_set_updated_at
before update on public.journal_entry_edits
for each row execute function public.set_updated_at();
