-- Unify weekly call tasks into one repeatable "Ring" (pick who, like cardiopass).
-- Goal: mamma 2× per week; Sanna, farmor or a friend (Övrigt) 1× per week.

alter table public.weekly_task_placements
    add column if not exists call_person text;

alter table public.weekly_task_placements
    drop constraint if exists weekly_task_placements_call_person_check;

alter table public.weekly_task_placements
    add constraint weekly_task_placements_call_person_check
    check (
        call_person is null
        or call_person in ('mamma', 'sanna', 'farmor', 'ovrigt')
    );

alter table public.weekly_task_placements
    add column if not exists call_other_name text;

update public.weekly_task_placements p
set call_person = case
    when t.key = 'life_ring_mamma' or t.key like 'life_ring_mamma_%' then 'mamma'
    when t.key = 'life_ring_mormor_farmor' then 'farmor'
    when t.key = 'life_ring_van' then 'ovrigt'
    else p.call_person
end
from public.weekly_tasks t
where t.id = p.task_id
  and p.call_person is null
  and (
      t.key = 'life_ring_mamma'
      or t.key like 'life_ring_mamma_%'
      or t.key = 'life_ring_mormor_farmor'
      or t.key = 'life_ring_van'
  );

create or replace function public.seed_default_weekly_life(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    life_id uuid;
    canonical_id uuid;
    leftover record;
    ring_notes text :=
        'Dra in hur många samtal du vill — mamma 2× och Sanna, farmor eller en vän 1× per vecka. Välj vem du ringer.';
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'Livet', '❤️', '#f472b6', 4)
    on conflict (user_id, scope, name) do nothing;

    select id into life_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'Livet';

    select id into canonical_id
    from public.weekly_tasks
    where user_id = p_user_id
      and key = 'life_ring'
      and archived_at is null
    limit 1;

    if canonical_id is null then
        select id into canonical_id
        from public.weekly_tasks
        where user_id = p_user_id
          and key = 'life_ring'
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
        select id into canonical_id
        from public.weekly_tasks
        where user_id = p_user_id
          and archived_at is null
          and (
              key = 'life_ring_mamma'
              or key like 'life_ring_mamma_%'
              or key = 'life_ring_mormor_farmor'
              or key = 'life_ring_van'
              or key = 'life_ring'
          )
        order by
            case
                when key = 'life_ring' then 0
                when key = 'life_ring_mamma' then 1
                when key like 'life_ring_mamma_%' then 2
                else 3
            end,
            sort_order,
            created_at
        limit 1;

        if canonical_id is not null then
            update public.weekly_tasks
            set
                key = 'life_ring',
                title = 'Ring',
                notes = ring_notes,
                icon = '📞',
                accent = '#f472b6',
                completion_kind = 'journal',
                default_weekday = null,
                is_repeatable = true,
                weekly_goal = 3,
                archived_at = null,
                category_id = coalesce(category_id, life_id)
            where id = canonical_id
              and user_id = p_user_id;
        else
            insert into public.weekly_tasks (
                user_id, category_id, key, title, notes, icon, accent, sort_order,
                default_weekday, completion_kind, is_repeatable, weekly_goal
            )
            values (
                p_user_id, life_id, 'life_ring', 'Ring',
                ring_notes,
                '📞', '#f472b6', 0, null, 'journal', true, 3
            )
            returning id into canonical_id;
        end if;
    else
        update public.weekly_tasks
        set
            title = 'Ring',
            notes = ring_notes,
            icon = '📞',
            accent = '#f472b6',
            default_weekday = null,
            is_repeatable = true,
            weekly_goal = 3,
            category_id = coalesce(category_id, life_id)
        where id = canonical_id
          and user_id = p_user_id;
    end if;

    if canonical_id is null then
        return;
    end if;

    for leftover in
        select id, key
        from public.weekly_tasks
        where user_id = p_user_id
          and archived_at is null
          and id <> canonical_id
          and (
              key = 'life_ring'
              or key = 'life_ring_mamma'
              or key like 'life_ring_mamma_%'
              or key = 'life_ring_mormor_farmor'
              or key = 'life_ring_van'
          )
    loop
        update public.weekly_task_placements
        set
            task_id = canonical_id,
            call_person = coalesce(
                call_person,
                case
                    when leftover.key = 'life_ring_mamma'
                      or leftover.key like 'life_ring_mamma_%' then 'mamma'
                    when leftover.key = 'life_ring_mormor_farmor' then 'farmor'
                    when leftover.key = 'life_ring_van' then 'ovrigt'
                    else null
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
        perform public.seed_default_weekly_life(u.id);
    end loop;
end;
$$;
