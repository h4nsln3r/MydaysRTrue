-- Hemmaprojekt can be dragged onto the week multiple times, like Handla.
-- Goal stays 1 (optional extras); source remains in the backlog.
-- Run AFTER 0086_spend_kind.sql. Safe to run multiple times.

update public.weekly_tasks
set
    is_repeatable = true,
    notes = case
        when notes is null
          or notes = 'Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.'
        then 'Dra in hur många hemmaprojekt du vill. Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.'
        else notes
    end
where archived_at is null
  and key = 'home_projekt';

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
            p_user_id, home_id, 'home_handla', 'Handla',
            'Dra in hur många handlingar du vill — minst 2 per vecka. Ange butik och summa när du är klar.',
            '🛒', '#6ee7a3', 1, null, 'shop'
        ),
        (
            p_user_id, home_id, 'home_projekt', 'Hemmaprojekt',
            'Dra in hur många hemmaprojekt du vill. Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.',
            '🔨', '#6ee7a3', 3, null, 'journal'
        ),
        (
            p_user_id, home_id, 'home_tvatta', 'Tvätta',
            'Skriv in bokad tid — ange antal tvättar när du är klar.',
            '👕', '#6ee7a3', 4, null, 'laundry'
        ),
        (
            p_user_id, dev_id, 'dev_code', 'Kodning',
            'Dra in hur många kodpass du vill — minst 2 per vecka. Välj projekt och anteckna vad du gjorde.',
            '💻', '#5fb6ff', 0, null, 'journal'
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

    update public.weekly_tasks
    set
        is_repeatable = true,
        notes = case
            when notes is null
              or notes = 'Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.'
            then 'Dra in hur många hemmaprojekt du vill. Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.'
            else notes
        end
    where user_id = p_user_id
      and key = 'home_projekt'
      and archived_at is null;
end;
$$;
