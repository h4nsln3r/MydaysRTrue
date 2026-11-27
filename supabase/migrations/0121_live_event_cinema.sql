-- Cinema ("Bio") as its own live-event kind, distinct from a film at home.

alter table public.live_events
    drop constraint if exists live_events_kind_check;

alter table public.live_events
    add constraint live_events_kind_check
        check (kind in (
            'concert', 'sport', 'race', 'birthday', 'wedding', 'cinema', 'other'
        ));

alter table public.weekly_task_placements
    drop constraint if exists weekly_task_placements_live_kind_check;

alter table public.weekly_task_placements
    add constraint weekly_task_placements_live_kind_check
        check (
            live_kind is null
            or live_kind in (
                'concert', 'sport', 'race', 'birthday', 'wedding', 'cinema', 'other'
            )
        );
