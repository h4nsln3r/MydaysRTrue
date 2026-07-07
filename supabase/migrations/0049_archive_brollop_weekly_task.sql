-- Archive mistaken recurring weekly task about wedding money to Julia.
-- Keep any one-off variant (single_week_start is not null). Safe to run multiple times.

update public.weekly_tasks
set archived_at = now()
where archived_at is null
  and single_week_start is null
  and (
    lower(trim(title)) like '%bröloppspengar%'
    or lower(trim(title)) like '%bröllopspengar%'
  );
