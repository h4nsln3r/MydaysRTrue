-- Director and cast for a completed cinema visit.

alter table public.live_events
    add column if not exists director text,
    add column if not exists actors text;
