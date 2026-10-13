-- Inner tasks for Hemmaprojekt. They stay open across placements and weeks
-- until checked off when the session is completed, or deleted.
-- Run AFTER 0104. Safe to run multiple times.

create table if not exists public.home_project_todos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    text text not null,
    sort_order integer not null default 0,
    done_at timestamptz,
    done_placement_id uuid references public.weekly_task_placements (id) on delete set null,
    created_at timestamptz not null default now(),
    constraint home_project_todos_text_len_check check (
        char_length(trim(text)) between 1 and 200
    )
);

create index if not exists home_project_todos_user_idx
    on public.home_project_todos (user_id, sort_order);

create index if not exists home_project_todos_done_placement_idx
    on public.home_project_todos (done_placement_id)
    where done_placement_id is not null;

alter table public.home_project_todos enable row level security;

drop policy if exists home_project_todos_own on public.home_project_todos;
create policy home_project_todos_own on public.home_project_todos
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
