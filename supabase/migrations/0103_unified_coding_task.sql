-- Unify Kodning, Lära and Friend code into one repeatable Kodning task.
-- Session type (kodning, lära, friend kod) is chosen when planning a placement.
-- Run AFTER 0102. Safe to run multiple times.

alter table public.weekly_task_placements
    add column if not exists coding_activity text;

alter table public.weekly_task_placements
    drop constraint if exists weekly_task_placements_coding_activity_check;

alter table public.weekly_task_placements
    add constraint weekly_task_placements_coding_activity_check
    check (
        coding_activity is null
        or coding_activity in ('code', 'learn', 'friend')
    );

-- Legacy tasks are entirely one kind. Existing Kodning rows that already
-- have a plan or a result stay "bara kodning". Empty new placements stay
-- unset so re-running this file does not fill in a choice the user skipped.
update public.weekly_task_placements p
set coding_activity = case
    when t.key = 'dev_learn' then 'learn'
    when t.key = 'dev_friend' then 'friend'
    when t.key like 'dev_code_%' then 'code'
    else 'code'
end
from public.weekly_tasks t
where t.id = p.task_id
  and p.coding_activity is null
  and (
      t.key = 'dev_learn'
      or t.key = 'dev_friend'
      or t.key like 'dev_code_%'
      or (
          t.key = 'dev_code'
          and (
              p.done_at is not null
              or p.plan_note is not null
              or p.note is not null
              or p.coding_project_id is not null
          )
      )
  );

create or replace function public.seed_default_weekly_home_dev(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    home_id uuid;
    dev_id uuid;
    canonical_id uuid;
    leftover record;
    coding_notes text :=
        'Dra in hur många kodpass du vill — minst 2 per vecka. Välj kodning, lära eller friend kod när du planerar.';
begin
    perform public.seed_default_weekly_categories(p_user_id);

    select id into home_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'HOME';

    select id into dev_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'DEV';

    insert into public.weekly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        default_weekday, completion_kind
    )
    values
        (
            p_user_id, home_id, 'home_stadning', 'Städning',
            'Plocka upp saker, damma, dammsuga och blöttorka.',
            '🧹', '#6ee7a3', 0, null, 'note'
        ),
        (
            p_user_id, home_id, 'home_handla', 'Handla',
            'Dra in hur många handlingar du vill — minst 2 per vecka. Ange butik och summa när du är klar.',
            '🛒', '#6ee7a3', 1, null, 'shop'
        ),
        (
            p_user_id, home_id, 'home_projekt', 'Hemmaprojekt',
            'Dra in hur många hemmaprojekt du vill. Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.',
            '🔨', '#6ee7a3', 3, null, 'journal'
        ),
        (
            p_user_id, home_id, 'home_tvatta', 'Tvätta',
            'Skriv in bokad tid — ange antal tvättar när du är klar.',
            '👕', '#6ee7a3', 4, null, 'laundry'
        ),
        (
            p_user_id, dev_id, 'dev_code', 'Kodning',
            coding_notes,
            '💻', '#5fb6ff', 0, null, 'journal'
        )
    on conflict (user_id, key) do nothing;

    update public.weekly_tasks
    set
        is_repeatable = true,
        notes = case
            when notes is null
              or notes = 'Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.'
            then 'Dra in hur många hemmaprojekt du vill. Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.'
            else notes
        end
    where user_id = p_user_id
      and key = 'home_projekt'
      and archived_at is null;

    select id into canonical_id
    from public.weekly_tasks
    where user_id = p_user_id
      and key = 'dev_code'
      and archived_at is null
    limit 1;

    if canonical_id is null then
        select id into canonical_id
        from public.weekly_tasks
        where user_id = p_user_id
          and key = 'dev_code'
        order by created_at
        limit 1;

        if canonical_id is not null then
            update public.weekly_tasks
            set archived_at = null
            where id = canonical_id
              and user_id = p_user_id;
        end if;
    end if;

    if canonical_id is null then
        return;
    end if;

    update public.weekly_tasks
    set
        title = 'Kodning',
        notes = coding_notes,
        icon = '💻',
        accent = '#5fb6ff',
        completion_kind = 'journal',
        default_weekday = null,
        is_repeatable = true,
        weekly_goal = greatest(1, least(14, coalesce(weekly_goal, 2))),
        archived_at = null,
        category_id = coalesce(category_id, dev_id)
    where id = canonical_id
      and user_id = p_user_id;

    for leftover in
        select id, key
        from public.weekly_tasks
        where user_id = p_user_id
          and archived_at is null
          and id <> canonical_id
          and (
              key = 'dev_code'
              or key like 'dev_code_%'
              or key = 'dev_learn'
              or key = 'dev_friend'
          )
    loop
        update public.weekly_task_placements
        set
            task_id = canonical_id,
            coding_activity = coalesce(
                coding_activity,
                case
                    when leftover.key = 'dev_learn' then 'learn'
                    when leftover.key = 'dev_friend' then 'friend'
                    else 'code'
                end
            )
        where user_id = p_user_id
          and task_id = leftover.id;

        update public.weekly_tasks
        set archived_at = now()
        where id = leftover.id
          and user_id = p_user_id;
    end loop;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_weekly_home_dev(u.id);
    end loop;
end;
$$;
