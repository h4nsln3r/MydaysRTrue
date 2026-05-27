-- MyDays — Categories + Weekly tasks + Monthly tasks
-- Run AFTER 0004_meals.sql. Safe to run multiple times.
--
-- Design notes
--   * `task_categories` are user-defined groupings ("Träning", "Hälsa", "Hem"…).
--     Each category is scoped to ONE task type via `scope` so daily/weekly/
--     monthly each have their own independent set.
--   * Daily tasks are the existing `habits` table — we just add an optional
--     `category_id` to it.
--   * Weekly tasks: each user has a list of weekly task templates. Each week
--     starts empty; the user "places" tasks onto a weekday. The placement row
--     also tracks completion (`done_at`).
--   * Monthly tasks: each task can optionally have a default `day_of_month`.
--     Completion is tracked per (task, month_start) in
--     `monthly_task_completions`. A completion row also doubles as
--     "scheduled for this month" — we always have one row per task per month
--     once the user does anything with it.

-- =========================================================
-- task_categories
-- =========================================================
create table if not exists public.task_categories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    scope text not null check (scope in ('daily', 'weekly', 'monthly')),
    name text not null check (length(trim(name)) > 0),
    icon text not null default '📁',
    accent text not null default '#ff7a1a',
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, scope, name)
);

create index if not exists task_categories_user_scope_idx
    on public.task_categories (user_id, scope, sort_order)
    where archived_at is null;

alter table public.task_categories enable row level security;

drop policy if exists "task_categories select own" on public.task_categories;
create policy "task_categories select own"
on public.task_categories for select
using (auth.uid() = user_id);

drop policy if exists "task_categories insert own" on public.task_categories;
create policy "task_categories insert own"
on public.task_categories for insert
with check (auth.uid() = user_id);

drop policy if exists "task_categories update own" on public.task_categories;
create policy "task_categories update own"
on public.task_categories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "task_categories delete own" on public.task_categories;
create policy "task_categories delete own"
on public.task_categories for delete
using (auth.uid() = user_id);

drop trigger if exists task_categories_set_updated_at on public.task_categories;
create trigger task_categories_set_updated_at
before update on public.task_categories
for each row execute function public.set_updated_at();

-- =========================================================
-- habits.category_id — daily categories live on the existing habits table
-- =========================================================
alter table public.habits
    add column if not exists category_id uuid
    references public.task_categories(id) on delete set null;

create index if not exists habits_category_idx
    on public.habits (user_id, category_id)
    where archived_at is null;

-- =========================================================
-- weekly_tasks
-- =========================================================
create table if not exists public.weekly_tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    category_id uuid references public.task_categories(id) on delete set null,
    title text not null check (length(trim(title)) > 0),
    notes text,
    icon text not null default '✓',
    accent text not null default '#ff7a1a',
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists weekly_tasks_user_active_idx
    on public.weekly_tasks (user_id, sort_order)
    where archived_at is null;

create index if not exists weekly_tasks_user_category_idx
    on public.weekly_tasks (user_id, category_id)
    where archived_at is null;

alter table public.weekly_tasks enable row level security;

drop policy if exists "weekly_tasks select own" on public.weekly_tasks;
create policy "weekly_tasks select own"
on public.weekly_tasks for select
using (auth.uid() = user_id);

drop policy if exists "weekly_tasks insert own" on public.weekly_tasks;
create policy "weekly_tasks insert own"
on public.weekly_tasks for insert
with check (auth.uid() = user_id);

drop policy if exists "weekly_tasks update own" on public.weekly_tasks;
create policy "weekly_tasks update own"
on public.weekly_tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "weekly_tasks delete own" on public.weekly_tasks;
create policy "weekly_tasks delete own"
on public.weekly_tasks for delete
using (auth.uid() = user_id);

drop trigger if exists weekly_tasks_set_updated_at on public.weekly_tasks;
create trigger weekly_tasks_set_updated_at
before update on public.weekly_tasks
for each row execute function public.set_updated_at();

-- =========================================================
-- weekly_task_placements
-- One row per (user, task, week_start). week_start is always a Monday.
-- weekday: ISO weekday (1 = Mon … 7 = Sun).
-- done_at is null until the user checks it off.
-- =========================================================
create table if not exists public.weekly_task_placements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    task_id uuid not null references public.weekly_tasks(id) on delete cascade,
    week_start date not null,
    weekday integer not null check (weekday between 1 and 7),
    done_at timestamptz,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, task_id, week_start)
);

