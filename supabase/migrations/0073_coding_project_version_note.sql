-- Optional note on coding project version milestones.
-- Run AFTER 0072_media_completed_on.sql. Safe to run multiple times.

alter table public.coding_project_versions
    add column if not exists note text;

comment on column public.coding_project_versions.note is
    'Optional comment when the version shipped; also mirrored to the journal when written.';
