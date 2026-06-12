-- Daily reading tracker + mobile games (Chess, Duolingo, Pokemon GO)
-- Run AFTER 0016_bathing_repeatable.sql. Safe to run multiple times.

alter table public.habits drop constraint if exists habits_kind_check;
alter table public.habits add constraint habits_kind_check
    check (kind in (
        'tri_state', 'water', 'meal', 'snack', 'intake',
        'steps', 'activity_hours', 'reading', 'mobile_games'
    ));

create table if not exists public.reading_books (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (length(trim(title)) > 0),
    total_pages integer not null check (total_pages > 0),
    is_active boolean not null default true,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists reading_books_one_active_idx
    on public.reading_books (user_id)
    where is_active = true and archived_at is null;

create index if not exists reading_books_user_idx
    on public.reading_books (user_id, created_at desc);

alter table public.reading_books enable row level security;

drop policy if exists "reading_books select own" on public.reading_books;
create policy "reading_books select own"
on public.reading_books for select using (auth.uid() = user_id);

drop policy if exists "reading_books insert own" on public.reading_books;
create policy "reading_books insert own"
on public.reading_books for insert with check (auth.uid() = user_id);

drop policy if exists "reading_books update own" on public.reading_books;
create policy "reading_books update own"
on public.reading_books for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reading_books delete own" on public.reading_books;
create policy "reading_books delete own"
on public.reading_books for delete using (auth.uid() = user_id);

drop trigger if exists reading_books_set_updated_at on public.reading_books;
create trigger reading_books_set_updated_at
before update on public.reading_books
for each row execute function public.set_updated_at();

create table if not exists public.reading_daily_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    book_id uuid not null references public.reading_books(id) on delete cascade,
    local_date date not null,
    pages_read integer not null default 0 check (pages_read >= 0),
    did_read boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, local_date)
);

create index if not exists reading_daily_logs_book_idx
    on public.reading_daily_logs (user_id, book_id);

alter table public.reading_daily_logs enable row level security;

drop policy if exists "reading_daily_logs select own" on public.reading_daily_logs;
create policy "reading_daily_logs select own"
on public.reading_daily_logs for select using (auth.uid() = user_id);

drop policy if exists "reading_daily_logs insert own" on public.reading_daily_logs;
create policy "reading_daily_logs insert own"
on public.reading_daily_logs for insert with check (auth.uid() = user_id);

drop policy if exists "reading_daily_logs update own" on public.reading_daily_logs;
create policy "reading_daily_logs update own"
on public.reading_daily_logs for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reading_daily_logs delete own" on public.reading_daily_logs;
create policy "reading_daily_logs delete own"
on public.reading_daily_logs for delete using (auth.uid() = user_id);

drop trigger if exists reading_daily_logs_set_updated_at on public.reading_daily_logs;
create trigger reading_daily_logs_set_updated_at
before update on public.reading_daily_logs
for each row execute function public.set_updated_at();

create table if not exists public.mobile_game_daily_logs (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    chess_done boolean not null default false,
    duolingo_done boolean not null default false,
    pokemon_go_done boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, local_date)
);

alter table public.mobile_game_daily_logs enable row level security;

drop policy if exists "mobile_game_daily_logs select own" on public.mobile_game_daily_logs;
create policy "mobile_game_daily_logs select own"
on public.mobile_game_daily_logs for select using (auth.uid() = user_id);

drop policy if exists "mobile_game_daily_logs insert own" on public.mobile_game_daily_logs;
create policy "mobile_game_daily_logs insert own"
on public.mobile_game_daily_logs for insert with check (auth.uid() = user_id);

drop policy if exists "mobile_game_daily_logs update own" on public.mobile_game_daily_logs;
create policy "mobile_game_daily_logs update own"
on public.mobile_game_daily_logs for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "mobile_game_daily_logs delete own" on public.mobile_game_daily_logs;
create policy "mobile_game_daily_logs delete own"
on public.mobile_game_daily_logs for delete using (auth.uid() = user_id);

drop trigger if exists mobile_game_daily_logs_set_updated_at on public.mobile_game_daily_logs;
create trigger mobile_game_daily_logs_set_updated_at
before update on public.mobile_game_daily_logs
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
        (p_user_id, 'activity_hours',  'Aktivitet',       'activity_hours',  '⏱', '#c084fc', 6),
        (p_user_id, 'steps',           'Steg',            'steps',           '👟', '#5fb6ff', 7),
        (p_user_id, 'reading',         'Läsa',            'reading',         '📖', '#a78bfa', 8),
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
