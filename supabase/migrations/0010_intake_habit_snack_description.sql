-- MyDays — Intake as daily tracker + snack descriptions
-- Run AFTER 0009_snacks.sql. Safe to run multiple times.

alter table public.habits drop constraint if exists habits_kind_check;
alter table public.habits add constraint habits_kind_check
    check (kind in (
        'tri_state', 'water', 'meal', 'snack', 'intake',
        'steps', 'activity_hours'
    ));

-- Snack entries can carry a short description of what was eaten.
alter table public.snack_checks
    add column if not exists description text not null default '';

-- =========================================================
-- Default habits — add Intake tracker after Mellanmål
-- =========================================================
create or replace function public.seed_default_habits(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.habits (user_id, key, label, kind, icon, accent, sort_order)
    values
        (p_user_id, 'water',           'Vatten',          'water',           '💧', '#5fb6ff', 0),
        (p_user_id, 'meals',           'Måltider',        'meal',            '🍽', '#ff9a3c', 1),
        (p_user_id, 'snacks',          'Mellanmål',       'snack',           '🍎', '#ffcf3a', 2),
        (p_user_id, 'intake',          'Intake',          'intake',          '💊', '#6ee7a3', 3),
        (p_user_id, 'smoke_free',      'Rökfri',          'tri_state',       '🚭', '#6ee7a3', 4),
        (p_user_id, 'sugar_free',      'Sockerfri',       'tri_state',       '🍭', '#ffcf3a', 5),
        (p_user_id, 'activity_hours',  'Aktivitet',       'activity_hours',  '⏱', '#c084fc', 6),
        (p_user_id, 'steps',           'Steg',            'steps',           '👟', '#5fb6ff', 7)
    on conflict (user_id, key) do nothing;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_habits(u.id);
    end loop;
end;
$$;
