-- Eingespielt am 2026-09-11 um 18:17 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Der Akteur eines Statuswechsels.
--
-- set_config() taugt hier nicht: Jeder PostgREST-Aufruf ist eine eigene
-- Transaktion, eine vorher gesetzte Sitzungsvariable waere beim UPDATE laengst
-- wieder weg. Der Akteur reist deshalb in derselben Zeile mit, die ohnehin
-- geschrieben wird - der Trigger liest ihn dort ab.
alter table public.hot_leads
  add column if not exists zuletzt_geaendert_von uuid references public.users(id) on delete set null;

comment on column public.hot_leads.zuletzt_geaendert_von is
  'Wer diese Zeile zuletzt geaendert hat. Wird von der Anwendung bei jedem Schreibvorgang mitgesetzt und vom Protokoll-Trigger ausgelesen.';

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
begin
  if new.status is distinct from old.status then
    insert into public.hot_lead_ereignisse
      (hot_lead_id, art, von_status, nach_status, akteur_id, bemerkung, daten)
    values (
      new.id, 'statuswechsel', old.status, new.status, v_akteur,
      case when v_akteur is null then 'Schreiber nicht gekennzeichnet - Aufruf von ausserhalb des CRM' end,
      jsonb_build_object(
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
