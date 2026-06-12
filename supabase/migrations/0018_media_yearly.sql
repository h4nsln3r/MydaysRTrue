-- Media library per calendar year (book / series / movie) + daily position logs.
-- Run AFTER 0017_daily_reading_mobile_games.sql. Safe to run multiple times.

-- Drop first: 0017 only allows kind = 'reading', not 'media'.
alter table public.habits drop constraint if exists habits_kind_check;

update public.habits
set key = 'media', label = 'Läsa & titta', kind = 'media', icon = '📺'
where key = 'reading' or kind = 'reading';

-- Remove stray reading row if media already exists for the same user.
delete from public.habits r
where (r.key = 'reading' or r.kind = 'reading')
  and exists (
    select 1 from public.habits m
    where m.user_id = r.user_id and m.key = 'media' and m.id <> r.id
  );

alter table public.habits add constraint habits_kind_check
    check (kind in (
        'tri_state', 'water', 'meal', 'snack', 'intake',
        'steps', 'activity_hours', 'media', 'mobile_games'
    ));

create table if not exists public.media_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    year integer not null check (year between 1970 and 2100),
    kind text not null check (kind in ('book', 'series', 'movie')),
    title text not null check (length(trim(title)) > 0),
    total_length integer check (total_length is null or total_length > 0),
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Upgrade legacy monthly schema if 0018_media_monthly was applied earlier.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_items'
          and column_name = 'month_start'
    ) then
        alter table public.media_items add column if not exists year integer;

        update public.media_items
        set year = extract(year from month_start::timestamp)::integer
        where year is null
          and month_start is not null;

        update public.media_items
        set year = extract(year from created_at)::integer
        where year is null;

        alter table public.media_items alter column year set not null;

        alter table public.media_items drop column month_start;
    end if;
end;
$$;

drop index if exists public.media_items_user_month_idx;

create index if not exists media_items_user_year_idx
    on public.media_items (user_id, year);

alter table public.media_items
    drop constraint if exists media_items_year_check;

alter table public.media_items
    add constraint media_items_year_check
    check (year between 1970 and 2100);

alter table public.media_items enable row level security;

drop policy if exists "media_items select own" on public.media_items;
create policy "media_items select own"
on public.media_items for select using (auth.uid() = user_id);

drop policy if exists "media_items insert own" on public.media_items;
create policy "media_items insert own"
on public.media_items for insert with check (auth.uid() = user_id);

drop policy if exists "media_items update own" on public.media_items;
create policy "media_items update own"
on public.media_items for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_items delete own" on public.media_items;
create policy "media_items delete own"
on public.media_items for delete using (auth.uid() = user_id);

drop trigger if exists media_items_set_updated_at on public.media_items;
create trigger media_items_set_updated_at
before update on public.media_items
for each row execute function public.set_updated_at();

create table if not exists public.media_daily_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    media_item_id uuid not null references public.media_items(id) on delete cascade,
    local_date date not null,
    position integer not null default 0 check (position >= 0),
    did_consume boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, local_date)
);

create index if not exists media_daily_logs_item_idx
    on public.media_daily_logs (user_id, media_item_id);

alter table public.media_daily_logs enable row level security;

drop policy if exists "media_daily_logs select own" on public.media_daily_logs;
create policy "media_daily_logs select own"
on public.media_daily_logs for select using (auth.uid() = user_id);

drop policy if exists "media_daily_logs insert own" on public.media_daily_logs;
create policy "media_daily_logs insert own"
on public.media_daily_logs for insert with check (auth.uid() = user_id);

drop policy if exists "media_daily_logs update own" on public.media_daily_logs;
create policy "media_daily_logs update own"
on public.media_daily_logs for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_daily_logs delete own" on public.media_daily_logs;
create policy "media_daily_logs delete own"
on public.media_daily_logs for delete using (auth.uid() = user_id);

drop trigger if exists media_daily_logs_set_updated_at on public.media_daily_logs;
create trigger media_daily_logs_set_updated_at
before update on public.media_daily_logs
for each row execute function public.set_updated_at();

-- Migrate legacy reading tables if present
do $$
begin
    if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'reading_books'
    ) then
        insert into public.media_items (user_id, year, kind, title, total_length, sort_order)
        select
            rb.user_id,
            extract(year from rb.created_at)::integer,
            'book',
            rb.title,
            rb.total_pages,
            0
        from public.reading_books rb
        where rb.archived_at is null
        on conflict do nothing;

        insert into public.media_daily_logs (user_id, media_item_id, local_date, position, did_consume)
        select
            rl.user_id,
            mi.id,
            rl.local_date,
            rl.pages_read,
            rl.did_read
        from public.reading_daily_logs rl
        join public.reading_books rb on rb.id = rl.book_id
        join public.media_items mi
            on mi.user_id = rl.user_id
            and mi.title = rb.title
            and mi.year = extract(year from rb.created_at)::integer
        on conflict (user_id, local_date) do nothing;

        drop table if exists public.reading_daily_logs;
        drop table if exists public.reading_books;
    end if;
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
        (p_user_id, 'smoke_free',      'Rökfri',          'tri_state',       '🚭', '#6ee7a3', 4),
        (p_user_id, 'sugar_free',      'Sockerfri',       'tri_state',       '🍭', '#ffcf3a', 5),
        (p_user_id, 'activity_hours',  'Aktivitet',       'activity_hours',  '⏱', '#c084fc', 6),
        (p_user_id, 'steps',           'Steg',            'steps',           '👟', '#5fb6ff', 7),
        (p_user_id, 'media',           'Läsa & titta',    'media',           '📺', '#a78bfa', 8),
        (p_user_id, 'mobile_games',    'Mobilspel',       'mobile_games',    '📱', '#f472b6', 9)
    on conflict (user_id, key) do nothing;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_habits(u.id);
    end loop;
end;
$$;
