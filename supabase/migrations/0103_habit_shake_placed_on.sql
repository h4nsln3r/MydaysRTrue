-- Pin Gör shake on one day from the daily-view plus button.
-- Does not restart stock. Run AFTER 0102. Safe to run multiple times.

alter table public.habits
    add column if not exists shake_placed_on date;

comment on column public.habits.shake_placed_on is
    'Show Gör shake on this date from the day plus button. After a batch on or after this date, the usual stock schedule decides the next time.';
