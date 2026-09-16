-- =====================================================================
-- Die Zeitleiste je Kontakt
-- =====================================================================
-- Eingespielt am 2026-09-16.
--
-- AUSGANGSLAGE: Der gesamte Verlauf stand als Text in leads.kommentar -
-- 29.543 Zeilen ueber 7.586 Kontakte, jeweils oben angehaengt in der Form
--
--     [TT.MM.JJJJ, HH:MM] <Emoji> <Aussage> (<Name>)
--
-- Das laesst sich lesen, aber nicht auswerten, nicht filtern und nicht
-- nach Art durchsuchen. Gesucht war eine Zeitleiste: wann kontaktiert,
-- wann welche Mail raus, wann welcher Termin.
--
-- WAS GEMESSEN WURDE, bevor etwas gebaut wurde:
--
--   22.019 Zeilen tragen [Datum, Uhrzeit]      (74,5 %)
--    5.490 Zeilen ohne Datum                   (18,6 %)
--    2.034 Leerzeilen                          ( 6,9 %)
--
-- Die undatierten stammen aus einer aelteren Migration (Auskunft Paul).
-- Sie bekommen KEIN erfundenes Datum und bleiben, wo sie sind. Ein
-- geschaetzter Zeitstempel in einer Zeitleiste ist schlimmer als eine
-- Luecke, weil ihm geglaubt wird.
--
-- Beim Zerlegen: 0 Zeilen ohne Zeitstempel, 0 ohne Inhalt, 21.441 von
-- 22.019 mit erkennbarem Akteur.
--
-- DAS KOMMENTARFELD BLEIBT UNVERAENDERT. Diese Tabelle ist abgeleitet,
-- nicht ersetzend, und jede Zeile behaelt ihr Original in `roh` - damit
-- jede Auslegung nachpruefbar bleibt.
--
-- KEINE DOPPELUNG AUS hot_leads: 526 der 543 Hot-Lead-Kommentare sind
-- Kopien oder Teilmengen des Lead-Kommentars. Uebernommen wird aus leads;
-- aus hot_leads nur, was dort nicht steht (gemessen: 5 Zeilen).
--
-- ERGEBNIS: 22.024 Ereignisse fuer 7.000 Kontakte, 11.12.2025 bis heute,
-- kein leerer Titel, 6 Zeilen als 'sonstiges'.
-- =====================================================================

create table if not exists public.kontakt_verlauf (
  id           bigint generated always as identity primary key,
  lead_id      uuid references public.leads(id)     on delete cascade,
  hot_lead_id  uuid references public.hot_leads(id) on delete cascade,
  geschehen_am timestamptz not null,
  art          text not null,
  titel        text not null,
  akteur_name  text,
  quelle       text not null default 'kommentar',
  roh          text,
  erfasst_am   timestamptz not null default now(),
  constraint verlauf_braucht_bezug check (lead_id is not null or hot_lead_id is not null)
);

create index if not exists idx_verlauf_lead     on public.kontakt_verlauf(lead_id, geschehen_am desc);
create index if not exists idx_verlauf_hot_lead on public.kontakt_verlauf(hot_lead_id, geschehen_am desc);
create index if not exists idx_verlauf_art      on public.kontakt_verlauf(art, geschehen_am desc);

