-- MyDays — weekly life & family calls (Livet)
-- Run AFTER 0032_daily_plan_order.sql. Safe to run multiple times.
--
--   * Ring mamma — 2× per week
--   * Ring mormor eller farmor — 1× per week
--   * Ring vän — 1× per week
-- All use journal completion (comment when logging done).

create or replace function public.seed_default_weekly_life(p_user_id uuid)
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

    insert into public.weekly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        default_weekday, completion_kind
    )
    values
        (
            p_user_id, life_id, 'life_ring_mamma_1', 'Ring mamma',
            'Första samtalet med mamma den här veckan — anteckna vad ni pratade om.',
            '📞', '#f472b6', 0, null, 'journal'
        ),
        (
            p_user_id, life_id, 'life_ring_mamma_2', 'Ring mamma',
            'Andra samtalet med mamma — anteckna vad ni pratade om.',
            '📞', '#f472b6', 1, null, 'journal'
        ),
        (
            p_user_id, life_id, 'life_ring_mormor_farmor', 'Ring mormor eller farmor',
            'Ring antingen Sannas mormor eller farmor — skriv vem du ringde och vad ni pratade om.',
            '👵', '#f472b6', 2, null, 'journal'
        ),
        (
            p_user_id, life_id, 'life_ring_van', 'Ring vän',
            'Ring en vän — anteckna vem du pratade med och vad ni gick igenom.',
            '🤝', '#f472b6', 3, null, 'journal'
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
    perform public.seed_default_weekly_music(new.id);
    perform public.seed_default_weekly_life(new.id);
    perform public.seed_default_sport_templates(new.id);

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_weekly_life(u.id);
    end loop;
end;
$$;
