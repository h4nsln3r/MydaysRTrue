-- Consolidate Bas + Sportpass into single repeatable sources (like Rep / Bad).
-- Run AFTER 0074_repeatable_music_rep.sql. Safe to run multiple times.

-- Allow multiple sport placements of the same template in one week.
alter table public.sport_week_placements
    drop constraint if exists sport_week_placements_user_id_template_id_week_start_key;

-- ── Bas (weekly task) ──────────────────────────────────────────────────────
do $$
declare
    u record;
    canonical_id uuid;
    legacy record;
    music_category_id uuid;
begin
    for u in select id from auth.users loop
        select id into canonical_id
        from public.weekly_tasks
        where user_id = u.id
          and key = 'music_bas'
          and archived_at is null
        limit 1;

        if canonical_id is null then
            select id into canonical_id
            from public.weekly_tasks
            where user_id = u.id
              and key like 'music_bas_%'
              and archived_at is null
            order by sort_order, created_at
            limit 1;

            if canonical_id is not null then
                update public.weekly_tasks
                set
                    key = 'music_bas',
                    title = 'Bas',
                    notes = 'Dra in hur många basövningar du vill — minst 2 per vecka. Lägg till låtar och övningar i listan.',
                    icon = '🎸',
                    accent = '#e879f9',
                    completion_kind = 'music',
                    default_weekday = null,
                    sort_order = 1
                where id = canonical_id;
            else
                select id into music_category_id
                from public.task_categories
                where user_id = u.id
                  and scope = 'task'
                  and name = 'MUSIC'
                  and archived_at is null
                limit 1;

                if music_category_id is not null then
                    insert into public.weekly_tasks (
                        user_id, category_id, key, title, notes, icon, accent,
                        sort_order, default_weekday, completion_kind
                    )
                    values (
                        u.id,
                        music_category_id,
                        'music_bas',
                        'Bas',
                        'Dra in hur många basövningar du vill — minst 2 per vecka. Lägg till låtar och övningar i listan.',
                        '🎸',
                        '#e879f9',
                        1,
                        null,
                        'music'
                    )
                    returning id into canonical_id;
                end if;
            end if;
        else
            update public.weekly_tasks
            set
                title = 'Bas',
                notes = 'Dra in hur många basövningar du vill — minst 2 per vecka. Lägg till låtar och övningar i listan.',
                default_weekday = null
            where id = canonical_id;
        end if;

        if canonical_id is null then
            continue;
        end if;

        for legacy in
            select id
            from public.weekly_tasks
            where user_id = u.id
              and archived_at is null
              and id <> canonical_id
              and (
                  key like 'music_bas_%'
                  or key = 'music_bas'
              )
        loop
            update public.weekly_task_placements
            set task_id = canonical_id
            where user_id = u.id
              and task_id = legacy.id;

            update public.weekly_tasks
            set archived_at = now()
            where id = legacy.id;
        end loop;
    end loop;
end;
$$;

-- ── Sportpass (session template) ───────────────────────────────────────────
do $$
declare
    u record;
    canonical_id uuid;
    legacy record;
begin
    for u in select id from auth.users loop
        select id into canonical_id
        from public.sport_session_templates
        where user_id = u.id
          and key = 'sport'
          and archived_at is null
        limit 1;

        if canonical_id is null then
            select id into canonical_id
            from public.sport_session_templates
            where user_id = u.id
              and key like 'sport_%'
              and archived_at is null
            order by sort_order, created_at
            limit 1;

            if canonical_id is not null then
                update public.sport_session_templates
                set
                    key = 'sport',
                    label = 'Sportpass',
                    description = 'Dra in hur många sportpass du vill — minst 2 per vecka. Välj sport och logga efteråt.',
                    icon = '🏸',
                    accent = '#a78bfa',
                    sort_order = 0,
                    default_weekday = 3
                where id = canonical_id;
            else
                insert into public.sport_session_templates (
                    user_id, key, label, description, icon, accent,
                    sort_order, default_weekday
                )
                values (
                    u.id,
                    'sport',
                    'Sportpass',
                    'Dra in hur många sportpass du vill — minst 2 per vecka. Välj sport och logga efteråt.',
                    '🏸',
                    '#a78bfa',
                    0,
                    3
                )
                returning id into canonical_id;
            end if;
        else
            update public.sport_session_templates
            set
                label = 'Sportpass',
                description = 'Dra in hur många sportpass du vill — minst 2 per vecka. Välj sport och logga efteråt.',
                default_weekday = 3
            where id = canonical_id;
        end if;

        if canonical_id is null then
            continue;
        end if;

        for legacy in
            select id
            from public.sport_session_templates
            where user_id = u.id
              and archived_at is null
              and id <> canonical_id
              and (
                  key like 'sport_%'
                  or key = 'sport'
              )
        loop
            update public.sport_week_placements
            set template_id = canonical_id
            where user_id = u.id
              and template_id = legacy.id;

            update public.sport_session_templates
            set archived_at = now()
            where id = legacy.id;
        end loop;
    end loop;
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
        default_weekday, completion_kind
    )
    values
        (
            p_user_id, music_id, 'music_guitar', 'Akustisk Gitarr',
            'Öva akustisk gitarr — lägg till låtar och övningar i listan.',
            '🎸', '#e879f9', 0, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_bas', 'Bas',
            'Dra in hur många basövningar du vill — minst 2 per vecka. Lägg till låtar och övningar i listan.',
            '🎸', '#e879f9', 1, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_inspelning', 'Inspelning',
            'Inspelningssession — anteckna vad du ska spela in.',
            '🎙️', '#e879f9', 3, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_rep', 'Rep',
            'Dra in hur många reps du vill — minst 2 per vecka. Välj band och anteckna vad ni gick igenom.',
            '🤘', '#e879f9', 4, null, 'music'
        )
    on conflict (user_id, key) do nothing;
end;
$$;

create or replace function public.seed_default_sport_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.sport_session_templates (
        user_id, key, label, description, icon, accent, sort_order, default_weekday
    )
    values
        (
            p_user_id, 'sport', 'Sportpass',
            'Dra in hur många sportpass du vill — minst 2 per vecka. Välj sport och logga efteråt.',
            '🏸', '#a78bfa', 0, 3
        )
    on conflict (user_id, key) do nothing;
end;
$$;
