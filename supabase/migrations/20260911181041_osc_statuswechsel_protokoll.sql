-- Eingespielt am 2026-09-11 um 18:10 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- OSC-Umbau: jeder Statuswechsel wird protokolliert.
--
-- Doppelter Zweck:
-- 1. Ticket 3 - ohne Verlauf ist kein Zeitpunkt belegbar (Provisionsausloeser).
-- 2. Beweismittel vor Ticket 1: Der Status ist heute freier Text, und es ist
--    unbekannt, welche externen Automatisierungen darauf schreiben. Bevor eine
--    Werteliste erzwungen wird, muss belegt sein, wer schreibt - sonst legt
--    der CHECK stillschweigend einen Aussenpfad lahm. Das Protokoll haelt den
--    Verbindungsnamen fest; alles ohne gesetzten Akteur kommt von aussen.

create or replace function public.hot_lead_statuswechsel_protokoll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_akteur uuid := nullif(current_setting('app.akteur_id', true), '')::uuid;
begin
  if new.status is distinct from old.status then
    insert into public.hot_lead_ereignisse
      (hot_lead_id, art, von_status, nach_status, akteur_id, bemerkung, daten)
    values (
      new.id, 'statuswechsel', old.status, new.status, v_akteur,
      case when v_akteur is null then 'Schreiber nicht gekennzeichnet' end,
      jsonb_build_object(
        'verbindung',  current_setting('application_name', true),
        'db_rolle',    current_user,
        'termin_beratung',  new.termin_beratungsgespraech,
        'termin_abschluss', new.termin_abschlussgespraech
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hot_lead_statuswechsel on public.hot_leads;
create trigger trg_hot_lead_statuswechsel
  after update of status on public.hot_leads
  for each row execute function public.hot_lead_statuswechsel_protokoll();

-- Damit die Anwendung sich ausweisen kann, ohne dass jede Abfrage umgebaut
-- werden muss: einmal je Vorgang setzen, gilt bis Transaktionsende.
create or replace function public.akteur_setzen(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select set_config('app.akteur_id', coalesce(p_user_id::text, ''), true)::void;
$$;

revoke all on function public.akteur_setzen(uuid) from public, anon, authenticated;
grant execute on function public.akteur_setzen(uuid) to service_role;
