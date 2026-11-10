-- Allow promenad (walking) as a cardio kind.
-- Run AFTER 0117_shake_calories_protein.sql. Safe to run multiple times.

alter table public.cardio_week_placements
    drop constraint if exists cardio_week_placements_plan_kind_check;

alter table public.cardio_week_placements
    add constraint cardio_week_placements_plan_kind_check
    check (
        plan_kind is null
        or plan_kind in ('running', 'walking', 'cycling', 'swimming')
    );

alter table public.cardio_week_placements
    drop constraint if exists cardio_week_placements_actual_kind_check;

alter table public.cardio_week_placements
    add constraint cardio_week_placements_actual_kind_check
    check (
        actual_kind is null
        or actual_kind in ('running', 'walking', 'cycling', 'swimming')
    );
