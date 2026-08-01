-- Optional free-text comment on daily mood / day feeling.

alter table public.mood_daily_logs
    add column if not exists note text;
