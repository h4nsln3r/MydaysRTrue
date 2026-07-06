-- MyDays — per-day checklist completions with notes (music sub-tasks)
-- Run AFTER 0048_live_events.sql. Safe to run multiple times.

create table if not exists public.weekly_task_checklist_completions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    checklist_item_id uuid not null references public.weekly_task_checklist_items (id) on delete cascade,
    local_date date not null,
    note text check (note is null or char_length(note) <= 500),
    done_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (checklist_item_id, local_date)
);

create index if not exists weekly_task_checklist_completions_user_date_idx
    on public.weekly_task_checklist_completions (user_id, local_date desc);

alter table public.weekly_task_checklist_completions enable row level security;

drop policy if exists weekly_task_checklist_completions_own
    on public.weekly_task_checklist_completions;
create policy weekly_task_checklist_completions_own
    on public.weekly_task_checklist_completions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Migrate legacy done_at on template rows into dated completions
insert into public.weekly_task_checklist_completions (
    user_id, checklist_item_id, local_date, done_at
)
select
    c.user_id,
    c.id,
    (c.done_at at time zone 'UTC')::date,
    c.done_at
from public.weekly_task_checklist_items c
where c.done_at is not null
on conflict (checklist_item_id, local_date) do nothing;

update public.weekly_task_checklist_items
set done_at = null
where done_at is not null;
