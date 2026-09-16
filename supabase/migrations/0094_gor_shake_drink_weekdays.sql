-- Gör shake weekday chips used to mean "show the task these days"
-- (Mon/Wed/Sun). They now mean drink days. Reset to Mon–Fri to match
-- shake intake (no Saturday/Sunday), so stock scheduling is correct.
-- Run AFTER 0093. Safe to run multiple times.

update public.habits
set weekdays = array[1, 2, 3, 4, 5]::integer[]
where key = 'gor_shake';
