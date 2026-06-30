-- MyDays — Meal-prep box inventory (matlådor)

create table if not exists public.meal_box_stock (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    description text not null check (length(trim(description)) > 0),
    remaining integer not null default 0 check (remaining >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists meal_box_stock_user_description_key_idx
    on public.meal_box_stock (user_id, lower(trim(description)));

create index if not exists meal_box_stock_user_remaining_idx
    on public.meal_box_stock (user_id, remaining desc);

alter table public.meal_box_stock enable row level security;

drop policy if exists "meal_box_stock select own" on public.meal_box_stock;
create policy "meal_box_stock select own"
on public.meal_box_stock for select
using (auth.uid() = user_id);

drop policy if exists "meal_box_stock insert own" on public.meal_box_stock;
create policy "meal_box_stock insert own"
on public.meal_box_stock for insert
with check (auth.uid() = user_id);

drop policy if exists "meal_box_stock update own" on public.meal_box_stock;
create policy "meal_box_stock update own"
on public.meal_box_stock for update
using (auth.uid() = user_id);

drop policy if exists "meal_box_stock delete own" on public.meal_box_stock;
create policy "meal_box_stock delete own"
on public.meal_box_stock for delete
using (auth.uid() = user_id);

alter table public.meal_entries
    add column if not exists from_meal_box boolean not null default false;

alter table public.meal_entries
    add column if not exists meal_box_stock_id uuid
        references public.meal_box_stock(id) on delete set null;

-- Backfill inventory from existing cooking logs.
insert into public.meal_box_stock (user_id, description, remaining)
select
    grouped.user_id,
    grouped.description,
    grouped.remaining
from (
    select
        user_id,
        min(description) as description,
        sum(meal_boxes)::integer as remaining,
        lower(trim(min(description))) as description_key
    from public.meal_entries
    where meal_boxes is not null
      and meal_boxes > 0
      and coalesce(from_meal_box, false) = false
    group by user_id, lower(trim(description))
) as grouped
where not exists (
    select 1
    from public.meal_box_stock existing
    where existing.user_id = grouped.user_id
      and lower(trim(existing.description)) = grouped.description_key
);
