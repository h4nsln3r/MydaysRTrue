-- Habit weekday schedules (replaces every-other-day for Gör shake)
-- plus work day kind: home / office / off / sick.
-- Run AFTER 0080. Safe to run multiple times.

-- ---------------------------------------------------------------------------
-- habits.weekdays — ISO 1=Mon … 7=Sun. Empty/null = every day.
-- ---------------------------------------------------------------------------
alter table public.habits
    add column if not exists weekdays integer[];

alter table public.habits
    drop constraint if exists habits_weekdays_check;

alter table public.habits
    add constraint habits_weekdays_check
    check (
        weekdays is null
        or weekdays <@ array[1, 2, 3, 4, 5, 6, 7]
    );

-- Drop every-other-day on Gör shake so the user picks weekdays instead.
update public.habits
set interval_days = 1,
    interval_anchor_date = null
where key = 'gor_shake';

-- ---------------------------------------------------------------------------
-- work_daily_logs.work_kind
-- ---------------------------------------------------------------------------
alter table public.work_daily_logs
    add column if not exists work_kind text;

alter table public.work_daily_logs
    drop constraint if exists work_daily_logs_work_kind_check;

alter table public.work_daily_logs
    add constraint work_daily_logs_work_kind_check
    check (
        work_kind is null
        or work_kind in ('home', 'office', 'off', 'sick')
    );