alter table public.kontakt_verlauf enable row level security;
drop policy if exists "service role manages kontakt_verlauf" on public.kontakt_verlauf;
create policy "service role manages kontakt_verlauf" on public.kontakt_verlauf for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Die Emojis waren bereits Ereignistypen - sie mussten nur benannt werden.
create or replace function public.verlauf_art(p_zeile text)
returns text language sql immutable as $fn$
  select case
    when p_zeile ~ '^\[[^\]]+\]\s*✅'  then 'kontaktiert'
    when p_zeile ~ '^\[[^\]]+\]\s*↩️'  then 'zurueckgesetzt'
    when p_zeile ~ '^\[[^\]]+\]\s*📋'  then 'ergebnis'
    when p_zeile ~ '^\[[^\]]+\]\s*💬'  then 'notiz'
    when p_zeile ~ '^\[[^\]]+\]\s*🔔'  then 'wiedervorlage'
    when p_zeile ~ '^\[[^\]]+\]\s*📧'  then 'mail'
    when p_zeile ~ '^\[[^\]]+\]\s*📅'  then 'termin'
    when p_zeile ~ '^\[[^\]]+\]\s*🔄'  then 'termin_verschoben'
    when p_zeile ~ '^\[[^\]]+\]\s*❌'  then 'verloren'
    when p_zeile ~ '^\[[^\]]+\]\s*🎉'  then 'gewonnen'
    when p_zeile ~ '^\[[^\]]+\]\s*✏️'  then 'feld_geaendert'
    when p_zeile ~ '^\[[^\]]+\]\s*💰'  then 'angebot'
    when p_zeile ~ '^\[[^\]]+\]\s*TERMIN ABGESAGT'   then 'termin_abgesagt'
    when p_zeile ~ '^\[[^\]]+\]\s*TERMIN VERSCHOBEN' then 'termin_verschoben'
    when p_zeile ~ '^\[[^\]]+\]\s*SEO-Analyse'       then 'analyse'
    else 'sonstiges'
  end;
$fn$;

create or replace function public.verlauf_titel(p_zeile text)
returns text language sql immutable as $fn$
  select coalesce(
    nullif(btrim(regexp_replace(
      regexp_replace(btrim(substring(p_zeile from '^\[[^\]]+\]\s*(.*)$')),
                     '\s*\(([^()]{1,60})\)\s*$', ''),
      '^[^\w\d"„]+\s*', '')), ''),
    nullif(btrim(substring(p_zeile from '^\[[^\]]+\]\s*(.*)$')), ''),
    '(ohne Inhalt)');
$fn$;

-- Uebernahme aus leads
insert into public.kontakt_verlauf (lead_id, geschehen_am, art, titel, akteur_name, quelle, roh)
select z.lead_id,
       to_timestamp(substring(z.zeile from '^\[(\d{2}\.\d{2}\.\d{4}),? \d{2}:\d{2}\]') || ' ' ||
                    substring(z.zeile from '^\[\d{2}\.\d{2}\.\d{4},? (\d{2}:\d{2})\]'),
                    'DD.MM.YYYY HH24:MI'),
       public.verlauf_art(z.zeile), public.verlauf_titel(z.zeile),
       substring(z.zeile from '\(([^()]{1,60})\)\s*$'),
       'kommentar-migration', z.zeile
  from (select l.id as lead_id, btrim(zz) as zeile
          from public.leads l, lateral unnest(string_to_array(l.kommentar, E'\n')) as zz
         where coalesce(btrim(l.kommentar),'') <> '') z
 where z.zeile ~ '^\[\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}\]'
   and not exists (select 1 from public.kontakt_verlauf v
                    where v.lead_id = z.lead_id and v.roh = z.zeile);

-- Nur, was im Lead-Kommentar fehlt
insert into public.kontakt_verlauf (lead_id, hot_lead_id, geschehen_am, art, titel, akteur_name, quelle, roh)
select h.lead_id, h.hot_lead_id,
       to_timestamp(substring(h.zeile from '^\[(\d{2}\.\d{2}\.\d{4}),? \d{2}:\d{2}\]') || ' ' ||
                    substring(h.zeile from '^\[\d{2}\.\d{2}\.\d{4},? (\d{2}:\d{2})\]'),
                    'DD.MM.YYYY HH24:MI'),
       public.verlauf_art(h.zeile), public.verlauf_titel(h.zeile),
       substring(h.zeile from '\(([^()]{1,60})\)\s*$'),
       'kommentar-migration-hotlead', h.zeile
  from (select hl.id as hot_lead_id, hl.lead_id, btrim(zz) as zeile
          from public.hot_leads hl, lateral unnest(string_to_array(hl.kommentar, E'\n')) as zz
         where coalesce(btrim(hl.kommentar),'') <> '') h
 where h.zeile ~ '^\[\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}\]'
   and not exists (select 1 from public.kontakt_verlauf v
                    where v.lead_id is not distinct from h.lead_id and v.roh = h.zeile);

