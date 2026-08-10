-- Keep only the repeatable "bad" template; archive leftover bad_1/2/3.
-- Run AFTER 0066_shop_amount_expr.sql. Safe to run multiple times.

do $$
declare
    u record;
    canonical_bad_id uuid;
    t record;
begin
    for u in select id from auth.users loop
        select id into canonical_bad_id
        from public.bathing_session_templates
        where user_id = u.id
          and key = 'bad'
          and archived_at is null
        limit 1;

        if canonical_bad_id is null then
            select id into canonical_bad_id
            from public.bathing_session_templates
            where user_id = u.id
              and key like 'bad_%'
              and archived_at is null
            order by sort_order
            limit 1;

            if canonical_bad_id is not null then
                update public.bathing_session_templates
                set
                    key = 'bad',
                    label = 'Bad',
                    description = 'Dra in hur många bad du vill den här veckan.',
                    sort_order = 0
                where id = canonical_bad_id;
            else
                insert into public.bathing_session_templates (
                    user_id, key, label, description, icon, accent, sort_order, default_weekday
                )
                values (
                    u.id, 'bad', 'Bad',
                    'Dra in hur många bad du vill den här veckan.',
                    '🛁', '#38bdf8', 0, 1
                )
                returning id into canonical_bad_id;
            end if;
        end if;

        for t in
            select id
            from public.bathing_session_templates
            where user_id = u.id
              and key like 'bad_%'
              and archived_at is null
              and id <> canonical_bad_id
        loop
            update public.bathing_week_placements
            set template_id = canonical_bad_id
            where user_id = u.id
              and template_id = t.id;

            update public.bathing_session_templates
            set archived_at = now()
            where id = t.id;
        end loop;
    end loop;
end;
$$;

create or replace function public.seed_default_bathing_templates(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.bathing_session_templates (
        user_id, key, label, description, icon, accent, sort_order, default_weekday
    )
    values
        (
            p_user_id, 'bad', 'Bad',
            'Dra in hur många bad du vill den här veckan.',
            '🛁', '#38bdf8', 0, 1
        ),
        (
            p_user_id, 'bastu', 'Bastu', 'Veckans bastu',
            '🧖', '#f97316', 1, 6
        )
    on conflict (user_id, key) do nothing;
end;
$$;
