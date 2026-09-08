-- Laundry booking: the week's task can be completed as a booking, and a
-- follow-up wash placement is created on the booked day (same task).
alter table public.weekly_task_placements
  add column if not exists laundry_booked_from_id uuid
    references public.weekly_task_placements(id)
    on delete set null;

create index if not exists weekly_task_placements_laundry_booked_from_idx
  on public.weekly_task_placements (laundry_booked_from_id);
