-- One repeatable MUSIC weekly task. Session type (rep, bas, gitarr, …) is
-- chosen when planning a placement. Run AFTER 0078. Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- Placement fields
-- ---------------------------------------------------------------------------
do $$
declare
    conname text;
begin
    select c.conname into conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
    where c.conrelid = 'public.weekly_task_placements'::regclass
      and c.contype = 'c'
      and a.attname = 'band'
      and array_length(c.conkey, 1) = 1
    limit 1;

    if conname is not null then
        execute format(
            'alter table public.weekly_task_placements drop constraint %I',
            conname
        );
    end if;
end $$;

alter table public.weekly_task_placements
    add column if not exists music_activity text,
    add column if not exists plan_todo text;

alter table public.weekly_task_placements
    drop constraint if exists weekly_task_placements_music_activity_check;

alter table public.weekly_task_placements
    add constraint weekly_task_placements_music_activity_check
    check (
        music_activity is null
        or music_activity in (
            'rep',
            'bas',
            'gitarr',
            'piano',
            'ovning',
            'inspelning',
            'live',
            'spelning'
        )
    );

alter table public.weekly_task_placements
    drop constraint if exists weekly_task_placements_band_len_check;

alter table public.weekly_task_placements
    add constraint weekly_task_placements_band_len_check
    check (band is null or char_length(trim(band)) between 1 and 80);

alter table public.weekly_task_placements
    drop constraint if exists weekly_task_placements_plan_todo_len_check;

alter table public.weekly_task_placements
    add constraint weekly_task_placements_plan_todo_len_check
    check (plan_todo is null or char_length(trim(plan_todo)) between 1 and 200);

-- Infer activity from the task that currently owns the placement.
update public.weekly_task_placements p
set music_activity = case
    when t.key = 'music_bas' or t.key like 'music_bas_%' then 'bas'
    when t.key = 'music_guitar' then 'gitarr'
    when t.key = 'music_inspelning' then 'inspelning'
    when t.key = 'music_rep' or t.key like 'music_rep_%' then 'rep'
    when t.key = 'music_live' and p.music_log_kind = 'gig' then 'spelning'
    when t.key = 'music_live' then 'live'
    when p.music_log_kind = 'gig' then 'spelning'
    when p.music_log_kind = 'live' then 'live'
    else p.music_activity
end
from public.weekly_tasks t
where p.task_id = t.id
  and p.music_activity is null
  and t.key is not null
  and (
      t.key = 'music'
      or t.key like 'music_%'
  );

-- ---------------------------------------------------------------------------
-- Consolidate every MUSIC weekly task into one repeatable `music` task.
-- ---------------------------------------------------------------------------
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
          and key = 'music'
        limit 1;

        if canonical_id is not null then
            update public.weekly_tasks
            set
                archived_at = null,
                title = 'Musik',
                notes = 'Dra in hur många musikpass du vill — minst 2 per vecka. Välj vad du ska göra när du planerar.',
                icon = '🎵',
                accent = '#e879f9',
                completion_kind = 'music',
                default_weekday = null,
                sort_order = 0,
                is_repeatable = true,
                weekly_goal = greatest(1, least(14, coalesce(weekly_goal, 2)))
            where id = canonical_id;
        else
            select id into canonical_id
            from public.weekly_tasks
            where user_id = u.id
              and archived_at is null
              and key like 'music_%'
            order by sort_order, created_at
            limit 1;

            if canonical_id is not null then
                update public.weekly_tasks
                set
                    key = 'music',
                    title = 'Musik',
                    notes = 'Dra in hur många musikpass du vill — minst 2 per vecka. Välj vad du ska göra när du planerar.',
                    icon = '🎵',
                    accent = '#e879f9',
                    completion_kind = 'music',
                    default_weekday = null,
                    sort_order = 0,
                    is_repeatable = true,
                    weekly_goal = greatest(1, least(14, coalesce(weekly_goal, 2)))
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
                        sort_order, default_weekday, completion_kind,
                        is_repeatable, weekly_goal
                    )
                    values (
                        u.id,
                        music_category_id,
                        'music',
                        'Musik',
                        'Dra in hur många musikpass du vill — minst 2 per vecka. Välj vad du ska göra när du planerar.',
                        '🎵',
                        '#e879f9',
                        0,
                        null,
                        'music',
                        true,
                        2
                    )
                    returning id into canonical_id;
                end if;
            end if;
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
                  key = 'music'
                  or key like 'music_%'
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
        default_weekday, completion_kind, is_repeatable, weekly_goal
    )
    values (
        p_user_id, music_id, 'music', 'Musik',
        'Dra in hur många musikpass du vill — minst 2 per vecka. Välj vad du ska göra när du planerar.',
        '🎵', '#e879f9', 0, null, 'music', true, 2
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
        weekly_goal = greatest(1, least(14, coalesce(public.weekly_tasks.weekly_goal, 2))),
        category_id = excluded.category_id,
        default_weekday = null,
        sort_order = 0;
end;
$$;
