-- Custom sort order for journal / dagbok entries (manual + auto).
-- Run AFTER 0061_leave_periods.sql. Safe to run multiple times.

create table if not exists public.journal_entry_orders (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    entry_id text not null check (length(trim(entry_id)) > 0),
    sort_order integer not null default 0,
    primary key (user_id, local_date, entry_id)
);

create index if not exists journal_entry_orders_user_date_idx
    on public.journal_entry_orders (user_id, local_date, sort_order);

alter table public.journal_entry_orders enable row level security;

drop policy if exists "journal_entry_orders select own" on public.journal_entry_orders;
create policy "journal_entry_orders select own"
on public.journal_entry_orders for select
using (auth.uid() = user_id);

drop policy if exists "journal_entry_orders insert own" on public.journal_entry_orders;
create policy "journal_entry_orders insert own"
on public.journal_entry_orders for insert
with check (auth.uid() = user_id);

drop policy if exists "journal_entry_orders update own" on public.journal_entry_orders;
create policy "journal_entry_orders update own"
on public.journal_entry_orders for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "journal_entry_orders delete own" on public.journal_entry_orders;
create policy "journal_entry_orders delete own"
on public.journal_entry_orders for delete
using (auth.uid() = user_id);
