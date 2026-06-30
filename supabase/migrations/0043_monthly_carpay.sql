-- MyDays — monthly Carpay transfer task for Ekonomi
-- Run AFTER 0042_meal_box_cooked_by.sql. Safe to run multiple times.

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
        sort_order, completion_kind, default_amount_kr
    )
    values
        (
            p_user_id, finance_id, 'finance_ekonomi', 'Gör ekonomin',
            'Fyll i saldo på alla konton — totalen räknas ut automatiskt.',
            null, '📊', '#c084fc', 20, 'finance', null
        ),
        (
            p_user_id, finance_id, 'finance_lon', 'Lön',
            'Ange din lön den här månaden — placera på lönedag i veckoplanen.',
            25, '💰', '#6ee7a3', 21, 'amount', null
        ),
        (
            p_user_id, finance_id, 'finance_carpay', 'Carpay',
            'För över 2 500–3 000 kr till Carpay.' || E'\n' ||
            'Bankgiro: 5992-3045' || E'\n' ||
            'OCR: 6162034000',
            null, '🚗', '#60a5fa', 22, 'amount', 2750
        )
    on conflict (user_id, key) do update
    set
        category_id = excluded.category_id,
        title = excluded.title,
        notes = excluded.notes,
        day_of_month = excluded.day_of_month,
        icon = excluded.icon,
        accent = excluded.accent,
        sort_order = excluded.sort_order,
        completion_kind = excluded.completion_kind,
        default_amount_kr = excluded.default_amount_kr,
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
