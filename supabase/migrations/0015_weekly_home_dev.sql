-- MyDays — HOME & DEV weekly tasks with rich completion fields
-- Run AFTER 0014_bathing.sql. Safe to run multiple times.

alter table public.weekly_tasks
    add column if not exists key text,
    add column if not exists completion_kind text not null default 'simple'
        check (completion_kind in ('simple', 'shop', 'journal', 'laundry'));

-- Full unique index (not partial) so ON CONFLICT (user_id, key) works.
-- Multiple rows with key = NULL per user are still allowed in PostgreSQL.
drop index if exists public.weekly_tasks_user_key_idx;

create unique index if not exists weekly_tasks_user_id_key_idx
    on public.weekly_tasks (user_id, key);

alter table public.weekly_task_placements
    add column if not exists plan_note text,
    add column if not exists shop_location text,
    add column if not exists shop_amount numeric(10, 2)
        check (shop_amount is null or shop_amount >= 0),
    add column if not exists laundry_loads integer
        check (laundry_loads is null or (laundry_loads between 1 and 30));

create or replace function public.seed_default_weekly_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values
        (p_user_id, 'weekly', 'HOME', '🏠', '#6ee7a3', 0),
        (p_user_id, 'weekly', 'DEV',  '🛠', '#5fb6ff', 1)
    on conflict (user_id, scope, name) do nothing;
end;
$$;

create or replace function public.seed_default_weekly_home_dev(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    home_id uuid;
    dev_id uuid;
begin
    perform public.seed_default_weekly_categories(p_user_id);

    select id into home_id
    from public.task_categories
    where user_id = p_user_id and scope = 'weekly' and name = 'HOME';

    select id into dev_id
    from public.task_categories
    where user_id = p_user_id and scope = 'weekly' and name = 'DEV';

    insert into public.weekly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        default_weekday, completion_kind
    )
    values
        (
            p_user_id, home_id, 'home_stadning', 'Städning',
            'Plocka upp saker, damma, dammsuga och blöttorka.',
            '🧹', '#6ee7a3', 0, null, 'simple'
        ),
        (
            p_user_id, home_id, 'home_handla_1', 'Handla',
            'Veckohandling 1 — ange butik och summa när du är klar.',
            '🛒', '#6ee7a3', 1, null, 'shop'
        ),
        (
            p_user_id, home_id, 'home_handla_2', 'Handla',
            'Veckohandling 2 — ange butik och summa när du är klar.',
            '🛒', '#6ee7a3', 2, null, 'shop'
        ),
        (
            p_user_id, home_id, 'home_projekt', 'Hemmaprojekt',
            'Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.',
            '🔨', '#6ee7a3', 3, null, 'journal'
        ),
        (
            p_user_id, home_id, 'home_tvatta', 'Tvätta',
            'Skriv in bokad tid — ange antal tvättar när du är klar.',
            '👕', '#6ee7a3', 4, null, 'laundry'
        ),
        (
            p_user_id, dev_id, 'dev_code_1', 'Kodning',
            'Vad sitter du med? Anteckna resultatet när du är klar.',
            '💻', '#5fb6ff', 0, null, 'journal'
        ),
        (
            p_user_id, dev_id, 'dev_code_2', 'Kodning',
            'Andra kodpasset — vad sitter du med?',
            '💻', '#5fb6ff', 1, null, 'journal'
        ),
        (
            p_user_id, dev_id, 'dev_learn', 'Lära',
            'Vad lär du dig den här veckan?',
            '📚', '#5fb6ff', 2, null, 'journal'
        ),
        (
            p_user_id, dev_id, 'dev_friend', 'Friend code',
            'Koda tillsammans med en vän — anteckna vad ni gjorde.',
            '👥', '#5fb6ff', 3, null, 'journal'
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

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_weekly_home_dev(u.id);
    end loop;
end;
$$;
