-- Eingespielt am 2026-09-11 um 19:23 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Gibt eingespielte Migrationen samt SQL zurueck, damit das Repo den Stand der
-- Datenbank abbilden kann. Ohne das driften beide auseinander - genau der
-- Zustand, den Ticket 0.3 beenden sollte.
create or replace function public.migrationen_lesen(p_ab text default '0')
returns table (version text, name text, sql text)
language sql
security definer
set search_path = supabase_migrations, public
as $$
  select m.version, m.name, array_to_string(m.statements, E';\n\n')
    from supabase_migrations.schema_migrations m
   where m.version >= p_ab
   order by m.version;
$$;

revoke all on function public.migrationen_lesen(text) from public, anon, authenticated;
grant execute on function public.migrationen_lesen(text) to service_role;
