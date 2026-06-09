-- MyDays — Snacks (2 check-offs per day) + habit kind 'snack'
-- Run AFTER 0008_daily_trackers.sql. Safe to run multiple times.

alter table public.habits drop constraint if exists habits_kind_check;
alter table public.habits add constraint habits_kind_check
    check (kind in (
        'tri_state', 'water', 'meal', 'snack', 'steps', 'activity_hours'
    ));

-- =========================================================
-- snack_checks — slot 1 or 2 per day
-- =========================================================
create table if not exists public.snack_checks (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    slot smallint not null check (slot in (1, 2)),
    done_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    primary key (user_id, local_date, slot)
);

create index if not exists snack_checks_user_date_idx
    on public.snack_checks (user_id, local_date desc);

alter table public.snack_checks enable row level security;

drop policy if exists "snack_checks select own" on public.snack_checks;
create policy "snack_checks select own"
on public.snack_checks for select
using (auth.uid() = user_id);

drop policy if exists "snack_checks insert own" on public.snack_checks;
create policy "snack_checks insert own"
on public.snack_checks for insert
with check (auth.uid() = user_id);

drop policy if exists "snack_checks delete own" on public.snack_checks;
create policy "snack_checks delete own"
on public.snack_checks for delete
using (auth.uid() = user_id);

-- =========================================================
-- Default habits — meals + snacks; steps last
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
        (p_user_id, 'water',           'Vatten',          'water',           '💧', '#5fb6ff', 0),
        (p_user_id, 'meals',           'Måltider',        'meal',            '🍽', '#ff9a3c', 1),
        (p_user_id, 'snacks',          'Mellanmål',       'snack',           '🍎', '#ffcf3a', 2),
        (p_user_id, 'smoke_free',      'Rökfri',          'tri_state',       '🚭', '#6ee7a3', 3),
        (p_user_id, 'sugar_free',      'Sockerfri',       'tri_state',       '🍭', '#ffcf3a', 4),
        (p_user_id, 'activity_hours',  'Aktivitet',       'activity_hours',  '⏱', '#c084fc', 5),
        (p_user_id, 'steps',           'Steg',            'steps',           '👟', '#5fb6ff', 6)
    on conflict (user_id, key) do nothing;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_habits(u.id);
    end loop;
end;
$$;
