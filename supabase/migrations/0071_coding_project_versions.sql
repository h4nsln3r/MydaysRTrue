-- Coding project version milestones with completion dates (v1, v2, …).
-- Run AFTER 0070_coding_project_links_status.sql. Safe to run multiple times.

create table if not exists public.coding_project_versions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    project_id uuid not null references public.coding_projects(id) on delete cascade,
    version_number integer not null check (version_number >= 1 and version_number <= 50),
    completed_on date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (project_id, version_number)
);

create index if not exists coding_project_versions_project_idx
    on public.coding_project_versions (project_id, version_number);

create index if not exists coding_project_versions_user_idx
    on public.coding_project_versions (user_id);

alter table public.coding_project_versions enable row level security;

drop policy if exists "coding_project_versions select own" on public.coding_project_versions;
create policy "coding_project_versions select own"
on public.coding_project_versions for select
using (auth.uid() = user_id);

drop policy if exists "coding_project_versions insert own" on public.coding_project_versions;
create policy "coding_project_versions insert own"
on public.coding_project_versions for insert
with check (auth.uid() = user_id);

drop policy if exists "coding_project_versions update own" on public.coding_project_versions;
create policy "coding_project_versions update own"
on public.coding_project_versions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "coding_project_versions delete own" on public.coding_project_versions;
create policy "coding_project_versions delete own"
on public.coding_project_versions for delete
using (auth.uid() = user_id);

drop trigger if exists coding_project_versions_set_updated_at on public.coding_project_versions;
create trigger coding_project_versions_set_updated_at
before update on public.coding_project_versions
for each row execute function public.set_updated_at();

-- Migrate legacy status v1_done → version 1 (date = last update day).
insert into public.coding_project_versions (
    user_id, project_id, version_number, completed_on
)
select
    p.user_id,
    p.id,
    1,
    coalesce(p.updated_at::date, p.created_at::date, current_date)
from public.coding_projects p
where p.status = 'v1_done'
  and not exists (
      select 1
      from public.coding_project_versions v
      where v.project_id = p.id
        and v.version_number = 1
  );

update public.coding_projects
set status = 'active'
where status = 'v1_done';

alter table public.coding_projects
    drop constraint if exists coding_projects_status_check;

alter table public.coding_projects
    add constraint coding_projects_status_check
        check (status in ('active', 'done'));
