-- Rökfri: nicotine + cannabis sub-trackers (tri-state each)
-- Run AFTER 0057_media_daily_logs_multi.sql. Safe to run multiple times.

alter table public.habits drop constraint if exists habits_kind_check;
alter table public.habits add constraint habits_kind_check
    check (kind in (
        'tri_state', 'water', 'meal', 'snack', 'intake',
        'steps', 'activity_hours', 'media', 'mobile_games', 'mood', 'live',
        'smoke_free'
    ));

create table if not exists public.smoke_free_daily_logs (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    nicotine_status text check (nicotine_status is null or nicotine_status in ('yes', 'half', 'no')),
    cannabis_status text check (cannabis_status is null or cannabis_status in ('yes', 'half', 'no')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, local_date)
);

alter table public.smoke_free_daily_logs enable row level security;

drop policy if exists "smoke_free_daily_logs select own" on public.smoke_free_daily_logs;
create policy "smoke_free_daily_logs select own"
on public.smoke_free_daily_logs for select using (auth.uid() = user_id);

drop policy if exists "smoke_free_daily_logs insert own" on public.smoke_free_daily_logs;
create policy "smoke_free_daily_logs insert own"
on public.smoke_free_daily_logs for insert with check (auth.uid() = user_id);

drop policy if exists "smoke_free_daily_logs update own" on public.smoke_free_daily_logs;
create policy "smoke_free_daily_logs update own"
on public.smoke_free_daily_logs for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "smoke_free_daily_logs delete own" on public.smoke_free_daily_logs;
create policy "smoke_free_daily_logs delete own"
on public.smoke_free_daily_logs for delete using (auth.uid() = user_id);

drop trigger if exists smoke_free_daily_logs_set_updated_at on public.smoke_free_daily_logs;
create trigger smoke_free_daily_logs_set_updated_at
before update on public.smoke_free_daily_logs
for each row execute function public.set_updated_at();

-- Migrate existing smoke_free habit_checks → nicotine_status
insert into public.smoke_free_daily_logs (user_id, local_date, nicotine_status)
select hc.user_id, hc.local_date, hc.status
from public.habit_checks hc
join public.habits h on h.id = hc.habit_id
where h.key = 'smoke_free'
on conflict (user_id, local_date) do update
    set nicotine_status = excluded.nicotine_status;

update public.habits
set kind = 'smoke_free'
where key = 'smoke_free' and kind = 'tri_state';

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
        (p_user_id, 'smoke_free',      'Rökfri',          'smoke_free',      '🚭', '#6ee7a3', 4),
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
