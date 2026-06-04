-- MyDays — Gym (weekly session templates + placements)
-- Run AFTER 0006_intake.sql. Safe to run multiple times.
--
-- Design notes
--   * Five recurring session templates per user (upper/legs/core pattern).
--     Each has a default_weekday (Mon–Fri). When a week is opened the app
--     ensures one placement row per template — seeded from default_weekday.
--   * The user can move any pass to another weekday for that week only;
--     next week defaults apply again unless they move those too.
--   * Completing a pass stores warmup + done_at on the placement row.

-- =========================================================
-- gym_session_templates — the user's fixed 5-pass rotation
-- =========================================================
create table if not exists public.gym_session_templates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,
    label text not null check (length(trim(label)) > 0),
    description text,
    icon text not null default '🏋️',
    accent text not null default '#ff7a1a',
    sort_order integer not null default 0,
    default_weekday integer not null check (default_weekday between 1 and 7),
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, key)
);

create index if not exists gym_templates_user_active_idx
    on public.gym_session_templates (user_id, sort_order)
    where archived_at is null;

alter table public.gym_session_templates enable row level security;

drop policy if exists "gym_templates select own" on public.gym_session_templates;
create policy "gym_templates select own"
on public.gym_session_templates for select
using (auth.uid() = user_id);

drop policy if exists "gym_templates insert own" on public.gym_session_templates;
create policy "gym_templates insert own"
on public.gym_session_templates for insert
with check (auth.uid() = user_id);

drop policy if exists "gym_templates update own" on public.gym_session_templates;
create policy "gym_templates update own"
on public.gym_session_templates for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "gym_templates delete own" on public.gym_session_templates;
create policy "gym_templates delete own"
on public.gym_session_templates for delete
using (auth.uid() = user_id);

drop trigger if exists gym_templates_set_updated_at on public.gym_session_templates;
create trigger gym_templates_set_updated_at
before update on public.gym_session_templates
for each row execute function public.set_updated_at();

-- =========================================================
-- gym_week_placements — one row per (user, template, week)
-- week_start is always a Monday (ISO week).
-- =========================================================
create table if not exists public.gym_week_placements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    template_id uuid not null references public.gym_session_templates(id) on delete cascade,
    week_start date not null,
    weekday integer not null check (weekday between 1 and 7),
    warmup text check (
        warmup is null
        or warmup in ('skidor', 'rodd', 'cykel', 'crosstrainer', 'magmaskin')
    ),
    done_at timestamptz,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, template_id, week_start)
);

create index if not exists gym_placements_user_week_idx
    on public.gym_week_placements (user_id, week_start);

create index if not exists gym_placements_user_template_idx
    on public.gym_week_placements (user_id, template_id, week_start desc);

alter table public.gym_week_placements enable row level security;

drop policy if exists "gym_placements select own" on public.gym_week_placements;
create policy "gym_placements select own"
on public.gym_week_placements for select
using (auth.uid() = user_id);

drop policy if exists "gym_placements insert own" on public.gym_week_placements;
create policy "gym_placements insert own"
on public.gym_week_placements for insert
with check (auth.uid() = user_id);

drop policy if exists "gym_placements update own" on public.gym_week_placements;
create policy "gym_placements update own"
on public.gym_week_placements for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "gym_placements delete own" on public.gym_week_placements;
create policy "gym_placements delete own"
on public.gym_week_placements for delete
using (auth.uid() = user_id);

drop trigger if exists gym_placements_set_updated_at on public.gym_week_placements;
create trigger gym_placements_set_updated_at
before update on public.gym_week_placements
for each row execute function public.set_updated_at();

-- =========================================================
-- Default gym template seeding
-- =========================================================
create or replace function public.seed_default_gym_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.gym_session_templates (
        user_id, key, label, description, icon, accent, sort_order, default_weekday
    )
    values
        (p_user_id, 'upper_1',   'Överkropp',   'Överkroppspass',                    '💪', '#ff7a1a', 0, 1),
        (p_user_id, 'legs_1',    'Ben',         'Benpass',                           '🦵', '#6ee7a3', 1, 2),
        (p_user_id, 'core_back', 'Mage & rygg', 'Mage och rygg',                     '🧘', '#5fb6ff', 2, 3),
        (p_user_id, 'upper_2',   'Överkropp',   'Överkropp igen',                    '💪', '#ff9a3c', 3, 4),
        (p_user_id, 'legs_2',    'Ben',         'Ben igen',                          '🦵', '#6ee7a3', 4, 5)
    on conflict (user_id, key) do nothing;
end;
$$;

-- New users get gym templates on signup.
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

    return new;
end;
$$;

-- Backfill for existing users.
do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_gym_templates(u.id);
    end loop;
end;
$$;
