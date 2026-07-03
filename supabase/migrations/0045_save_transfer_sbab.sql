-- Point "Överföring sparkonto" at SBAB spar (not LF spar).

update public.monthly_tasks
set
    title = 'Överföring SBAB spar',
    notes = 'Ange belopp som fördes över till SBAB spar.'
where key = 'save_transfer_spar';

create or replace function public.seed_default_monthly_savings(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    savings_id uuid;
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'Sparande', '💰', '#6ee7a3', 4)
    on conflict (user_id, scope, name) do nothing;

    select id into savings_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'Sparande';

    insert into public.monthly_tasks (
        user_id, category_id, key, title, notes, day_of_month, icon, accent,
        sort_order, completion_kind
    )
    values
        (
            p_user_id, savings_id, 'save_transfer_lf', 'Överföring fondkonto LF',
            'Ange belopp som fördes över till Länsförsäkringar.',
            null, '🏦', '#6ee7a3', 10, 'amount'
        ),
        (
            p_user_id, savings_id, 'save_transfer_avanza', 'Överföring Avanza',
            'Ange belopp som fördes över till Avanza.',
            null, '📈', '#5fb6ff', 11, 'amount'
        ),
        (
            p_user_id, savings_id, 'save_transfer_spar', 'Överföring SBAB spar',
            'Ange belopp som fördes över till SBAB spar.',
            null, '🐷', '#ffcf3a', 12, 'amount'
        )
    on conflict (user_id, key) do update
    set
        category_id = excluded.category_id,
        title = excluded.title,
        notes = excluded.notes,
        icon = excluded.icon,
        accent = excluded.accent,
        completion_kind = excluded.completion_kind,
        archived_at = null;
end;
$$;
