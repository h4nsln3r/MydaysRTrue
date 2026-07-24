-- Per daily habit: whether it appears on leave/vacation days.
-- Run AFTER 0063_journal_entry_edits.sql. Safe to run multiple times.
-- Default true = keep current behaviour; users opt out in Planera.

alter table public.habits
    add column if not exists show_on_leave boolean not null default true;

comment on column public.habits.show_on_leave is
    'When false, habit is hidden from day plan and Dagen trackers on leave days.';
