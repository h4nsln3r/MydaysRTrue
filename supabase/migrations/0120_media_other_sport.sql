-- Allow "sport" as a one-off "Övrigt" kind on Läsa & titta.

alter table public.media_other_logs
    drop constraint if exists media_other_logs_kind_check;

alter table public.media_other_logs
    add constraint media_other_logs_kind_check check (kind in (
        'book', 'movie', 'series', 'magazine', 'podcast', 'article', 'sport', 'other'
    ));
