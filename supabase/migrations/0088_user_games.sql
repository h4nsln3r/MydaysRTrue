-- User game catalog for the repeatable weekly SPEL task.
-- Run AFTER 0087_repeatable_home_projekt.sql. Safe to run multiple times.

create table if not exists public.user_games (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    key text,
    title text not null check (length(trim(title)) > 0),
    kind text not null default 'other'
        check (kind in ('rpg', 'board', 'pc', 'card', 'console', 'other')),
    icon text not null default '🎲',
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists user_games_user_key_uniq
    on public.user_games (user_id, key)
    where key is not null;

create unique index if not exists user_games_user_title_uniq
    on public.user_games (user_id, lower(trim(title)))
    where archived_at is null;

create index if not exists user_games_user_active_idx
    on public.user_games (user_id, sort_order)
    where archived_at is null;

alter table public.user_games enable row level security;

drop policy if exists "user_games select own" on public.user_games;
create policy "user_games select own"
on public.user_games for select
using (auth.uid() = user_id);

drop policy if exists "user_games insert own" on public.user_games;
create policy "user_games insert own"
on public.user_games for insert
with check (auth.uid() = user_id);

drop policy if exists "user_games update own" on public.user_games;
create policy "user_games update own"
on public.user_games for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_games delete own" on public.user_games;
create policy "user_games delete own"
on public.user_games for delete
using (auth.uid() = user_id);

drop trigger if exists user_games_set_updated_at on public.user_games;
create trigger user_games_set_updated_at
before update on public.user_games
for each row execute function public.set_updated_at();

alter table public.weekly_task_placements
    add column if not exists game_id uuid
        references public.user_games(id) on delete set null;

create index if not exists weekly_task_placements_game_idx
    on public.weekly_task_placements (game_id)
    where game_id is not null;

create or replace function public.seed_default_user_games(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.user_games (user_id, key, title, kind, icon, sort_order)
    values (p_user_id, 'dnd', 'D&D', 'rpg', '🐉', 0)
    on conflict (user_id, key) where key is not null do update
    set
        archived_at = null,
        title = excluded.title,
        kind = excluded.kind,
        icon = excluded.icon;
end;
$$;

create or replace function public.seed_default_weekly_games(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    spel_id uuid;
    canonical_id uuid;
    leftover record;
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'SPEL', '🎲', '#a78bfa', 5)
    on conflict (user_id, scope, name) do nothing;

    select id into spel_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'SPEL';

    perform public.seed_default_user_games(p_user_id);

    select id into canonical_id
    from public.weekly_tasks
    where user_id = p_user_id and key = 'game';

    if canonical_id is null then
        select id into canonical_id
        from public.weekly_tasks
        where user_id = p_user_id and key = 'game_dnd';

        if canonical_id is not null then
            update public.weekly_tasks
            set key = 'game'
            where id = canonical_id and user_id = p_user_id;
        end if;
    end if;

    if canonical_id is null then
        insert into public.weekly_tasks (
            user_id, category_id, key, title, notes, icon, accent, sort_order,
            default_weekday, completion_kind, is_repeatable, weekly_goal
        )
        values (
            p_user_id, spel_id, 'game', 'Spel',
            'Dra in hur många spelsessioner du vill — minst 1 per vecka. Välj spel och logga efteråt.',
            '🎲', '#a78bfa', 0, null, 'journal', true, 1
        )
        returning id into canonical_id;
    else
        update public.weekly_tasks
        set
            archived_at = null,
            title = 'Spel',
            notes = 'Dra in hur många spelsessioner du vill — minst 1 per vecka. Välj spel och logga efteråt.',
            icon = '🎲',
            accent = '#a78bfa',
            completion_kind = 'journal',
            is_repeatable = true,
            weekly_goal = greatest(1, least(14, coalesce(weekly_goal, 1))),
            category_id = spel_id,
            sort_order = 0
        where id = canonical_id and user_id = p_user_id;
    end if;

    for leftover in
        select id
        from public.weekly_tasks
        where user_id = p_user_id
          and key = 'game_dnd'
          and id <> canonical_id
    loop
        update public.weekly_task_placements
        set task_id = canonical_id
        where user_id = p_user_id and task_id = leftover.id;

        update public.weekly_tasks
        set archived_at = now()
        where id = leftover.id and user_id = p_user_id;
    end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;

    perform public.seed_default_habits(new.id);
    perform public.seed_default_gym_templates(new.id);
    perform public.seed_default_cardio_templates(new.id);
    perform public.seed_default_bathing_templates(new.id);
    perform public.seed_default_weekly_home_dev(new.id);
    perform public.seed_default_weekly_music(new.id);
    perform public.seed_default_weekly_life(new.id);
    perform public.seed_default_sport_templates(new.id);
    perform public.seed_default_monthly_bills(new.id);
    perform public.seed_default_monthly_savings(new.id);
    perform public.seed_default_monthly_finance(new.id);
    perform public.seed_default_utgifter(new.id);
    perform public.seed_default_weekly_games(new.id);

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_weekly_games(u.id);
    end loop;
end;
$$;
