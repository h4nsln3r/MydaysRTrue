-- Repeatable weekly tasks (Kodning, Handla, Ring mamma) + coding projects.
-- Run AFTER 0067_bathing_drop_legacy_bad_passes.sql. Safe to run multiple times.

-- Allow multiple placements of the same task in one week (like bathing "bad").
alter table public.weekly_task_placements
    drop constraint if exists weekly_task_placements_user_id_task_id_week_start_key;

create table if not exists public.coding_projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (length(trim(title)) > 0),
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists coding_projects_user_active_idx
    on public.coding_projects (user_id, sort_order)
    where archived_at is null;

alter table public.coding_projects enable row level security;

drop policy if exists "coding_projects select own" on public.coding_projects;
create policy "coding_projects select own"
on public.coding_projects for select
using (auth.uid() = user_id);

drop policy if exists "coding_projects insert own" on public.coding_projects;
create policy "coding_projects insert own"
on public.coding_projects for insert
with check (auth.uid() = user_id);

drop policy if exists "coding_projects update own" on public.coding_projects;
create policy "coding_projects update own"
on public.coding_projects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "coding_projects delete own" on public.coding_projects;
create policy "coding_projects delete own"
on public.coding_projects for delete
using (auth.uid() = user_id);

drop trigger if exists coding_projects_set_updated_at on public.coding_projects;
create trigger coding_projects_set_updated_at
before update on public.coding_projects
for each row execute function public.set_updated_at();

alter table public.weekly_task_placements
    add column if not exists coding_project_id uuid
        references public.coding_projects(id) on delete set null;

create index if not exists weekly_task_placements_coding_project_idx
    on public.weekly_task_placements (coding_project_id)
    where coding_project_id is not null;

-- Consolidate numbered slots into one repeatable task per kind.
do $$
declare
    u record;
    pair record;
    canonical_id uuid;
    legacy record;
begin
    for u in select id from auth.users loop
        for pair in
            select * from (values
                ('dev_code', 'dev_code_%', 'Kodning',
                 'Dra in hur många kodpass du vill — minst 2 per vecka.',
                 '💻', '#5fb6ff', 'journal'::text, 'DEV'::text),
                ('home_handla', 'home_handla_%', 'Handla',
                 'Dra in hur många handlingar du vill — minst 2 per vecka. Ange butik och summa när du är klar.',
                 '🛒', '#6ee7a3', 'shop'::text, 'HOME'::text),
                ('life_ring_mamma', 'life_ring_mamma_%', 'Ring mamma',
                 'Dra in hur många samtal du vill — minst 2 per vecka.',
                 '📞', '#f472b6', 'journal'::text, 'Livet'::text)
            ) as t(canonical_key, legacy_like, title, notes, icon, accent, completion_kind, category_name)
        loop
            select id into canonical_id
            from public.weekly_tasks
            where user_id = u.id
              and key = pair.canonical_key
              and archived_at is null
            limit 1;

            if canonical_id is null then
                select id into canonical_id
                from public.weekly_tasks
                where user_id = u.id
                  and key like pair.legacy_like
                  and archived_at is null
                order by sort_order, created_at
                limit 1;

                if canonical_id is not null then
                    update public.weekly_tasks
                    set
                        key = pair.canonical_key,
                        title = pair.title,
                        notes = pair.notes,
                        icon = pair.icon,
                        accent = pair.accent,
                        completion_kind = pair.completion_kind,
                        default_weekday = null
                    where id = canonical_id;
                else
                    insert into public.weekly_tasks (
                        user_id, category_id, key, title, notes, icon, accent,
                        sort_order, default_weekday, completion_kind
                    )
                    select
                        u.id,
                        c.id,
                        pair.canonical_key,
                        pair.title,
                        pair.notes,
                        pair.icon,
                        pair.accent,
                        case pair.canonical_key
                            when 'dev_code' then 0
                            when 'home_handla' then 1
                            else 0
                        end,
                        null,
                        pair.completion_kind
                    from public.task_categories c
                    where c.user_id = u.id
                      and c.scope = 'task'
                      and c.name = pair.category_name
                    limit 1
                    returning id into canonical_id;
                end if;
            else
                update public.weekly_tasks
                set
                    title = pair.title,
                    notes = pair.notes,
                    default_weekday = null
                where id = canonical_id;
            end if;

            if canonical_id is null then
                continue;
            end if;

            for legacy in
                select id
                from public.weekly_tasks
                where user_id = u.id
                  and archived_at is null
                  and id <> canonical_id
                  and (
                      key like pair.legacy_like
                      or key = pair.canonical_key
                  )
            loop
                update public.weekly_task_placements
                set task_id = canonical_id
                where user_id = u.id
                  and task_id = legacy.id;

                update public.weekly_tasks
                set archived_at = now()
                where id = legacy.id;
            end loop;
        end loop;
    end loop;
end;
$$;

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
            'Skriv vad du jobbar med — anteckna vad du gjorde när du är klar.',
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
end;
$$;

create or replace function public.seed_default_weekly_life(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    life_id uuid;
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values (p_user_id, 'task', 'Livet', '❤️', '#f472b6', 4)
    on conflict (user_id, scope, name) do nothing;

    select id into life_id
    from public.task_categories
    where user_id = p_user_id and scope = 'task' and name = 'Livet';

    insert into public.weekly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        default_weekday, completion_kind
    )
    values
        (
            p_user_id, life_id, 'life_ring_mamma', 'Ring mamma',
            'Dra in hur många samtal du vill — minst 2 per vecka.',
            '📞', '#f472b6', 0, null, 'journal'
        ),
        (
            p_user_id, life_id, 'life_ring_mormor_farmor', 'Ring mormor eller farmor',
            'Ring antingen Sannas mormor eller farmor — skriv vem du ringde och vad ni pratade om.',
            '👵', '#f472b6', 2, null, 'journal'
        ),
        (
            p_user_id, life_id, 'life_ring_van', 'Ring vän',
            'Ring en vän — anteckna vem du pratade med och vad ni gick igenom.',
            '🤝', '#f472b6', 3, null, 'journal'
        )
    on conflict (user_id, key) do nothing;
end;
$$;
