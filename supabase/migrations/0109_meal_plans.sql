-- Plan note and "I cook" flag for breakfast, lunch and dinner.
-- Separate from meal_entries so the note can exist before the meal is logged.

create table if not exists public.meal_plans (
    user_id uuid not null references auth.users (id) on delete cascade,
    local_date date not null,
    meal text not null check (meal in ('breakfast', 'lunch', 'dinner')),
    note text,
    cooks_self boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, local_date, meal),
    constraint meal_plans_note_check check (
        note is null or char_length(trim(note)) between 1 and 280
    )
);

alter table public.meal_plans enable row level security;

drop policy if exists meal_plans_own on public.meal_plans;
create policy meal_plans_own on public.meal_plans
    for all
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop trigger if exists meal_plans_set_updated_at on public.meal_plans;
create trigger meal_plans_set_updated_at
before update on public.meal_plans
for each row execute function public.set_updated_at();
