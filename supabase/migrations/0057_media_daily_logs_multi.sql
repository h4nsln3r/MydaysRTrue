-- Allow multiple media logs per day (one per title).

alter table public.media_daily_logs
    drop constraint if exists media_daily_logs_user_id_local_date_key;

alter table public.media_daily_logs
    add constraint media_daily_logs_user_item_date_key
    unique (user_id, local_date, media_item_id);
