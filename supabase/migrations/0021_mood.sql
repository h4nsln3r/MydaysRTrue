-- Daily mood / day feeling tracker
-- Run AFTER 0020_bathing_repeatable_placements.sql. Safe to run multiple times.

alter table public.habits drop constraint if exists habits_kind_check;
alter table public.habits add constraint habits_kind_check
    check (kind in (
        'tri_state', 'water', 'meal', 'snack', 'intake',
        'steps', 'activity_hours', 'media', 'mobile_games', 'mood'
    ));

create table if not exists public.mood_daily_logs (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    mood text not null check (mood in (
        'angry', 'sad', 'stressed', 'tired', 'happy', 'joyful'
    )),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, local_date)
);

alter table public.mood_daily_logs enable row level security;

drop policy if exists "mood_daily_logs select own" on public.mood_daily_logs;
create policy "mood_daily_logs select own"
on public.mood_daily_logs for select using (auth.uid() = user_id);

drop policy if exists "mood_daily_logs insert own" on public.mood_daily_logs;
create policy "mood_daily_logs insert own"
on public.mood_daily_logs for insert with check (auth.uid() = user_id);

drop policy if exists "mood_daily_logs update own" on public.mood_daily_logs;
create policy "mood_daily_logs update own"
on public.mood_daily_logs for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "mood_daily_logs delete own" on public.mood_daily_logs;
create policy "mood_daily_logs delete own"
on public.mood_daily_logs for delete using (auth.uid() = user_id);

drop trigger if exists mood_daily_logs_set_updated_at on public.mood_daily_logs;
create trigger mood_daily_logs_set_updated_at
before update on public.mood_daily_logs
for each row execute function public.set_updated_at();

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
        (p_user_id, 'intake',          'Intake',          'intake',          '💊', '#6ee7a3', 3),
        (p_user_id, 'smoke_free',      'Rökfri',          'tri_state',       '🚭', '#6ee7a3', 4),
        (p_user_id, 'sugar_free',      'Sockerfri',       'tri_state',       '🍭', '#ffcf3a', 5),
        (p_user_id, 'activity_hours',  'Aktivitet',       'activity_hours',  '⏱', '#c084fc', 6),
        (p_user_id, 'steps',           'Steg',            'steps',           '👟', '#5fb6ff', 7),
        (p_user_id, 'media',           'Läsa & titta',    'media',           '📺', '#a78bfa', 8),
        (p_user_id, 'mobile_games',    'Mobilspel',       'mobile_games',    '📱', '#f472b6', 9),
        (p_user_id, 'mood',            'Dagskänsla',      'mood',            '🙂', '#fbbf24', 10)
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
