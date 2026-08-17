-- Interval recurrence on daily habits (every N days) + "Gör shake".
-- Run AFTER 0079_unified_music_task.sql. Safe to run multiple times.
--
-- interval_days = 1 → every day (default).
-- interval_days = 2 → every other day from interval_anchor_date (inclusive).

alter table public.habits
    add column if not exists interval_days integer not null default 1;

alter table public.habits
    add column if not exists interval_anchor_date date;

alter table public.habits
    drop constraint if exists habits_interval_days_check;

alter table public.habits
    add constraint habits_interval_days_check
    check (interval_days >= 1 and interval_days <= 14);

alter table public.habits
    drop constraint if exists habits_interval_anchor_check;

alter table public.habits
    add constraint habits_interval_anchor_check
    check (interval_days = 1 or interval_anchor_date is not null);

create or replace function public.seed_default_habits(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.habits (
        user_id, key, label, kind, icon, accent, sort_order,
        interval_days, interval_anchor_date
    )
    values
        (p_user_id, 'water',           'Vatten',          'water',           '💧', '#5fb6ff', 0,  1, null),
        (p_user_id, 'meals',           'Måltider',        'meal',            '🍽', '#ff9a3c', 1,  1, null),
        (p_user_id, 'snacks',          'Mellanmål',       'snack',           '🍎', '#ffcf3a', 2,  1, null),
        (p_user_id, 'intake',          'Intake',          'intake',          '💊', '#6ee7a3', 3,  1, null),
        (p_user_id, 'smoke_free',      'Rökfri',          'smoke_free',      '🚭', '#6ee7a3', 4,  1, null),
        (p_user_id, 'sugar_free',      'Sockerfri',       'tri_state',       '🍭', '#ffcf3a', 5,  1, null),
        (p_user_id, 'lite_stad',       'Lite städ',       'tri_state',       '🧹', '#6ee7a3', 6,  1, null),
        (p_user_id, 'activity_hours',  'Aktivitet',       'activity_hours',  '⏱', '#c084fc', 7,  1, null),
        (p_user_id, 'steps',           'Steg',            'steps',           '👟', '#5fb6ff', 8,  1, null),
        (p_user_id, 'media',           'Läsa & titta',    'media',           '📺', '#a78bfa', 9,  1, null),
        (p_user_id, 'mobile_games',    'Mobilspel',       'mobile_games',    '📱', '#f472b6', 10, 1, null),
        (p_user_id, 'mood',            'Dagskänsla',      'mood',            '🙂', '#fbbf24', 11, 1, null),
        (p_user_id, 'gor_shake',       'Gör shake',       'tri_state',       '🥤', '#38bdf8', 12, 2, current_date)
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
