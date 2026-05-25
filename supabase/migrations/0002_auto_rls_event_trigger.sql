-- MyDays — Automatic RLS for new tables in `public`
--
-- Installs a Postgres event trigger that runs
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY
-- on every newly created table in the public schema.
--
-- This mirrors the "Enable auto RLS" option in the Supabase project creation
-- flow. For projects that already exist, run this migration once in the
-- Supabase SQL editor.
--
-- Notes:
--   * Only affects tables created AFTER the trigger is installed.
--     Existing tables (`profiles`, `water_logs`) already have RLS enabled
--     via 0001_init.sql.
--   * RLS without policies = nobody gets access. Always add at least one
--     `create policy ...` statement to a new table.
--
-- Safe to run multiple times.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
as $$
declare
    cmd record;
begin
    for cmd in
        select object_identity, schema_name, command_tag
        from pg_event_trigger_ddl_commands()
        where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
          and object_type in ('table', 'partitioned table')
    loop
        if cmd.schema_name = 'public' then
            begin
                execute format(
                    'alter table if exists %s enable row level security',
                    cmd.object_identity
                );
                raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
            exception
                when others then
                    raise log 'rls_auto_enable: failed to enable RLS on % (%)',
                        cmd.object_identity, sqlerrm;
            end;
        end if;
    end loop;
end;
$$;

-- Recreate the trigger without a WHEN filter — the function above filters
-- internally on schema + command_tag, which avoids parser quirks around
-- multi-word tags like 'CREATE TABLE AS' in some SQL clients.
drop event trigger if exists rls_auto_enable_trigger;

create event trigger rls_auto_enable_trigger
on ddl_command_end
execute function public.rls_auto_enable();
