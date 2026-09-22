-- Travel on the year leave calendar.
-- kind 'travel' skips work like vacation and unlocks a per-day trip note.

alter table public.leave_periods
    drop constraint if exists leave_periods_kind_check;

alter table public.leave_periods
    add constraint leave_periods_kind_check
    check (kind in ('vacation', 'day_off', 'travel'));

alter table public.leave_periods
    add column if not exists title text;

alter table public.leave_periods
    drop constraint if exists leave_periods_title_len;

alter table public.leave_periods
    add constraint leave_periods_title_len
    check (title is null or char_length(title) <= 80);

alter table public.leave_periods
    drop constraint if exists leave_periods_travel_needs_title;

alter table public.leave_periods
    add constraint leave_periods_travel_needs_title
    check (
        kind <> 'travel'
        or (title is not null and length(btrim(title)) > 0)
    );

create table if not exists public.trip_day_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    leave_period_id uuid not null references public.leave_periods(id) on delete cascade,
    local_date date not null,
    body text not null default '' check (char_length(body) <= 2000),
    done_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint trip_day_notes_period_date unique (leave_period_id, local_date)
);

create index if not exists trip_day_notes_user_date_idx
    on public.trip_day_notes (user_id, local_date);

alter table public.trip_day_notes enable row level security;

drop policy if exists "trip_day_notes select own" on public.trip_day_notes;
create policy "trip_day_notes select own"
on public.trip_day_notes for select using (auth.uid() = user_id);

drop policy if exists "trip_day_notes insert own" on public.trip_day_notes;
create policy "trip_day_notes insert own"
on public.trip_day_notes for insert with check (auth.uid() = user_id);

drop policy if exists "trip_day_notes update own" on public.trip_day_notes;
create policy "trip_day_notes update own"
on public.trip_day_notes for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "trip_day_notes delete own" on public.trip_day_notes;
create policy "trip_day_notes delete own"
on public.trip_day_notes for delete using (auth.uid() = user_id);

drop trigger if exists trip_day_notes_set_updated_at on public.trip_day_notes;
create trigger trip_day_notes_set_updated_at
before update on public.trip_day_notes
for each row execute function public.set_updated_at();
