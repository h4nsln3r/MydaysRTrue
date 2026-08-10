-- When a media title is finished, store the completion calendar date.
-- Run AFTER 0071_coding_project_versions.sql. Safe to run multiple times.

alter table public.media_items
    add column if not exists completed_on date;

comment on column public.media_items.completed_on is
    'Local calendar date YYYY-MM-DD when the title was finished. Null until complete.';

create index if not exists media_items_user_completed_on_idx
    on public.media_items (user_id, completed_on)
    where completed_on is not null and archived_at is null;

-- Backfill from the latest daily log for titles that already look finished.
with best as (
    select
        l.media_item_id,
        max(l.position) as best_position,
        max(l.local_date) as last_date
    from public.media_daily_logs l
    group by l.media_item_id
)
update public.media_items mi
set completed_on = best.last_date
from best
where mi.id = best.media_item_id
  and mi.completed_on is null
  and mi.archived_at is null
  and (
      (mi.kind = 'movie' and best.best_position > 0)
      or (
          mi.kind in ('book', 'series')
          and mi.total_length is not null
          and mi.total_length > 0
          and best.best_position >= mi.total_length
      )
  );
