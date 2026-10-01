-- Per daily habit: show or hide on semester/resa, ledig, sjuk and helg.
-- Run AFTER 0098_leave_travel.sql. Safe to run multiple times.
-- Defaults stay visible. Gör shake is hidden on semester and resa.

alter table public.habits
    add column if not exists show_on_vacation boolean not null default true;

alter table public.habits
    add column if not exists show_on_day_off boolean not null default true;

alter table public.habits
    add column if not exists show_on_sick boolean not null default true;

alter table public.habits
    add column if not exists show_on_weekend boolean not null default true;

comment on column public.habits.show_on_vacation is
    'When false, habit is hidden on semester and resa days.';

comment on column public.habits.show_on_day_off is
    'When false, habit is hidden on ledig periods from the year calendar.';

comment on column public.habits.show_on_sick is
    'When false, habit is hidden when the day is marked Är sjuk.';

comment on column public.habits.show_on_weekend is
    'When false, habit is hidden on Saturday and Sunday.';

update public.habits
set show_on_vacation = false
where key = 'gor_shake';

create or replace function public.seed_default_habits(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.habits (
        user_id, key, label, kind, icon, accent, sort_order,
        interval_days, interval_anchor_date, show_on_vacation
    )
    values
        (p_user_id, 'water',           'Vatten',          'water',           '💧', '#5fb6ff', 0,  1, null, true),
        (p_user_id, 'meals',           'Måltider',        'meal',            '🍽', '#ff9a3c', 1,  1, null, true),
        (p_user_id, 'snacks',          'Mellanmål',       'snack',           '🍎', '#ffcf3a', 2,  1, null, true),
        (p_user_id, 'intake',          'Intake',          'intake',          '💊', '#6ee7a3', 3,  1, null, true),
        (p_user_id, 'smoke_free',      'Rökfri',          'smoke_free',      '🚭', '#6ee7a3', 4,  1, null, true),
        (p_user_id, 'sugar_free',      'Sockerfri',       'tri_state',       '🍭', '#ffcf3a', 5,  1, null, true),
        (p_user_id, 'lite_stad',       'Lite städ',       'tri_state',       '🧹', '#6ee7a3', 6,  1, null, true),
        (p_user_id, 'activity_hours',  'Aktivitet',       'activity_hours',  '⏱', '#c084fc', 7,  1, null, true),
        (p_user_id, 'steps',           'Steg',            'steps',           '👟', '#5fb6ff', 8,  1, null, true),
        (p_user_id, 'media',           'Läsa & titta',    'media',           '📺', '#a78bfa', 9,  1, null, true),
        (p_user_id, 'mobile_games',    'Mobilspel',       'mobile_games',    '📱', '#f472b6', 10, 1, null, true),
        (p_user_id, 'mood',            'Dagskänsla',      'mood',            '🙂', '#fbbf24', 11, 1, null, true),
        (p_user_id, 'gor_shake',       'Gör shake',       'tri_state',       '🥤', '#38bdf8', 12, 2, current_date, false)
    on conflict (user_id, key) do nothing;
end;
$$;
