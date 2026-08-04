-- Keep the typed sum expression (e.g. "45+120+8,50") alongside numeric shop_amount.
alter table public.weekly_task_placements
  add column if not exists shop_amount_expr text;
