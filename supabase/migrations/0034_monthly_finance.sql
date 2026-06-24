-- MyDays — monthly finance, savings transfers, one-off bills.
-- Run AFTER 0033_weekly_life.sql. Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- Schema extensions
-- ---------------------------------------------------------------------------

alter table public.monthly_tasks
    add column if not exists single_month_start date,
    add column if not exists completion_kind text not null default 'simple';

alter table public.monthly_tasks
    drop constraint if exists monthly_tasks_completion_kind_check;

alter table public.monthly_tasks
    add constraint monthly_tasks_completion_kind_check
        check (completion_kind in ('simple', 'amount', 'finance'));

create index if not exists monthly_tasks_single_month_idx
    on public.monthly_tasks (user_id, single_month_start)
    where single_month_start is not null;

alter table public.monthly_task_completions
    add column if not exists amount numeric;

-- Monthly balance snapshot (one row per user per month).
create table if not exists public.monthly_finance_snapshots (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    month_start date not null,
    langforsakringar numeric,
    kort numeric,
    spar numeric,
    isk numeric,
    sbab_spar numeric,
    avanza numeric,
    krypto numeric,
    cash numeric,
    note text,
    done_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, month_start)
);

create index if not exists monthly_finance_snapshots_user_month_idx
    on public.monthly_finance_snapshots (user_id, month_start desc);

alter table public.monthly_finance_snapshots enable row level security;

drop policy if exists "monthly_finance_snapshots select own" on public.monthly_finance_snapshots;
create policy "monthly_finance_snapshots select own"
on public.monthly_finance_snapshots for select
using (auth.uid() = user_id);

drop policy if exists "monthly_finance_snapshots insert own" on public.monthly_finance_snapshots;
create policy "monthly_finance_snapshots insert own"
on public.monthly_finance_snapshots for insert
with check (auth.uid() = user_id);

drop policy if exists "monthly_finance_snapshots update own" on public.monthly_finance_snapshots;
create policy "monthly_finance_snapshots update own"
on public.monthly_finance_snapshots for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "monthly_finance_snapshots delete own" on public.monthly_finance_snapshots;
create policy "monthly_finance_snapshots delete own"
on public.monthly_finance_snapshots for delete
using (auth.uid() = user_id);

drop trigger if exists monthly_finance_snapshots_set_updated_at on public.monthly_finance_snapshots;
create trigger monthly_finance_snapshots_set_updated_at
before update on public.monthly_finance_snapshots
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Data cleanup: duplicate Hyra, ensure bills use Räkningar
-- ---------------------------------------------------------------------------

with ranked_hyra as (
    select
        id,
        row_number() over (
            partition by user_id
            order by (key = 'bill_hyra') desc, (key is not null) desc, created_at, id
        ) as rn
    from public.monthly_tasks
    where archived_at is null
      and lower(trim(title)) = 'hyra'
)
update public.monthly_tasks
set archived_at = now()
where id in (select id from ranked_hyra where rn > 1);

-- Repoint default bills to the shared Räkningar category.
update public.monthly_tasks t
set category_id = c.id
from public.task_categories c
where t.user_id = c.user_id
  and c.scope = 'task'
  and c.name = 'Räkningar'
  and t.archived_at is null
  and t.key in ('bill_hyra', 'bill_el', 'bill_internet')
  and (t.category_id is distinct from c.id);

-- ---------------------------------------------------------------------------
-- Seed helpers
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_monthly_bills(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    bills_id uuid;
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'Räkningar', '💸', '#ff5247', 3)
    on conflict (user_id, scope, name) do nothing;

    select id into bills_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'Räkningar';

    insert into public.monthly_tasks (
        user_id, category_id, key, title, notes, day_of_month, icon, accent,
        sort_order, completion_kind
    )
    values
        (
            p_user_id, bills_id, 'bill_hyra', 'Hyra',
            'Betals en gång per månad.',
            1, '🏠', '#ff5247', 0, 'simple'
        ),
        (
            p_user_id, bills_id, 'bill_el', 'El',
            'Elräkning — placera på förfallodag.',
            null, '⚡', '#ffcf3a', 1, 'simple'
        ),
        (
            p_user_id, bills_id, 'bill_internet', 'Internet',
            'Internet — placera på förfallodag.',
            null, '🌐', '#5fb6ff', 2, 'simple'
        )
    on conflict (user_id, key) do update
    set
        category_id = excluded.category_id,
        title = excluded.title,
        notes = excluded.notes,
        day_of_month = excluded.day_of_month,
        icon = excluded.icon,
        accent = excluded.accent,
        completion_kind = excluded.completion_kind,
        archived_at = null;
end;
$$;

create or replace function public.seed_default_monthly_savings(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    savings_id uuid;
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'Sparande', '💰', '#6ee7a3', 4)
    on conflict (user_id, scope, name) do nothing;

    select id into savings_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'Sparande';

    insert into public.monthly_tasks (
        user_id, category_id, key, title, notes, day_of_month, icon, accent,
        sort_order, completion_kind
    )
    values
        (
            p_user_id, savings_id, 'save_transfer_lf', 'Överföring fondkonto LF',
            'Ange belopp som fördes över till Länsförsäkringar.',
            null, '🏦', '#6ee7a3', 10, 'amount'
        ),
        (
            p_user_id, savings_id, 'save_transfer_avanza', 'Överföring Avanza',
            'Ange belopp som fördes över till Avanza.',
            null, '📈', '#5fb6ff', 11, 'amount'
        ),
        (
            p_user_id, savings_id, 'save_transfer_spar', 'Överföring sparkonto',
            'Ange belopp som fördes över till sparkontot.',
            null, '🐷', '#ffcf3a', 12, 'amount'
        )
    on conflict (user_id, key) do update
    set
        category_id = excluded.category_id,
        title = excluded.title,
        notes = excluded.notes,
        icon = excluded.icon,
        accent = excluded.accent,
        completion_kind = excluded.completion_kind,
        archived_at = null;
end;
$$;

create or replace function public.seed_default_monthly_finance(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    finance_id uuid;
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'Ekonomi', '📊', '#c084fc', 5)
    on conflict (user_id, scope, name) do nothing;

    select id into finance_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'Ekonomi';

    insert into public.monthly_tasks (
        user_id, category_id, key, title, notes, day_of_month, icon, accent,
        sort_order, completion_kind
    )
    values
        (
            p_user_id, finance_id, 'finance_ekonomi', 'Gör ekonomin',
            'Fyll i saldo på alla konton — totalen räknas ut automatiskt.',
            null, '📊', '#c084fc', 20, 'finance'
        )
    on conflict (user_id, key) do update
    set
        category_id = excluded.category_id,
        title = excluded.title,
        notes = excluded.notes,
        icon = excluded.icon,
        accent = excluded.accent,
        completion_kind = excluded.completion_kind,
        archived_at = null;
end;
$$;

-- Backfill existing users.
do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_monthly_bills(u.id);
        perform public.seed_default_monthly_savings(u.id);
        perform public.seed_default_monthly_finance(u.id);
    end loop;
end;
$$;

-- Ensure new users get all monthly defaults.
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
    perform public.seed_default_monthly_bills(new.id);
    perform public.seed_default_monthly_savings(new.id);
    perform public.seed_default_monthly_finance(new.id);

    return new;
end;
$$;
