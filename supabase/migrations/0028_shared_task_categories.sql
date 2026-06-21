-- MyDays — shared task categories for weekly AND monthly tasks.
-- Run AFTER 0027_weekly_stadning_note.sql. Safe to run multiple times.
--
-- Previously categories were scoped per task type: 'weekly' categories
-- (HOME, DEV, MUSIC) were separate rows from 'monthly' categories (Räkningar).
-- We now share ONE set across both via a new scope value 'task'. Daily habit
-- categories keep their own 'daily' scope.
--
-- Migration strategy:
--   1. Allow the new 'task' scope.
--   2. Merge weekly+monthly categories that share a name per user into a single
--      keeper, repoint that name's tasks, and drop the duplicates.
--   3. Convert the surviving weekly/monthly categories to 'task'.
--   4. Reseed default-category helpers to create/look up 'task' categories.

-- 1. Allow the new shared scope value.
alter table public.task_categories
    drop constraint if exists task_categories_scope_check;

alter table public.task_categories
    add constraint task_categories_scope_check
        check (scope in ('daily', 'weekly', 'monthly', 'task'));

-- 2. Merge duplicate weekly/monthly categories that share a (case-insensitive)
--    name per user. Active categories win as keeper, then lowest sort_order.
drop table if exists _cat_merge;
create temporary table _cat_merge as
select
    c.id,
    first_value(c.id) over (
        partition by c.user_id, lower(c.name)
        order by (c.archived_at is not null), c.sort_order, c.created_at, c.id
    ) as keeper_id
from public.task_categories c
where c.scope in ('weekly', 'monthly');

update public.weekly_tasks w
set category_id = m.keeper_id
from _cat_merge m
where w.category_id = m.id and m.id <> m.keeper_id;

update public.monthly_tasks t
set category_id = m.keeper_id
from _cat_merge m
where t.category_id = m.id and m.id <> m.keeper_id;

delete from public.task_categories c
using _cat_merge m
where c.id = m.id and m.id <> m.keeper_id;

drop table if exists _cat_merge;

-- 3. Convert surviving weekly/monthly categories to the shared 'task' scope.
update public.task_categories
set scope = 'task'
where scope in ('weekly', 'monthly');

-- 4. Reseed helpers so new users (and reruns) use the shared 'task' scope.
create or replace function public.seed_default_weekly_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values
        (p_user_id, 'task', 'HOME',  '🏠', '#6ee7a3', 0),
        (p_user_id, 'task', 'DEV',   '🛠', '#5fb6ff', 1),
        (p_user_id, 'task', 'MUSIC', '🎸', '#e879f9', 2)
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
    where user_id = p_user_id and scope = 'task' and name = 'HOME';

    select id into dev_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'DEV';

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

create or replace function public.seed_default_weekly_music(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    music_id uuid;
begin
    perform public.seed_default_weekly_categories(p_user_id);

    select id into music_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'MUSIC';

    insert into public.weekly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        default_weekday, completion_kind
    )
    values
        (
            p_user_id, music_id, 'music_guitar', 'Akustisk Gitarr',
            'Öva akustisk gitarr — lägg till låtar och övningar i listan.',
            '🎸', '#e879f9', 0, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_bas_1', 'Bas 1',
            'Basövning — lägg till låtar och övningar i listan.',
            '🎸', '#e879f9', 1, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_bas_ack_piano', 'Bas/Ack/Piano',
            'Bas, ackord eller piano — lägg till i listan.',
            '🎹', '#e879f9', 2, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_inspelning', 'Inspelning',
            'Inspelningssession — anteckna vad du ska spela in.',
            '🎙️', '#e879f9', 3, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_rep_1', 'Rep 1',
            'Repetition — välj band och anteckna vad ni gick igenom.',
            '🤘', '#e879f9', 4, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_rep_2', 'Rep 2',
            'Andra repetitionen — välj band och anteckna vad ni gick igenom.',
            '🤘', '#e879f9', 5, null, 'music'
        )
    on conflict (user_id, key) do nothing;
end;
$$;

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
    values (p_user_id, 'task', 'Räkningar', '💸', '#ff5247', 3)
    on conflict (user_id, scope, name) do nothing;

    select id into bills_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'Räkningar';

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
