-- Ensure bathing allows multiple placements per template per week (Bad x N).
-- Run AFTER 0019_monthly_bills.sql. Safe to run multiple times.

alter table public.bathing_week_placements
    drop constraint if exists bathing_week_placements_user_id_template_id_week_start_key;

-- Orphan rows block re-insert when the old unique constraint still exists.
delete from public.bathing_week_placements
where weekday is null;
