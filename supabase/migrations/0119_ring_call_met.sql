-- Ring task: log meeting in person ("Träffats") instead of a call.
-- Counts toward the same weekly Ring goal as a call.
-- Run AFTER 0118_cardio_walking.sql. Safe to run multiple times.

alter table public.weekly_task_placements
    add column if not exists call_met boolean not null default false;

update public.weekly_tasks
set notes = 'Dra in hur många samtal eller träffar du vill — mamma 2× och Sanna, farmor eller en vän 1× per vecka. Välj Ring eller Träffats och vem.'
where key = 'life_ring';
