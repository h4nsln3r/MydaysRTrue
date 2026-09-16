-- Allow updating an already logged snack (description edits).
-- Run AFTER 0091_fest_occasion.sql. Safe to run multiple times.
--
-- snack_checks originally only had SELECT/INSERT/DELETE policies, so changing
-- a completed mellanmål could not persist — the day plan looked updated until
-- refresh, and the journal kept the old text.

drop policy if exists "snack_checks update own" on public.snack_checks;
create policy "snack_checks update own"
on public.snack_checks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
