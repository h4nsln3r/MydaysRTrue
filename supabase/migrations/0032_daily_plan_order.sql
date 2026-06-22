-- Per-day sort order for the unified "Dagens plan" checklist.
-- Run AFTER 0031_meal_cooking.sql. Safe to run multiple times.

create table if not exists public.daily_plan_orders (
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    item_key text not null check (length(trim(item_key)) > 0),
    sort_order integer not null default 0,
    primary key (user_id, local_date, item_key)
);

create index if not exists daily_plan_orders_user_date_idx
    on public.daily_plan_orders (user_id, local_date, sort_order);

alter table public.daily_plan_orders enable row level security;

drop policy if exists "daily_plan_orders select own" on public.daily_plan_orders;
create policy "daily_plan_orders select own"
on public.daily_plan_orders for select
using (auth.uid() = user_id);

drop policy if exists "daily_plan_orders insert own" on public.daily_plan_orders;
create policy "daily_plan_orders insert own"
on public.daily_plan_orders for insert
with check (auth.uid() = user_id);

drop policy if exists "daily_plan_orders update own" on public.daily_plan_orders;
create policy "daily_plan_orders update own"
on public.daily_plan_orders for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_plan_orders delete own" on public.daily_plan_orders;
create policy "daily_plan_orders delete own"
on public.daily_plan_orders for delete
using (auth.uid() = user_id);
