-- User sport catalog for Sportpass (like user_games).
-- Run AFTER 0088_user_games.sql. Safe to run multiple times.

create table if not exists public.user_sports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    key text,
    title text not null check (length(trim(title)) > 0),
    icon text not null default '🏸',
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists user_sports_user_key_uniq
    on public.user_sports (user_id, key)
    where key is not null;

create unique index if not exists user_sports_user_title_uniq
    on public.user_sports (user_id, lower(trim(title)))
    where archived_at is null;

create index if not exists user_sports_user_active_idx
    on public.user_sports (user_id, sort_order)
    where archived_at is null;

alter table public.user_sports enable row level security;

drop policy if exists "user_sports select own" on public.user_sports;
create policy "user_sports select own"
on public.user_sports for select
using (auth.uid() = user_id);

drop policy if exists "user_sports insert own" on public.user_sports;
create policy "user_sports insert own"
on public.user_sports for insert
with check (auth.uid() = user_id);

drop policy if exists "user_sports update own" on public.user_sports;
create policy "user_sports update own"
on public.user_sports for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_sports delete own" on public.user_sports;
create policy "user_sports delete own"
on public.user_sports for delete
using (auth.uid() = user_id);

drop trigger if exists user_sports_set_updated_at on public.user_sports;
create trigger user_sports_set_updated_at
before update on public.user_sports
for each row execute function public.set_updated_at();

alter table public.sport_week_placements
    add column if not exists sport_id uuid
        references public.user_sports(id) on delete set null;

create index if not exists sport_week_placements_sport_idx
    on public.sport_week_placements (sport_id)
    where sport_id is not null;

create or replace function public.seed_default_user_sports(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.user_sports (user_id, key, title, icon, sort_order)
    values
        (p_user_id, 'discgolf', 'Discgolf', '🥏', 0),
        (p_user_id, 'badminton', 'Badminton', '🏸', 1),
        (p_user_id, 'pingis', 'Pingis', '🏓', 2)
    on conflict (user_id, key) where key is not null do update
    set
        archived_at = null,
        title = excluded.title,
        icon = excluded.icon,
        sort_order = excluded.sort_order;
end;
$$;

create or replace function public.seed_default_sport_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.seed_default_user_sports(p_user_id);

    insert into public.sport_session_templates (
        user_id, key, label, description, icon, accent, sort_order, default_weekday
    )
    values (
        p_user_id,
        'sport',
        'Sportpass',
        'Dra in hur många sportpass du vill — minst 2 per vecka. Välj sport och logga efteråt.',
        '🏸',
        '#a78bfa',
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
        default_weekday = excluded.default_weekday;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_user_sports(u.id);
    end loop;
end;
$$;
