-- MyDays — MUSIC weekly tasks with checklist, comments and band for reps
-- Run AFTER 0023_work_daily.sql. Safe to run multiple times.

-- Extend completion_kind with 'music'
alter table public.weekly_tasks
    drop constraint if exists weekly_tasks_completion_kind_check;

alter table public.weekly_tasks
    add constraint weekly_tasks_completion_kind_check
        check (completion_kind in ('simple', 'shop', 'journal', 'laundry', 'music'));

alter table public.weekly_task_placements
    add column if not exists band text
        check (band is null or band in ('Totes', 'Bojeng'));

-- Persistent checklist items per weekly task template
create table if not exists public.weekly_task_checklist_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    task_id uuid not null references public.weekly_tasks (id) on delete cascade,
    text text not null check (char_length(trim(text)) > 0 and char_length(text) <= 200),
    done_at timestamptz,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists weekly_task_checklist_items_task_idx
    on public.weekly_task_checklist_items (task_id, sort_order);

alter table public.weekly_task_checklist_items enable row level security;

drop policy if exists weekly_task_checklist_items_own on public.weekly_task_checklist_items;
create policy weekly_task_checklist_items_own on public.weekly_task_checklist_items
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Add MUSIC category to default categories
create or replace function public.seed_default_weekly_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.task_categories (user_id, scope, name, icon, accent, sort_order)
    values
        (p_user_id, 'weekly', 'HOME',  '🏠', '#6ee7a3', 0),
        (p_user_id, 'weekly', 'DEV',   '🛠', '#5fb6ff', 1),
        (p_user_id, 'weekly', 'MUSIC', '🎸', '#e879f9', 2)
    on conflict (user_id, scope, name) do nothing;
end;
$$;

create or replace function public.seed_default_weekly_music(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    music_id uuid;
begin
    perform public.seed_default_weekly_categories(p_user_id);

    select id into music_id
    from public.task_categories
    where user_id = p_user_id and scope = 'weekly' and name = 'MUSIC';

    insert into public.weekly_tasks (
        user_id, category_id, key, title, notes, icon, accent, sort_order,
        default_weekday, completion_kind
    )
    values
        (
            p_user_id, music_id, 'music_guitar', 'Akustisk Gitarr',
            'Öva akustisk gitarr — lägg till låtar och övningar i listan.',
            '🎸', '#e879f9', 0, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_bas_1', 'Bas 1',
            'Basövning — lägg till låtar och övningar i listan.',
            '🎸', '#e879f9', 1, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_bas_ack_piano', 'Bas/Ack/Piano',
            'Bas, ackord eller piano — lägg till i listan.',
            '🎹', '#e879f9', 2, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_inspelning', 'Inspelning',
            'Inspelningssession — anteckna vad du ska spela in.',
            '🎙️', '#e879f9', 3, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_rep_1', 'Rep 1',
            'Repetition — välj band och anteckna vad ni gick igenom.',
            '🤘', '#e879f9', 4, null, 'music'
        ),
        (
            p_user_id, music_id, 'music_rep_2', 'Rep 2',
            'Andra repetitionen — välj band och anteckna vad ni gick igenom.',
            '🤘', '#e879f9', 5, null, 'music'
        )
    on conflict (user_id, key) do nothing;
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
    perform public.seed_default_weekly_music(new.id);

    return new;
end;
$$;

do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_weekly_music(u.id);
    end loop;
end;
$$;
