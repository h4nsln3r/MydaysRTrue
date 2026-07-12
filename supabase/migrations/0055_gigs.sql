-- Own-band gigs (spelningar) per calendar year.
-- Run AFTER 0054_weekly_placement_on_hold.sql. Safe to run multiple times.

create table if not exists public.gigs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    year integer not null check (year between 1970 and 2100),
    band text not null check (band in ('Totes', 'Bojeng')),
    title text not null check (length(trim(title)) > 0),
    event_date date not null,
    venue text,
    note text,
    rating integer check (rating is null or (rating >= 1 and rating <= 10)),
    played_at timestamptz,
    sort_order integer not null default 0,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists gigs_user_year_idx
    on public.gigs (user_id, year);

create index if not exists gigs_user_date_idx
    on public.gigs (user_id, event_date);

alter table public.gigs enable row level security;

drop policy if exists "gigs select own" on public.gigs;
create policy "gigs select own"
on public.gigs for select using (auth.uid() = user_id);

drop policy if exists "gigs insert own" on public.gigs;
create policy "gigs insert own"
on public.gigs for insert with check (auth.uid() = user_id);

drop policy if exists "gigs update own" on public.gigs;
create policy "gigs update own"
on public.gigs for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "gigs delete own" on public.gigs;
create policy "gigs delete own"
on public.gigs for delete using (auth.uid() = user_id);

drop trigger if exists gigs_set_updated_at on public.gigs;
create trigger gigs_set_updated_at
before update on public.gigs
for each row execute function public.set_updated_at();
