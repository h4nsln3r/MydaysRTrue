-- Consolidate Rep 1 / Rep 2 into one repeatable weekly task (music_rep).
-- Run AFTER 0073_coding_project_version_note.sql. Safe to run multiple times.

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
          and key = 'music_rep'
          and archived_at is null
        limit 1;

        if canonical_id is null then
            select id into canonical_id
            from public.weekly_tasks
            where user_id = u.id
              and key like 'music_rep_%'
              and archived_at is null
            order by sort_order, created_at
            limit 1;

            if canonical_id is not null then
                update public.weekly_tasks
                set
                    key = 'music_rep',
                    title = 'Rep',
                    notes = 'Dra in hur många reps du vill — minst 2 per vecka. Välj band och anteckna vad ni gick igenom.',
                    icon = '🤘',
                    accent = '#e879f9',
                    completion_kind = 'music',
                    default_weekday = null,
                    sort_order = 4
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
                        'music_rep',
                        'Rep',
                        'Dra in hur många reps du vill — minst 2 per vecka. Välj band och anteckna vad ni gick igenom.',
                        '🤘',
                        '#e879f9',
                        4,
                        null,
                        'music'
                    )
                    returning id into canonical_id;
                end if;
            end if;
        else
            update public.weekly_tasks
            set
                title = 'Rep',
                notes = 'Dra in hur många reps du vill — minst 2 per vecka. Välj band och anteckna vad ni gick igenom.',
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
                  key like 'music_rep_%'
                  or key = 'music_rep'
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
            p_user_id, music_id, 'music_bas_1', 'Bas 1',
            'Basövning — lägg till låtar och övningar i listan.',
            '🎸', '#e879f9', 1, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_bas_ack_piano', 'Bas/Ack/Piano',
            'Bas, ackord eller piano — lägg till i listan.',
            '🎹', '#e879f9', 2, null, 'music'
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
