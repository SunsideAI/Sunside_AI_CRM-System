-- Eingespielt am 2026-09-12 um 09:25 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- "Kaltakquise" heisst im neuen Prozess "Opening" - die Stufe, in der der
-- Opener arbeitet. Betroffen sind nur vier Datensaetze; der Rest ist
-- Beschriftung im Code.
--
-- Der alte Wert bleibt in email_templates zusaetzlich gueltig, bis der Code
-- draussen ist: Sonst faende der veroeffentlichte Stand seine eigenen Vorlagen
-- nicht mehr.

update public.hot_leads
   set quelle = 'Opening'
 where quelle = 'Kaltakquise';

update public.email_templates
   set kategorie = 'Opening'
 where kategorie = 'Kaltakquise';

-- Gegenprobe
do $$
declare v_rest int;
begin
  select count(*) into v_rest from public.hot_leads where quelle = 'Kaltakquise';
  if v_rest > 0 then raise exception 'hot_leads: % Reste', v_rest; end if;

  select count(*) into v_rest from public.email_templates where kategorie = 'Kaltakquise';
  if v_rest > 0 then raise exception 'email_templates: % Reste', v_rest; end if;

  raise notice 'Umbenennung vollstaendig';
end $$;
