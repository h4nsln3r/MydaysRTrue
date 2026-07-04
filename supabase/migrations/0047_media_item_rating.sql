-- Optional 1–10 rating on media items (books, series, movies).

alter table public.media_items
    add column if not exists rating smallint check (rating is null or (rating >= 1 and rating <= 10));
