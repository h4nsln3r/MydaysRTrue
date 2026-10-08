-- One-off "Övrigt" rows for Läsa & titta.
-- These count for the day only and are not part of the yearly library.

create table if not exists public.media_other_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    local_date date not null,
    kind text not null check (kind in (
        'book', 'movie', 'series', 'magazine', 'podcast', 'article', 'other'
    )),
    other_label text,
    note text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint media_other_logs_note_len check (
        char_length(trim(note)) between 1 and 280
    ),
    constraint media_other_logs_other_label check (
        (
            kind = 'other'
            and other_label is not null
            and char_length(trim(other_label)) between 1 and 80
        )
        or (
            kind <> 'other'
            and other_label is null
        )
    )
);

create index if not exists media_other_logs_user_date_idx
    on public.media_other_logs (user_id, local_date);

alter table public.media_other_logs enable row level security;

drop policy if exists "media_other_logs select own" on public.media_other_logs;
create policy "media_other_logs select own"
on public.media_other_logs for select using (auth.uid() = user_id);

drop policy if exists "media_other_logs insert own" on public.media_other_logs;
create policy "media_other_logs insert own"
on public.media_other_logs for insert with check (auth.uid() = user_id);

drop policy if exists "media_other_logs update own" on public.media_other_logs;
create policy "media_other_logs update own"
on public.media_other_logs for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_other_logs delete own" on public.media_other_logs;
create policy "media_other_logs delete own"
on public.media_other_logs for delete using (auth.uid() = user_id);

drop trigger if exists media_other_logs_set_updated_at on public.media_other_logs;
create trigger media_other_logs_set_updated_at
before update on public.media_other_logs
for each row execute function public.set_updated_at();