create index if not exists weekly_placements_user_week_idx
    on public.weekly_task_placements (user_id, week_start);
create index if not exists weekly_placements_user_task_idx
    on public.weekly_task_placements (user_id, task_id, week_start desc);

alter table public.weekly_task_placements enable row level security;

drop policy if exists "weekly_placements select own" on public.weekly_task_placements;
create policy "weekly_placements select own"
on public.weekly_task_placements for select
using (auth.uid() = user_id);

drop policy if exists "weekly_placements insert own" on public.weekly_task_placements;
create policy "weekly_placements insert own"
on public.weekly_task_placements for insert
with check (auth.uid() = user_id);

drop policy if exists "weekly_placements update own" on public.weekly_task_placements;
create policy "weekly_placements update own"
on public.weekly_task_placements for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "weekly_placements delete own" on public.weekly_task_placements;
create policy "weekly_placements delete own"
on public.weekly_task_placements for delete
using (auth.uid() = user_id);

drop trigger if exists weekly_placements_set_updated_at on public.weekly_task_placements;
create trigger weekly_placements_set_updated_at
before update on public.weekly_task_placements
for each row execute function public.set_updated_at();

-- =========================================================
-- monthly_tasks
-- =========================================================
create table if not exists public.monthly_tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    category_id uuid references public.task_categories(id) on delete set null,
    title text not null check (length(trim(title)) > 0),
    notes text,
    day_of_month integer check (day_of_month between 1 and 31),
    icon text not null default '✓',
    accent text not null default '#ff7a1a',
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists monthly_tasks_user_active_idx
    on public.monthly_tasks (user_id, sort_order)
    where archived_at is null;

create index if not exists monthly_tasks_user_category_idx
    on public.monthly_tasks (user_id, category_id)
    where archived_at is null;

alter table public.monthly_tasks enable row level security;

drop policy if exists "monthly_tasks select own" on public.monthly_tasks;
create policy "monthly_tasks select own"
on public.monthly_tasks for select
using (auth.uid() = user_id);

drop policy if exists "monthly_tasks insert own" on public.monthly_tasks;
create policy "monthly_tasks insert own"
on public.monthly_tasks for insert
with check (auth.uid() = user_id);

drop policy if exists "monthly_tasks update own" on public.monthly_tasks;
create policy "monthly_tasks update own"
on public.monthly_tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "monthly_tasks delete own" on public.monthly_tasks;
create policy "monthly_tasks delete own"
on public.monthly_tasks for delete
using (auth.uid() = user_id);

drop trigger if exists monthly_tasks_set_updated_at on public.monthly_tasks;
create trigger monthly_tasks_set_updated_at
before update on public.monthly_tasks
for each row execute function public.set_updated_at();

-- =========================================================
-- monthly_task_completions
-- One row per (user, task, month_start). month_start is always YYYY-MM-01.
-- done_at is null until the user checks it off.
-- =========================================================
create table if not exists public.monthly_task_completions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    task_id uuid not null references public.monthly_tasks(id) on delete cascade,
    month_start date not null,
    done_at timestamptz,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, task_id, month_start)
);

create index if not exists monthly_completions_user_month_idx
    on public.monthly_task_completions (user_id, month_start);
create index if not exists monthly_completions_user_task_idx
    on public.monthly_task_completions (user_id, task_id, month_start desc);

alter table public.monthly_task_completions enable row level security;

drop policy if exists "monthly_completions select own" on public.monthly_task_completions;
create policy "monthly_completions select own"
on public.monthly_task_completions for select
using (auth.uid() = user_id);

drop policy if exists "monthly_completions insert own" on public.monthly_task_completions;
create policy "monthly_completions insert own"
on public.monthly_task_completions for insert
with check (auth.uid() = user_id);

drop policy if exists "monthly_completions update own" on public.monthly_task_completions;
create policy "monthly_completions update own"
on public.monthly_task_completions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "monthly_completions delete own" on public.monthly_task_completions;
create policy "monthly_completions delete own"
on public.monthly_task_completions for delete
using (auth.uid() = user_id);

drop trigger if exists monthly_completions_set_updated_at on public.monthly_task_completions;
create trigger monthly_completions_set_updated_at
before update on public.monthly_task_completions
for each row execute function public.set_updated_at();
