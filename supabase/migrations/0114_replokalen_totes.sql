-- Rename the rehearsal-room bill to Replokalen Totes.

update public.monthly_tasks
set title = 'Replokalen Totes'
where key = 'bill_replokal';

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
        user_id, category_id, key, title, notes, day_of_month, icon, accent,
        sort_order, completion_kind, paid_alone
    )
    values
        (
            p_user_id, bills_id, 'bill_hyra', 'Hyra',
            'Betals en gång per månad.',
            25, '🏠', '#ff5247', 0, 'simple', false
        ),
        (
            p_user_id, bills_id, 'bill_el', 'El',
            'Elräkning — placera på förfallodag.',
            25, '⚡', '#ffcf3a', 1, 'simple', false
        ),
        (
            p_user_id, bills_id, 'bill_internet', 'Internet',
            'Internet — placera på förfallodag.',
            25, '🌐', '#5fb6ff', 2, 'simple', false
        ),
        (
            p_user_id, bills_id, 'bill_replokal', 'Replokalen Totes',
            'Bara du betalar. Dagen du väljer gäller varje månad.',
            null, '🎸', '#e879f9', 3, 'simple', true
        ),
        (
            p_user_id, bills_id, 'bill_parkering', 'Parkering',
            'Bara du betalar. Måste betalas samma datum varje månad.',
            null, '🅿️', '#34d399', 4, 'simple', true
        )
    on conflict (user_id, key) do update
    set
        category_id = excluded.category_id,
        title = excluded.title,
        notes = excluded.notes,
        day_of_month = coalesce(public.monthly_tasks.day_of_month, excluded.day_of_month),
        icon = excluded.icon,
        accent = excluded.accent,
        sort_order = excluded.sort_order,
        completion_kind = excluded.completion_kind,
        paid_alone = excluded.paid_alone,
        archived_at = null;
end;
$$;
