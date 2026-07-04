-- Optional comment on media items (e.g. why you added a film or series).

alter table public.media_items
    add column if not exists note text;
