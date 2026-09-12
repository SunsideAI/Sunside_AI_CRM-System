-- Eingespielt am 2026-09-12 um 08:32 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Die Meet-Raeume werden automatisch geoeffnet.
--
-- Problem: Alle Termine laufen ueber EIN Google-Konto. Google Meet laesst nur
-- den Organisator einlassen, und in dem Konto sitzt niemand. Bisher musste
-- jeder Raum vor dem Termin von Hand geoeffnet werden - bei vielen Terminen
-- geht das unter.
--
-- Loesung mit den vorhandenen Werkzeugen: Der im CRM gespeicherte Link ist
-- Calendlys Weiterleitung (calendly.com/events/<id>/google_meet). Sie loest
-- ohne Anmeldung auf meet.google.com/<code> auf. Mit diesem Code stellt
-- Googles Meet-Schnittstelle den Raum auf "offen".
--
-- Rein additiv.

alter table public.hot_leads
  add column if not exists meet_code        text,
  add column if not exists meet_geoeffnet_am timestamptz,
  add column if not exists meet_fehler      text;

comment on column public.hot_leads.meet_code is
  'Meeting-Code aus der Calendly-Weiterleitung, z. B. mug-kqve-wpf. Schluessel fuer Googles Meet-Schnittstelle.';
comment on column public.hot_leads.meet_geoeffnet_am is
  'Wann der Raum auf "offen" gestellt wurde. Leer trotz Video-Termin heisst: noch geschlossen.';
comment on column public.hot_leads.meet_fehler is
  'Letzter Fehler beim Oeffnen. Macht ein stilles Scheitern sichtbar, statt es zu verschlucken.';

create index if not exists idx_hot_leads_meet_offen
  on public.hot_leads (termin_beratungsgespraech)
  where meet_geoeffnet_am is null and terminart = 'Video';

-- Anstoss fuer den Oeffnen-Lauf. Nach dem Muster der Operations-Anstoesse:
-- die Function liegt bei Netlify, die Datenbank ruft sie ueber pg_net.
create or replace function public.meet_oeffnen_anstossen(p_stunden int default 72)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lauf bigint := lauf_starten('meet-oeffnen');
  v_offen int;
  v_url text := current_setting('app.crm_url', true);
begin
  select count(*) into v_offen
    from public.hot_leads
   where terminart = 'Video'
     and meet_geoeffnet_am is null
     and coalesce(termin_abschlussgespraech, termin_beratungsgespraech)
         between now() - interval '1 hour' and now() + (p_stunden || ' hours')::interval;

  if v_offen = 0 then
    perform lauf_beenden(v_lauf, jsonb_build_object('offen', 0), null);
    return v_lauf;
  end if;

  if v_url is null or v_url = '' then
    perform lauf_beenden(v_lauf, null, 'app.crm_url ist nicht gesetzt - Function nicht erreichbar');
    return v_lauf;
  end if;

  perform net.http_post(
    url := v_url || '/.netlify/functions/meet-oeffnen',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('lauf', v_lauf, 'stunden', p_stunden)
  );

  return v_lauf;
end;
$$;

revoke all on function public.meet_oeffnen_anstossen(int) from public, anon, authenticated;
grant execute on function public.meet_oeffnen_anstossen(int) to service_role;
