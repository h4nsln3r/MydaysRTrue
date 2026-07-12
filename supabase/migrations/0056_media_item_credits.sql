-- Optional author (books) and director/actors (movies) on media items.

alter table public.media_items
    add column if not exists author text,
    add column if not exists director text,
    add column if not exists actors text;
