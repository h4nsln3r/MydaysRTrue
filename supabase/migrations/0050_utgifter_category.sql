-- MyDays — Utgifter category + expense completion kind for weekly tasks
-- Run AFTER 0049_checklist_completions.sql. Safe to run multiple times.

alter table public.weekly_tasks
    drop constraint if exists weekly_tasks_completion_kind_check;

alter table public.weekly_tasks
    add constraint weekly_tasks_completion_kind_check
        check (completion_kind in (
            'simple', 'shop', 'journal', 'laundry', 'music', 'note', 'expense'
        ));

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
    perform public.seed_default_monthly_bills(new.id);
    perform public.seed_default_monthly_savings(new.id);
    perform public.seed_default_monthly_finance(new.id);
    perform public.seed_default_utgifter(new.id);

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_utgifter(u.id);
    end loop;
end;
$$;
