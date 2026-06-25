-- MyDays — monthly salary task (Lön) for Ekonomi + week plan
-- Run AFTER 0036_monthly_bill_costs.sql. Safe to run multiple times.

create or replace function public.seed_default_monthly_finance(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    finance_id uuid;
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'Ekonomi', '📊', '#c084fc', 5)
    on conflict (user_id, scope, name) do nothing;

    select id into finance_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'Ekonomi';

    insert into public.monthly_tasks (
        user_id, category_id, key, title, notes, day_of_month, icon, accent,
        sort_order, completion_kind
    )
    values
        (
            p_user_id, finance_id, 'finance_ekonomi', 'Gör ekonomin',
            'Fyll i saldo på alla konton — totalen räknas ut automatiskt.',
            null, '📊', '#c084fc', 20, 'finance'
        ),
        (
            p_user_id, finance_id, 'finance_lon', 'Lön',
            'Ange din lön den här månaden — placera på lönedag i veckoplanen.',
            25, '💰', '#6ee7a3', 21, 'amount'
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

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_monthly_finance(u.id);
    end loop;
end;
$$;
