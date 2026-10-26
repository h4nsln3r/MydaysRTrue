-- Bills are paid around the 25th, so they belong to that week.
-- Hyra was seeded on the 1st and the other bills had no day, which made
-- the next month show up as soon as a week overlapped the 1st.

update public.monthly_tasks
set day_of_month = 25
where key in ('bill_hyra', 'bill_el', 'bill_internet')
  and archived_at is null;

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
        sort_order, completion_kind
    )
    values
        (
            p_user_id, bills_id, 'bill_hyra', 'Hyra',
            'Betals en gång per månad.',
            25, '🏠', '#ff5247', 0, 'simple'
        ),
        (
            p_user_id, bills_id, 'bill_el', 'El',
            'Elräkning — placera på förfallodag.',
            25, '⚡', '#ffcf3a', 1, 'simple'
        ),
        (
            p_user_id, bills_id, 'bill_internet', 'Internet',
            'Internet — placera på förfallodag.',
            25, '🌐', '#5fb6ff', 2, 'simple'
        )
    on conflict (user_id, key) do update
    set
        category_id = excluded.category_id,
        title = excluded.title,
        notes = excluded.notes,
        day_of_month = excluded.day_of_month,
        icon = excluded.icon,
        accent = excluded.accent,
        completion_kind = excluded.completion_kind,
        archived_at = null;
end;
$$;
