-- Drag-in live experience (concert, sport, race, …) under Livet.
-- Run AFTER 0098_leave_travel.sql. Safe to run multiple times.

alter table public.weekly_tasks
    drop constraint if exists weekly_tasks_completion_kind_check;

alter table public.weekly_tasks
    add constraint weekly_tasks_completion_kind_check
        check (completion_kind in (
            'simple', 'shop', 'journal', 'laundry', 'music', 'note', 'expense', 'live'
        ));

alter table public.weekly_task_placements
    add column if not exists live_kind text;

alter table public.weekly_task_placements
    drop constraint if exists weekly_task_placements_live_kind_check;

alter table public.weekly_task_placements
    add constraint weekly_task_placements_live_kind_check
        check (
            live_kind is null
            or live_kind in (
                'concert', 'sport', 'race', 'birthday', 'wedding', 'other'
            )
        );

create or replace function public.seed_life_live_task(p_user_id uuid)
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
    where user_id = p_user_id
      and scope = 'task'
      and name = 'Livet'
      and archived_at is null
    limit 1;

    insert into public.weekly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        default_weekday, completion_kind, is_repeatable, weekly_goal
    )
    values (
        p_user_id,
        life_id,
        'life_live',
        'Live',
        'Dra in en live-upplevelse — konsert, match, lopp eller fest. Välj typ och skriv vad det var när du är klar.',
        '🎫',
        '#f472b6',
        1,
        null,
        'live',
        true,
        1
    )
    on conflict (user_id, key) do update
    set
        archived_at = null,
        enabled = true,
        completion_kind = 'live',
        is_repeatable = true,
        category_id = coalesce(public.weekly_tasks.category_id, excluded.category_id);
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
    perform public.seed_life_live_task(new.id);

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_life_live_task(u.id);
    end loop;
end;
$$;
