-- Restore one-off tasks that were archived on completion.
-- Earlier, marking a one-off (weekly `single_week_start` / monthly
-- `single_month_start`) as done archived the task, which removed it from both
-- "Dagens plan" and the diary. We now keep completed one-offs, so un-archive the
-- ones that were archived *because* they were completed (they have a done
-- placement/completion). Explicitly deleted tasks (no completion) stay archived.
-- Safe to run multiple times.

-- Weekly one-offs completed at least once.
update public.weekly_tasks wt
set archived_at = null
where wt.archived_at is not null
  and wt.single_week_start is not null
  and exists (
      select 1
      from public.weekly_task_placements p
      where p.user_id = wt.user_id
        and p.task_id = wt.id
        and p.done_at is not null
  );

-- Monthly one-offs completed at least once.
update public.monthly_tasks mt
set archived_at = null
where mt.archived_at is not null
  and mt.single_month_start is not null
  and exists (
      select 1
      from public.monthly_task_completions c
      where c.user_id = mt.user_id
        and c.task_id = mt.id
        and c.done_at is not null
  );
