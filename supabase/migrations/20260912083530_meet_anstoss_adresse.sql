-- Eingespielt am 2026-09-12 um 08:35 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Korrektur: Die Adresse des CRM stand in current_setting('app.crm_url'), also
-- in einer Sitzungsvariablen. Ein cron-Lauf startet eine eigene Sitzung und
-- haette dort nie etwas gefunden - der Anstoss waere jedes Mal mit
-- "nicht erreichbar" beendet worden, ohne dass jemand es merkt.
-- Die Adresse gehoert in die Einstellungen, wo sie auch aenderbar ist.
insert into public.einstellungen (schluessel, wert, beschreibung) values
  ('crm_url', 'https://crmsunsideai.netlify.app',
   'Adresse des CRM. Die Datenbank stoesst darueber Netlify-Functions an, etwa das Oeffnen der Meet-Raeume.')
on conflict (schluessel) do nothing;

create or replace function public.meet_oeffnen_anstossen(p_stunden int default 72)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lauf bigint := lauf_starten('meet-oeffnen');
  v_offen int;
  v_url text;
begin
  select wert into v_url from public.einstellungen where schluessel = 'crm_url';

  select count(*) into v_offen
    from public.hot_leads
   where terminart = 'Video'
     and meet_geoeffnet_am is null
     and meet_fehler is null
     and meeting_link is not null
     and coalesce(termin_abschlussgespraech, termin_beratungsgespraech)
         between now() - interval '1 hour' and now() + (p_stunden || ' hours')::interval;

  if v_offen = 0 then
    perform lauf_beenden(v_lauf, jsonb_build_object('offen', 0), null);
    return v_lauf;
  end if;

  if v_url is null or v_url = '' then
    perform lauf_beenden(v_lauf, null,
      'Einstellung crm_url fehlt - die Function ist nicht erreichbar');
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

-- Alle 20 Minuten waehrend der Arbeitszeit. Haeufiger als die Fristenpruefung,
-- weil ein Termin auch kurzfristig gebucht werden kann und der Raum dann
-- rechtzeitig offen sein muss.
select cron.schedule('meet-oeffnen', '*/20 6-21 * * *', $$select public.meet_oeffnen_anstossen(72)$$);
