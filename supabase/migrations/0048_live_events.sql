-- Live events (concerts, sport, races, birthdays, etc.) per calendar year.
-- Run AFTER 0047_media_item_rating.sql. Safe to run multiple times.

alter table public.habits drop constraint if exists habits_kind_check;
alter table public.habits add constraint habits_kind_check
    check (kind in (
        'tri_state', 'water', 'meal', 'snack', 'intake',
        'steps', 'activity_hours', 'media', 'mobile_games', 'mood', 'live'
    ));

create table if not exists public.live_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    year integer not null check (year between 1970 and 2100),
    kind text not null check (kind in ('concert', 'sport', 'race', 'birthday', 'wedding', 'other')),
    title text not null check (length(trim(title)) > 0),
    event_date date not null,
    location text,
    note text,
    rating integer check (rating is null or (rating >= 1 and rating <= 10)),
    attended_at timestamptz,
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists live_events_user_year_idx
    on public.live_events (user_id, year);

create index if not exists live_events_user_date_idx
    on public.live_events (user_id, event_date);

alter table public.live_events enable row level security;

drop policy if exists "live_events select own" on public.live_events;
create policy "live_events select own"
on public.live_events for select using (auth.uid() = user_id);

drop policy if exists "live_events insert own" on public.live_events;
create policy "live_events insert own"
on public.live_events for insert with check (auth.uid() = user_id);

drop policy if exists "live_events update own" on public.live_events;
create policy "live_events update own"
on public.live_events for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "live_events delete own" on public.live_events;
create policy "live_events delete own"
on public.live_events for delete using (auth.uid() = user_id);

drop trigger if exists live_events_set_updated_at on public.live_events;
create trigger live_events_set_updated_at
before update on public.live_events
for each row execute function public.set_updated_at();

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
        (p_user_id, 'lite_stad',       'Lite städ',       'tri_state',       '🧹', '#6ee7a3', 6),
        (p_user_id, 'activity_hours',  'Aktivitet',       'activity_hours',  '⏱', '#c084fc', 7),
        (p_user_id, 'steps',           'Steg',            'steps',           '👟', '#5fb6ff', 8),
        (p_user_id, 'media',           'Läsa & titta',    'media',           '📺', '#a78bfa', 9),
        (p_user_id, 'live_events',     'Live',            'live',            '🎫', '#f472b6', 10),
        (p_user_id, 'mobile_games',    'Mobilspel',       'mobile_games',    '📱', '#f472b6', 11),
        (p_user_id, 'mood',            'Dagskänsla',      'mood',            '🙂', '#fbbf24', 12)
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
