-- Weekly SPEL category + D&D game night task.
-- Run AFTER 0081_habit_weekdays_work_kind.sql. Safe to run multiple times.

create or replace function public.seed_default_weekly_games(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    spel_id uuid;
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'SPEL', '🎲', '#a78bfa', 5)
    on conflict (user_id, scope, name) do nothing;

    select id into spel_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'SPEL';

    insert into public.weekly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        default_weekday, completion_kind, is_repeatable, weekly_goal
    )
    values (
        p_user_id, spel_id, 'game_dnd', 'D&D',
        'Spela med vänner — dra in kvällen och anteckna sessionen när du är klar. Mål: minst 1 gång per vecka.',
        '🎲', '#a78bfa', 0, null, 'journal', true, 1
    )
    on conflict (user_id, key) do update
    set
        archived_at = null,
        title = excluded.title,
        notes = excluded.notes,
        icon = excluded.icon,
        accent = excluded.accent,
        completion_kind = excluded.completion_kind,
        is_repeatable = true,
        weekly_goal = greatest(1, least(14, coalesce(public.weekly_tasks.weekly_goal, 1))),
        category_id = excluded.category_id,
        sort_order = 0;
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

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_weekly_games(u.id);
    end loop;
end;
$$;
