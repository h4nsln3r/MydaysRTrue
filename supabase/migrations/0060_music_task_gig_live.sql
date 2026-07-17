-- Link music weekly task completions to own-band gigs or attended live concerts.
alter table weekly_task_placements
  add column if not exists music_log_kind text
    check (music_log_kind is null or music_log_kind in ('gig', 'live')),
  add column if not exists gig_id uuid references public.gigs(id) on delete set null,
  add column if not exists live_event_id uuid references public.live_events(id) on delete set null;

create index if not exists weekly_task_placements_gig_id_idx
  on public.weekly_task_placements (gig_id)
  where gig_id is not null;

create index if not exists weekly_task_placements_live_event_id_idx
  on public.weekly_task_placements (live_event_id)
  where live_event_id is not null;
