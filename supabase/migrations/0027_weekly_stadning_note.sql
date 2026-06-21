-- Optional free-text comment on ALL weekly and monthly tasks.
--
-- The comment columns already exist, so no new columns are needed:
--   * weekly_task_placements.note    (since 0005)
--   * monthly_task_completions.note  (since 0005)
--
-- Weekly side: introduce completion kind 'note' (a quick task that also accepts
-- an optional comment), make it the default, and convert every existing plain
-- 'simple' task to it so all weekly tasks can be commented. Special kinds
-- (shop/journal/laundry/music) keep their behaviour and also accept an optional
-- comment via the app layer.
--
-- Monthly side: comments are wired purely in the app
-- (toggleMonthlyTaskDoneAction) against the existing note column.

alter table public.weekly_tasks
    drop constraint if exists weekly_tasks_completion_kind_check;

alter table public.weekly_tasks
    add constraint weekly_tasks_completion_kind_check
        check (completion_kind in ('simple', 'shop', 'journal', 'laundry', 'music', 'note'));

alter table public.weekly_tasks
    alter column completion_kind set default 'note';

update public.weekly_tasks
set completion_kind = 'note'
where completion_kind = 'simple';

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
            '🧹', '#6ee7a3', 0, null, 'note'
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
