-- MyDays — Meal cooking metadata (who cooked + meal prep boxes)
-- Run AFTER 0030_sport.sql. Safe to run multiple times.
--
-- lunch/dinner: who prepared the food (self, julia, bought) and optional
-- count of meal-prep boxes made when cooking at home.

alter table public.meal_entries
  add column if not exists cooked_by text
    check (cooked_by is null or cooked_by in ('self', 'julia', 'bought')),
  add column if not exists meal_boxes integer
    check (meal_boxes is null or (meal_boxes >= 0 and meal_boxes <= 30));
