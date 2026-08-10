-- Coding projects: GitHub URL, live URL, live flag, and completion status.
-- Run AFTER 0069_coding_project_description.sql. Safe to run multiple times.

alter table public.coding_projects
    add column if not exists github_url text;

alter table public.coding_projects
    add column if not exists live_url text;

alter table public.coding_projects
    add column if not exists is_live boolean not null default false;

alter table public.coding_projects
    add column if not exists status text;

update public.coding_projects
set status = 'active'
where status is null;

alter table public.coding_projects
    alter column status set default 'active';

alter table public.coding_projects
    alter column status set not null;

alter table public.coding_projects
    drop constraint if exists coding_projects_status_check;

alter table public.coding_projects
    add constraint coding_projects_status_check
        check (status in ('active', 'v1_done', 'done'));
