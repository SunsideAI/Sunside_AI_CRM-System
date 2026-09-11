-- Eingespielt am 2026-09-11 um 18:19 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Schreiber ohne angemeldeten Nutzer (Webhooks, Laeufe) kennzeichnen sich hier.
-- Ohne das waere jeder Calendly-Aufruf im Protokoll ein "unbekannter Schreiber"
-- und wuerde genau das Signal uebertoenen, wegen dem das Protokoll existiert.
alter table public.hot_leads
  add column if not exists zuletzt_geaendert_durch text;

comment on column public.hot_leads.zuletzt_geaendert_durch is
  'Systemkennung des Schreibers ohne angemeldeten Nutzer, z. B. calendly-webhook. Leer bei Aenderungen durch Personen.';

create or replace function public.hot_lead_statuswechsel_protokoll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_akteur uuid := coalesce(
    new.zuletzt_geaendert_von,
    nullif(current_setting('app.akteur_id', true), '')::uuid
  );
  v_system text := nullif(new.zuletzt_geaendert_durch, '');
begin
  if new.status is distinct from old.status then
    insert into public.hot_lead_ereignisse
      (hot_lead_id, art, von_status, nach_status, akteur_id, akteur_rolle, bemerkung, daten)
    values (
      new.id, 'statuswechsel', old.status, new.status, v_akteur,
      case when v_akteur is not null then 'Person'
           when v_system is not null then 'System'
           else 'unbekannt' end,
      case when v_akteur is null and v_system is null
           then 'Schreiber nicht gekennzeichnet - Aufruf von ausserhalb des CRM' end,
      jsonb_build_object(
        'system',           v_system,
        'verbindung',       current_setting('application_name', true),
        'db_rolle',         current_user,
        'termin_beratung',  new.termin_beratungsgespraech,
        'termin_abschluss', new.termin_abschlussgespraech
      )
    );
  end if;
  return new;
end;
$$;
