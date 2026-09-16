-- Consolidate Löpning / Cykling / Simning into one repeatable Cardio source
-- (like Sportpass). Multiple placements per week; pick kind when logging.
-- Run AFTER 0091_fest_occasion.sql. Safe to run multiple times.

alter table public.cardio_week_placements
    add column if not exists plan_kind text
        check (plan_kind is null or plan_kind in ('running', 'cycling', 'swimming'));

alter table public.cardio_week_placements
    add column if not exists actual_kind text
        check (actual_kind is null or actual_kind in ('running', 'cycling', 'swimming'));

do $$
declare
  r record;
begin
  if to_regclass('public.cardio_week_placements') is null then
    raise exception
      'public.cardio_week_placements finns inte i den här databasen.';
  end if;

  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.cardio_week_placements'::regclass
      and c.contype = 'u'
  loop
    execute format(
      'alter table public.cardio_week_placements drop constraint if exists %I',
      r.conname
    );
  end loop;

  for r in
    select i.indexname
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'cardio_week_placements'
      and i.indexdef ilike '%UNIQUE%'
      and i.indexname not like '%_pkey'
  loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end;
$$;

create or replace function public.seed_default_cardio_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    canonical_id uuid;
    leftover record;
begin
    insert into public.cardio_session_templates (
        user_id, key, label, description, icon, accent, sort_order, default_weekday
    )
    values (
        p_user_id,
        'cardio',
        'Cardiopass',
        'Dra in hur många cardiopass du vill — minst 3 per vecka. Gärna en löpning, en cykel och en simning.',
        '🏃',
        '#5fb6ff',
        0,
        3
    )
    on conflict (user_id, key) do update
    set
        archived_at = null,
        label = excluded.label,
        description = excluded.description,
        icon = excluded.icon,
        accent = excluded.accent,
        sort_order = excluded.sort_order,
        default_weekday = excluded.default_weekday
    returning id into canonical_id;

    if canonical_id is null then
        select id into canonical_id
        from public.cardio_session_templates
        where user_id = p_user_id and key = 'cardio'
        limit 1;
    end if;

    if canonical_id is null then
        select id into canonical_id
        from public.cardio_session_templates
        where user_id = p_user_id
          and key in ('running', 'cycling', 'swimming')
          and archived_at is null
        order by sort_order, created_at
        limit 1;

        if canonical_id is not null then
            update public.cardio_session_templates
            set
                key = 'cardio',
                label = 'Cardiopass',
                description = 'Dra in hur många cardiopass du vill — minst 3 per vecka. Gärna en löpning, en cykel och en simning.',
                icon = '🏃',
                accent = '#5fb6ff',
                sort_order = 0,
                default_weekday = 3,
                archived_at = null
            where id = canonical_id;
        end if;
    end if;

    if canonical_id is null then
        return;
    end if;

    for leftover in
        select id, key
        from public.cardio_session_templates
        where user_id = p_user_id
          and key in ('running', 'cycling', 'swimming')
          and id <> canonical_id
          and archived_at is null
    loop
        update public.cardio_week_placements
        set
            template_id = canonical_id,
            plan_kind = coalesce(plan_kind, leftover.key),
            actual_kind = case
                when done_at is not null then coalesce(actual_kind, leftover.key)
                else actual_kind
            end
        where user_id = p_user_id
          and template_id = leftover.id;

        update public.cardio_session_templates
        set archived_at = now()
        where id = leftover.id;
    end loop;

    delete from public.cardio_week_placements
    where user_id = p_user_id
      and weekday is null;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_cardio_templates(u.id);
    end loop;
end;
$$;
