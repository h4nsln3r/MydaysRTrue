-- Season number on series so each season is a separate progress unit.
-- Run AFTER 0083_sport_repeatable_placements.sql. Safe to run multiple times.

alter table public.media_items
    add column if not exists season integer;

alter table public.media_items
    drop constraint if exists media_items_season_range;

alter table public.media_items
    add constraint media_items_season_range
    check (season is null or (season >= 1 and season <= 100));

alter table public.media_items
    drop constraint if exists media_items_season_kind;

alter table public.media_items
    add constraint media_items_season_kind
    check (season is null or kind = 'series');

-- Pull trailing " S1" / " S2" out of existing series titles into season.
update public.media_items
set
    season = substring(title from '\sS(\d+)$')::integer,
    title = trim(regexp_replace(title, '\sS\d+$', ''))
where kind = 'series'
  and season is null
  and title ~ '\sS\d+$'
  and length(trim(regexp_replace(title, '\sS\d+$', ''))) > 0;
