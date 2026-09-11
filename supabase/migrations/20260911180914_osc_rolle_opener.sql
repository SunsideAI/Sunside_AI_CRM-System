-- Eingespielt am 2026-09-11 um 18:09 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- OSC-Umbau: die heutigen Coldcaller werden Opener.
-- Der Wert wird ergaenzt, nicht ersetzt - die Umstellung der 49 Coldcaller
-- ist eine eigene Entscheidung und kein Nebeneffekt dieser Migration.
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'rolle_type' and e.enumlabel = 'Opener') then
    alter type public.rolle_type add value 'Opener';
  end if;
end $$;
