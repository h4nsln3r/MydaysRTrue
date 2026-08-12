-- Weekly Live task (like Rep) + per-category weekly goals.
-- Run AFTER 0076_weekly_task_repeatable_goal.sql. Safe to run multiple times.

alter table public.task_categories
    add column if not exists weekly_goal integer
        check (weekly_goal is null or weekly_goal between 1 and 14);

-- Archive the daily Live habit — Live moves to a weekly MUSIC task.
update public.habits
set
    archived_at = coalesce(archived_at, now()),
    enabled = false
where key = 'live_events'
  and archived_at is null;

-- Ensure weekly Live task for every user.
do $$
declare
    u record;
    music_id uuid;
    existing_id uuid;
begin
    for u in select id from auth.users loop
        select id into existing_id
        from public.weekly_tasks
        where user_id = u.id
          and key = 'music_live'
          and archived_at is null
        limit 1;

        if existing_id is not null then
            update public.weekly_tasks
            set
                title = 'Live',
                notes = 'Dra in hur många live-spelningar du vill — minst 2 per vecka. Välj band och anteckna vad ni gick igenom.',
                icon = '🎫',
                accent = '#f472b6',
                completion_kind = 'music',
                is_repeatable = true,
                weekly_goal = greatest(1, least(14, coalesce(weekly_goal, 2))),
                default_weekday = null,
                sort_order = 5
            where id = existing_id;
            continue;
        end if;

        select id into music_id
        from public.task_categories
        where user_id = u.id
          and scope = 'task'
          and name = 'MUSIC'
          and archived_at is null
        limit 1;

        if music_id is null then
            continue;
        end if;

        insert into public.weekly_tasks (
            user_id, category_id, key, title, notes, icon, accent,
            sort_order, default_weekday, completion_kind,
            is_repeatable, weekly_goal
        )
        values (
            u.id,
            music_id,
            'music_live',
            'Live',
            'Dra in hur många live-spelningar du vill — minst 2 per vecka. Välj band och anteckna vad ni gick igenom.',
            '🎫',
            '#f472b6',
            5,
            null,
            'music',
            true,
            2
        )
        on conflict (user_id, key) do update
        set
            archived_at = null,
            title = excluded.title,
            notes = excluded.notes,
            icon = excluded.icon,
            accent = excluded.accent,
            completion_kind = excluded.completion_kind,
            is_repeatable = true,
            weekly_goal = 2,
            category_id = excluded.category_id;
    end loop;
end;
$$;

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
        (p_user_id, 'smoke_free',      'Rökfri',          'smoke_free',      '🚭', '#6ee7a3', 4),
        (p_user_id, 'sugar_free',      'Sockerfri',       'tri_state',       '🍭', '#ffcf3a', 5),
        (p_user_id, 'lite_stad',       'Lite städ',       'tri_state',       '🧹', '#6ee7a3', 6),
        (p_user_id, 'activity_hours',  'Aktivitet',       'activity_hours',  '⏱', '#c084fc', 7),
        (p_user_id, 'steps',           'Steg',            'steps',           '👟', '#5fb6ff', 8),
        (p_user_id, 'media',           'Läsa & titta',    'media',           '📺', '#a78bfa', 9),
        (p_user_id, 'mobile_games',    'Mobilspel',       'mobile_games',    '📱', '#f472b6', 10),
        (p_user_id, 'mood',            'Dagskänsla',      'mood',            '🙂', '#fbbf24', 11)
    on conflict (user_id, key) do nothing;
end;
$$;

create or replace function public.seed_default_weekly_music(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    music_id uuid;
begin
    perform public.seed_default_weekly_categories(p_user_id);

    select id into music_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'MUSIC';

    insert into public.weekly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        default_weekday, completion_kind, is_repeatable, weekly_goal
    )
    values
        (
            p_user_id, music_id, 'music_guitar', 'Akustisk Gitarr',
            'Öva akustisk gitarr — lägg till låtar och övningar i listan.',
            '🎸', '#e879f9', 0, null, 'music', false, 2
        ),
        (
            p_user_id, music_id, 'music_bas', 'Bas',
            'Dra in hur många basövningar du vill — minst 2 per vecka. Lägg till låtar och övningar i listan.',
            '🎸', '#e879f9', 1, null, 'music', true, 2
        ),
        (
            p_user_id, music_id, 'music_inspelning', 'Inspelning',
            'Inspelningssession — anteckna vad du ska spela in.',
            '🎙️', '#e879f9', 3, null, 'music', false, 2
        ),
        (
            p_user_id, music_id, 'music_rep', 'Rep',
            'Dra in hur många reps du vill — minst 2 per vecka. Välj band och anteckna vad ni gick igenom.',
            '🤘', '#e879f9', 4, null, 'music', true, 2
        ),
        (
            p_user_id, music_id, 'music_live', 'Live',
            'Dra in hur många live-spelningar du vill — minst 2 per vecka. Välj band och anteckna vad ni gick igenom.',
            '🎫', '#f472b6', 5, null, 'music', true, 2
        )
    on conflict (user_id, key) do nothing;
end;
$$;
