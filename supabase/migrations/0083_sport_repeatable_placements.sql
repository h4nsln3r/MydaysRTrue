-- Allow multiple Sportpass placements of the same template in one week.
-- 0075 already drops this unique constraint; re-run here so DBs that skipped
-- 0075 (or restored from 0030) still get repeatable sport.
--
-- Raises if sport_week_placements is missing (wrong Supabase project).
-- Drops every UNIQUE constraint/index on that table except the primary key.
-- Run AFTER 0082_weekly_games.sql. Safe to run multiple times.

do $$
declare
  r record;
  dropped int := 0;
begin
  if to_regclass('public.sport_week_placements') is null then
    raise exception
      'public.sport_week_placements finns inte i den här databasen. Öppna SQL editorn för samma Supabase-projekt som appen använder.';
  end if;

  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.sport_week_placements'::regclass
      and c.contype = 'u'
  loop
    execute format(
      'alter table public.sport_week_placements drop constraint if exists %I',
      r.conname
    );
    dropped := dropped + 1;
    raise notice 'Dropped unique constraint %', r.conname;
  end loop;

  for r in
    select i.indexname
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'sport_week_placements'
      and i.indexdef ilike '%UNIQUE%'
      and i.indexname not like '%_pkey'
  loop
    execute format('drop index if exists public.%I', r.indexname);
    dropped := dropped + 1;
    raise notice 'Dropped unique index %', r.indexname;
  end loop;

  if dropped = 0 then
    raise notice 'No unique constraint left on sport_week_placements.';
  end if;
end;
$$;

select conname, contype
from pg_constraint
where conrelid = 'public.sport_week_placements'::regclass;
