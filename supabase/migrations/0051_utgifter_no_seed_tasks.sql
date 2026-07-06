-- MyDays — Remove pre-seeded Utgifter example tasks (category only)
-- Run AFTER 0050_utgifter_category.sql. Safe to run multiple times.

create or replace function public.seed_default_utgifter(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'Utgifter', '💸', '#f97316', 4)
    on conflict (user_id, scope, name) do nothing;
end;
$$;

delete from public.weekly_tasks
where key in ('expense_spontan', 'expense_mat');

delete from public.monthly_tasks
where key in ('expense_abonnemang', 'expense_stor');
