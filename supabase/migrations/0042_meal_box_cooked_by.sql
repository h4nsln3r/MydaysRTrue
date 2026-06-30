-- MyDays — Allow "meal_box" as who cooked the meal

alter table public.meal_entries drop constraint if exists meal_entries_cooked_by_check;
alter table public.meal_entries add constraint meal_entries_cooked_by_check
    check (cooked_by is null or cooked_by in (
        'self', 'julia', 'bought', 'restaurant', 'other', 'meal_box'
    ));