-- ---------------------------------------------------------------------
-- Ein Strom aus allen Quellen
-- ---------------------------------------------------------------------
create or replace view public.v_kontakt_verlauf as
select v.lead_id, coalesce(v.hot_lead_id, hl.id) as hot_lead_id,
       v.geschehen_am, v.art, v.titel, v.akteur_name, v.quelle, v.roh
  from public.kontakt_verlauf v
  left join public.hot_leads hl on hl.lead_id = v.lead_id
union all
select h.lead_id, e.hot_lead_id, e.erfasst_am,
       case e.art when 'statuswechsel' then 'status'
                  when 'rueckgabe' then 'rueckgabe'
                  when 'setter_freigestellt' then 'zuteilung'
                  else e.art end,
       case when e.art = 'statuswechsel'
              then coalesce(e.von_status, 'offen') || ' → ' || coalesce(e.nach_status, '?')
            else coalesce(e.bemerkung, e.art) end,
       u.vor_nachname, 'ereignisverlauf', null
  from public.hot_lead_ereignisse e
  join public.hot_leads h on h.id = e.hot_lead_id
  left join public.users u on u.id = e.akteur_id
union all
select h.lead_id, a.hot_lead_id, a.erfasst_am, 'anruf',
       coalesce(nullif(btrim(a.ergebnis), ''), 'Anwahl'),
       u.vor_nachname, 'anrufversuche', null
  from public.anrufversuche a
  join public.hot_leads h on h.id = a.hot_lead_id
  left join public.users u on u.id = a.anrufer_id;

-- ---------------------------------------------------------------------
-- Und sie fuehrt sich selbst fort
-- ---------------------------------------------------------------------
-- Neue Eintraege schreibt der Code weiterhin oben in leads.kommentar.
-- Statt alle schreibenden Stellen umzubauen - send-email.js,
-- calendly-webhook.js, follow-up.js, ebook-leads.js und weitere - faengt
-- ein Ausloeser sie ab. Das deckt auch jeden Weg ab, den ich nicht kenne,
-- und genau das ist der Punkt: Ein Verlauf mit Luecken ist schlimmer als
-- keiner, weil man ihm glaubt.
create or replace function public.kontakt_verlauf_mitschreiben()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_erste text;
begin
  if new.kommentar is null or new.kommentar is not distinct from old.kommentar then
    return new;
  end if;
  v_erste := btrim(split_part(new.kommentar, E'\n', 1));
  if v_erste !~ '^\[\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}\]' then
    return new;
  end if;
  if exists (select 1 from public.kontakt_verlauf where lead_id = new.id and roh = v_erste) then
    return new;
  end if;
  insert into public.kontakt_verlauf (lead_id, geschehen_am, art, titel, akteur_name, quelle, roh)
  values (new.id,
    to_timestamp(substring(v_erste from '^\[(\d{2}\.\d{2}\.\d{4}),? \d{2}:\d{2}\]') || ' ' ||
                 substring(v_erste from '^\[\d{2}\.\d{2}\.\d{4},? (\d{2}:\d{2})\]'), 'DD.MM.YYYY HH24:MI'),
    public.verlauf_art(v_erste), public.verlauf_titel(v_erste),
    substring(v_erste from '\(([^()]{1,60})\)\s*$'), 'kommentar', v_erste);
  return new;
end;
$fn$;

drop trigger if exists trg_kontakt_verlauf_leads on public.leads;
create trigger trg_kontakt_verlauf_leads
  after update of kommentar on public.leads
  for each row execute function public.kontakt_verlauf_mitschreiben();
