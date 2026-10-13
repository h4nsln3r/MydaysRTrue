-- Inner tasks on music sessions (bas, gitarr, rep, piano, övning, inspelning).
-- They stay open across placements and weeks until checked off or deleted.
-- Live and spelning are intentionally excluded.
-- Run AFTER 0103. Safe to run multiple times.

create table if not exists public.music_activity_todos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    activity text not null,
    text text not null,
    sort_order integer not null default 0,
    done_at timestamptz,
    done_placement_id uuid references public.weekly_task_placements (id) on delete set null,
    created_at timestamptz not null default now(),
    constraint music_activity_todos_activity_check check (
        activity in ('rep', 'bas', 'gitarr', 'piano', 'ovning', 'inspelning')
    ),
    constraint music_activity_todos_text_len_check check (
        char_length(trim(text)) between 1 and 200
    )
);

create index if not exists music_activity_todos_user_activity_idx
    on public.music_activity_todos (user_id, activity, sort_order);

create index if not exists music_activity_todos_done_placement_idx
    on public.music_activity_todos (done_placement_id)
    where done_placement_id is not null;

alter table public.music_activity_todos enable row level security;

drop policy if exists music_activity_todos_own on public.music_activity_todos;
create policy music_activity_todos_own on public.music_activity_todos
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

insert into public.music_activity_todos (user_id, activity, text, sort_order)
select distinct on (p.user_id, p.music_activity, lower(trim(p.plan_todo)))
    p.user_id,
    p.music_activity,
    trim(p.plan_todo),
    0
from public.weekly_task_placements p
where p.done_at is null
  and p.plan_todo is not null
  and char_length(trim(p.plan_todo)) between 1 and 200
  and p.music_activity in ('rep', 'bas', 'gitarr', 'piano', 'ovning', 'inspelning')
  and not exists (
      select 1
      from public.music_activity_todos t
      where t.user_id = p.user_id
        and t.activity = p.music_activity
        and t.done_at is null
        and lower(trim(t.text)) = lower(trim(p.plan_todo))
  )
order by p.user_id, p.music_activity, lower(trim(p.plan_todo)), p.created_at;

update public.weekly_task_placements p
set plan_todo = null
where p.done_at is null
  and p.plan_todo is not null
  and p.music_activity in ('rep', 'bas', 'gitarr', 'piano', 'ovning', 'inspelning')
  and exists (
      select 1
      from public.music_activity_todos t
      where t.user_id = p.user_id
        and t.activity = p.music_activity
        and t.done_at is null
        and lower(trim(t.text)) = lower(trim(p.plan_todo))
  );
