-- Per-part visibility inside daily habits (intake, meals, snacks, …).
-- Run AFTER 0099_habit_day_visibility.sql. Safe to run multiple times.
-- Missing part = shown. Parent habit flags still hide the whole habit.

alter table public.habits
    add column if not exists part_visibility jsonb not null default '{}'::jsonb;

comment on column public.habits.part_visibility is
    'Optional per-part show flags. Keys are part ids (shake, breakfast, 1, …). Values use showOnVacation, showOnDayOff, showOnSick, showOnWeekend.';
