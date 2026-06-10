-- MyDays — Cardio (weekly running / cycling / swimming)
-- Run AFTER 0010_intake_habit_snack_description.sql. Safe to run multiple times.

create table if not exists public.cardio_session_templates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,
    label text not null check (length(trim(label)) > 0),
    description text,
    icon text not null default '🏃',
    accent text not null default '#5fb6ff',
    sort_order integer not null default 0,
    default_weekday integer not null check (default_weekday between 1 and 7),
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, key)
);

create index if not exists cardio_templates_user_active_idx
    on public.cardio_session_templates (user_id, sort_order)
    where archived_at is null;

alter table public.cardio_session_templates enable row level security;

drop policy if exists "cardio_templates select own" on public.cardio_session_templates;
create policy "cardio_templates select own"
on public.cardio_session_templates for select
using (auth.uid() = user_id);

drop policy if exists "cardio_templates insert own" on public.cardio_session_templates;
create policy "cardio_templates insert own"
on public.cardio_session_templates for insert
with check (auth.uid() = user_id);

drop policy if exists "cardio_templates update own" on public.cardio_session_templates;
create policy "cardio_templates update own"
on public.cardio_session_templates for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "cardio_templates delete own" on public.cardio_session_templates;
create policy "cardio_templates delete own"
on public.cardio_session_templates for delete
using (auth.uid() = user_id);

drop trigger if exists cardio_templates_set_updated_at on public.cardio_session_templates;
create trigger cardio_templates_set_updated_at
before update on public.cardio_session_templates
for each row execute function public.set_updated_at();

create table if not exists public.cardio_week_placements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    template_id uuid not null references public.cardio_session_templates(id) on delete cascade,
    week_start date not null,
    weekday integer not null check (weekday between 1 and 7),
    done_at timestamptz,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, template_id, week_start)
);

create index if not exists cardio_placements_user_week_idx
    on public.cardio_week_placements (user_id, week_start);

alter table public.cardio_week_placements enable row level security;

drop policy if exists "cardio_placements select own" on public.cardio_week_placements;
create policy "cardio_placements select own"
on public.cardio_week_placements for select
using (auth.uid() = user_id);

drop policy if exists "cardio_placements insert own" on public.cardio_week_placements;
create policy "cardio_placements insert own"
on public.cardio_week_placements for insert
with check (auth.uid() = user_id);

drop policy if exists "cardio_placements update own" on public.cardio_week_placements;
create policy "cardio_placements update own"
on public.cardio_week_placements for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "cardio_placements delete own" on public.cardio_week_placements;
create policy "cardio_placements delete own"
on public.cardio_week_placements for delete
using (auth.uid() = user_id);

drop trigger if exists cardio_placements_set_updated_at on public.cardio_week_placements;
create trigger cardio_placements_set_updated_at
before update on public.cardio_week_placements
for each row execute function public.set_updated_at();

create or replace function public.seed_default_cardio_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.cardio_session_templates (
        user_id, key, label, description, icon, accent, sort_order, default_weekday
    )
    values
        (p_user_id, 'running',  'Löpning',  'Veckans löppass',   '🏃', '#ff7a1a', 0, 6),
        (p_user_id, 'cycling',  'Cykling',  'Veckans cykelpass', '🚴', '#6ee7a3', 1, 7),
        (p_user_id, 'swimming', 'Simning',  'Veckans simpass',   '🏊', '#5fb6ff', 2, 3)
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

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_cardio_templates(u.id);
    end loop;
end;
$$;
