-- Eingespielt am 2026-09-11 um 17:12 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Die Herkunft eines Hot Leads fest verankern, statt sie zu rekonstruieren.
--
-- Wer den ersten Anruf gemacht hat, stand bisher ausschliesslich in
-- lead_assignments — einer Tabelle, aus der das Offboarding löscht. Beim
-- Übergang leads → hot_leads wurde die Person nicht mitkopiert, weil es keine
-- Spalte dafür gab. Ergebnis: Mit jedem ausscheidenden Mitarbeiter verlor das
-- System rückwirkend Zuordnung, auch bei längst gewonnenen Kunden.
--
-- Stand 11.09.2026: 551 von 591 Hot Leads sind noch eindeutig rekonstruierbar,
-- 38 nicht mehr (davon 4 abgeschlossene Deals). Einen Monat zuvor waren es 23.
alter table public.hot_leads
  add column if not exists opener_id uuid references public.users(id) on delete set null;

comment on column public.hot_leads.opener_id is
  'Wer den Erstkontakt gemacht hat. Beim Anlegen aus lead_assignments gefüllt '
  'und danach unabhängig davon — die Zuordnung überlebt das Offboarding.';

create index if not exists hot_leads_opener_id_idx on public.hot_leads (opener_id);

-- Backfill, solange es geht: nur eindeutige Fälle. Bei mehreren Kandidaten
-- bleibt die Spalte leer — eine geratene Zuordnung wäre schlimmer als eine
-- sichtbare Lücke, weil daran später Geld hängt.
update public.hot_leads h
   set opener_id = (select la.user_id from public.lead_assignments la
                     where la.lead_id = h.lead_id limit 1)
 where h.opener_id is null
   and h.lead_id is not null
   and (select count(distinct la.user_id) from public.lead_assignments la
         where la.lead_id = h.lead_id) = 1;

/*
 * Ab jetzt trägt die Datenbank die Zuordnung selbst ein.
 *
 * Bewusst hier und nicht in der Anwendung: Die Lücke entstand, weil ein
 * Anwendungspfad (das Anlegen des Hot Leads) etwas nicht tat, was ein anderer
 * (das Offboarding) voraussetzte. Eine Regel in der Datenbank gilt für beide
 * Wege — auch für den, den es noch nicht gibt.
 */
create or replace function public.hot_lead_opener_setzen()
returns trigger language plpgsql security definer
set search_path to 'public' as $$
begin
  if new.opener_id is null and new.lead_id is not null then
    select la.user_id into new.opener_id
      from public.lead_assignments la
     where la.lead_id = new.lead_id
     group by la.user_id
    having count(*) >= 1
     limit 1;

    -- Nur bei Eindeutigkeit übernehmen.
    if (select count(distinct la.user_id) from public.lead_assignments la
         where la.lead_id = new.lead_id) <> 1 then
      new.opener_id := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists hot_lead_opener_setzen_tr on public.hot_leads;
create trigger hot_lead_opener_setzen_tr
  before insert on public.hot_leads
  for each row execute function public.hot_lead_opener_setzen();
