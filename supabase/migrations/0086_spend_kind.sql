-- Classify grocery/expense placements: food (mat), private, or shared (delat).
alter table public.weekly_task_placements
  add column if not exists spend_kind text;

alter table public.weekly_task_placements
  drop constraint if exists weekly_task_placements_spend_kind_check;

alter table public.weekly_task_placements
  add constraint weekly_task_placements_spend_kind_check
  check (
    spend_kind is null
    or spend_kind in ('food', 'private', 'shared')
  );

-- Existing grocery completions were logged as Handla without a split — treat as mat.
update public.weekly_task_placements p
set spend_kind = 'food'
from public.weekly_tasks t
where t.id = p.task_id
  and t.completion_kind = 'shop'
  and p.shop_amount is not null
  and p.spend_kind is null;
