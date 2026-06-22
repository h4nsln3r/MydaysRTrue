-- MyDays — weekly sport sessions (2× per week, flexible activity)
-- Run AFTER 0029_weekly_one_off.sql. Safe to run multiple times.
--
-- Plan which sport to play (frisbee golf, badminton, …), then log what it
-- actually was, how it went, and who joined.

create table if not exists public.sport_session_templates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,
    label text not null check (length(trim(label)) > 0),
    description text,
    icon text not null default '⚽',
    accent text not null default '#a78bfa',
    sort_order integer not null default 0,
    default_weekday integer not null check (default_weekday between 1 and 7),
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, key)
);

create index if not exists sport_templates_user_active_idx
    on public.sport_session_templates (user_id, sort_order)
    where archived_at is null;

alter table public.sport_session_templates enable row level security;

drop policy if exists "sport_templates select own" on public.sport_session_templates;
create policy "sport_templates select own"
on public.sport_session_templates for select
using (auth.uid() = user_id);

drop policy if exists "sport_templates insert own" on public.sport_session_templates;
create policy "sport_templates insert own"
on public.sport_session_templates for insert
with check (auth.uid() = user_id);

drop policy if exists "sport_templates update own" on public.sport_session_templates;
create policy "sport_templates update own"
on public.sport_session_templates for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sport_templates delete own" on public.sport_session_templates;
create policy "sport_templates delete own"
on public.sport_session_templates for delete
using (auth.uid() = user_id);

drop trigger if exists sport_templates_set_updated_at on public.sport_session_templates;
create trigger sport_templates_set_updated_at
before update on public.sport_session_templates
for each row execute function public.set_updated_at();

create table if not exists public.sport_week_placements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    template_id uuid not null references public.sport_session_templates(id) on delete cascade,
    week_start date not null,
    weekday integer check (weekday is null or weekday between 1 and 7),
    day_sort_order integer not null default 0,
    plan_sport text,
    actual_sport text,
    note text,
    companions text,
    done_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, template_id, week_start)
);

create index if not exists sport_placements_user_week_idx
    on public.sport_week_placements (user_id, week_start);

alter table public.sport_week_placements enable row level security;

drop policy if exists "sport_placements select own" on public.sport_week_placements;
create policy "sport_placements select own"
on public.sport_week_placements for select
using (auth.uid() = user_id);

drop policy if exists "sport_placements insert own" on public.sport_week_placements;
create policy "sport_placements insert own"
on public.sport_week_placements for insert
with check (auth.uid() = user_id);

drop policy if exists "sport_placements update own" on public.sport_week_placements;
create policy "sport_placements update own"
on public.sport_week_placements for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sport_placements delete own" on public.sport_week_placements;
create policy "sport_placements delete own"
on public.sport_week_placements for delete
using (auth.uid() = user_id);

drop trigger if exists sport_placements_set_updated_at on public.sport_week_placements;
create trigger sport_placements_set_updated_at
before update on public.sport_week_placements
for each row execute function public.set_updated_at();

create or replace function public.seed_default_sport_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.sport_session_templates (
        user_id, key, label, description, icon, accent, sort_order, default_weekday
    )
    values
        (
            p_user_id, 'sport_1', 'Sportpass 1',
            'Välj vilken sport du ska köra — logga efteråt vad det blev.',
            '🏸', '#a78bfa', 0, 3
        ),
        (
            p_user_id, 'sport_2', 'Sportpass 2',
            'Andra sportpasset den här veckan.',
            '⛳', '#a78bfa', 1, 6
        )
    on conflict (user_id, key) do nothing;
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
    perform public.seed_default_sport_templates(new.id);

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_sport_templates(u.id);
    end loop;
end;
$$;
