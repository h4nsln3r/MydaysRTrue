-- MyDays — monthly bills (Räkningar: El, Hyra, Internet)
-- Run AFTER 0018_media_yearly.sql. Safe to run multiple times.

alter table public.monthly_tasks
    add column if not exists key text;

drop index if exists public.monthly_tasks_user_key_idx;

create unique index if not exists monthly_tasks_user_id_key_idx
    on public.monthly_tasks (user_id, key);

alter table public.monthly_task_completions
    add column if not exists scheduled_day_of_month integer
        check (scheduled_day_of_month is null or scheduled_day_of_month between 1 and 31),
    add column if not exists is_unscheduled boolean not null default false;

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
    values (p_user_id, 'monthly', 'Räkningar', '💸', '#ff5247', 0)
    on conflict (user_id, scope, name) do nothing;

    select id into bills_id
    from public.task_categories
    where user_id = p_user_id and scope = 'monthly' and name = 'Räkningar';

    insert into public.monthly_tasks (
        user_id, category_id, key, title, notes, day_of_month, icon, accent, sort_order
    )
    values
        (
            p_user_id, bills_id, 'bill_hyra', 'Hyra',
            'Betals en gång per månad.',
            1, '🏠', '#ff5247', 0
        ),
        (
            p_user_id, bills_id, 'bill_el', 'El',
            'Elräkning — placera på förfallodag.',
            null, '⚡', '#ffcf3a', 1
        ),
        (
            p_user_id, bills_id, 'bill_internet', 'Internet',
            'Internet — placera på förfallodag.',
            null, '🌐', '#5fb6ff', 2
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
    perform public.seed_default_monthly_bills(new.id);

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_monthly_bills(u.id);
    end loop;
end;
$$;
