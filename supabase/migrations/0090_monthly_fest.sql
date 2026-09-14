-- Repeatable monthly Fest under Livet (multiple day placements per month).
-- Run AFTER 0089_user_sports.sql. Safe to run multiple times.

alter table public.monthly_tasks
    add column if not exists is_repeatable boolean not null default false;

alter table public.monthly_task_completions
    add column if not exists is_instance boolean not null default false;

alter table public.monthly_task_completions
    drop constraint if exists monthly_task_completions_user_id_task_id_month_start_key;

create unique index if not exists monthly_completions_one_per_month
    on public.monthly_task_completions (user_id, task_id, month_start)
    where is_instance = false;

create index if not exists monthly_completions_instances_idx
    on public.monthly_task_completions (user_id, task_id, month_start)
    where is_instance = true;

create or replace function public.seed_default_monthly_fest(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    life_id uuid;
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'Livet', '❤️', '#f472b6', 4)
    on conflict (user_id, scope, name) do nothing;

    select id into life_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'Livet';

    insert into public.monthly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        day_of_month, completion_kind, is_repeatable
    )
    values (
        p_user_id,
        life_id,
        'life_fest',
        'Fest',
        'Dra in hur många fester du vill den här månaden — välj dag och logga efteråt.',
        '🎉',
        '#f472b6',
        40,
        null,
        'simple',
        true
    )
    on conflict (user_id, key) do update
    set
        archived_at = null,
        enabled = true,
        is_repeatable = true,
        title = excluded.title,
        notes = excluded.notes,
        icon = excluded.icon,
        accent = excluded.accent,
        category_id = coalesce(public.monthly_tasks.category_id, excluded.category_id);
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
    perform public.seed_default_monthly_fest(new.id);

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_monthly_fest(u.id);
    end loop;
end;
$$;
