-- =====================================================================
-- Tickets 9 und 12: der Nachfass-Serien-Motor
-- =====================================================================
-- NICHT EINGESPIELT. Erst nach dem Veroeffentlichen des Umbaus.
--
-- Grund: Der taegliche Lauf schreibt Systemnachrichten an Closer. Liefe er
-- vor dem Deploy, bekaemen Menschen im laufenden Betrieb Hinweise auf einen
-- Ablauf, den ihre Oberflaeche noch nicht kennt. Die Tabellen und Funktionen
-- sind additiv und harmlos; der cron-Auftrag ist es nicht.
--
-- Was der Motor tut - und was ausdruecklich nicht:
--   Er rechnet aus, welche Nachricht heute ansteht, und legt sie dem
--   Zustaendigen vor. Er verschickt nichts. F23: "Kein Automatikversand:
--   Das System schlaegt vor, ein Mensch schickt ab."
--
-- Der Zeitplan steht in shared/mailstrecken.js und stammt aus Miro F25.1:
--   Strecke A (zufrieden mit dem Ist)     Tag 0 / 4 / 10 / 21 / 35
--   Strecke B (will, traut sich nicht)    Tag 0 / 3 /  7 / 14 / 28
-- Bei Strecke B widersprachen sich Vertriebshandbuch (Tag 21) und Miro
-- (Tag 28). Entschieden am 12.09.2026: Miro gilt.
-- =====================================================================

-- Wann die Strecke begonnen hat. Ohne dieses Datum haengt der Zeitplan an
-- termin_abschlussgespraech - was falsch ist, sobald jemand die Strecke
-- spaeter waehlt als das Gespraech war.
alter table public.hot_leads
  add column if not exists nachfass_beginn_am date;

comment on column public.hot_leads.nachfass_beginn_am is
  'Tag 0 der Nachfass-Strecke. Wird gesetzt, wenn nachfass_grund gewaehlt wird.';

-- Der Zeitplan als Tabelle, damit die Datenbank ohne den Anwendungscode
-- rechnen kann. Deckungsgleich mit shared/mailstrecken.js.
create table if not exists public.nachfass_zeitplan (
  strecke text    not null,
  schritt smallint not null,
  tag     smallint not null,
  bezeichnung text not null,
  primary key (strecke, schritt)
);

insert into public.nachfass_zeitplan (strecke, schritt, tag, bezeichnung) values
  ('A', 1,  0, 'Die Zusammenfassung seiner Zahlen'),
  ('A', 2,  4, 'Das Fallbeispiel'),
  ('A', 3, 10, 'Anruf und Mail zusammen'),
  ('A', 4, 21, 'Etwas, das nuetzt'),
  ('A', 5, 35, 'Der Abschied'),
  ('B', 1,  0, 'Der offene Punkt aus dem Gespraech'),
  ('B', 2,  3, 'Das eine Beweisstueck'),
  ('B', 3,  7, 'Anruf und Mail zusammen'),
  ('B', 4, 14, 'Der Lead-Magnet in seinen Farben'),
  ('B', 5, 28, 'Der Abschied')
on conflict (strecke, schritt) do update
  set tag = excluded.tag, bezeichnung = excluded.bezeichnung;

alter table public.nachfass_zeitplan enable row level security;
drop policy if exists "service role manages nachfass_zeitplan" on public.nachfass_zeitplan;
create policy "service role manages nachfass_zeitplan" on public.nachfass_zeitplan for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- Welche Strecke gehoert zu welchem Grund
-- ---------------------------------------------------------------------
create or replace function public.nachfass_strecke(p_grund text)
returns text language sql immutable as $$
  select case p_grund
    when 'Kunde ist zufrieden mit dem Ist-Zustand' then 'A'
    when 'Kunde will, traut sich noch nicht'       then 'B'
    else null
  end;
$$;

-- ---------------------------------------------------------------------
-- Erinnerung an EINE Person
-- ---------------------------------------------------------------------
-- crm_erinnern() schreibt an alle aktiven Admins. Fuer Fristen ist das
-- richtig, fuers Nachfassen nicht: Der Schritt gehoert dem Closer, nicht der
-- Leitung. Gleiche Merkzettel-Logik, ein Empfaenger.
create or replace function public.crm_erinnern_person(
  p_schluessel text, p_art text, p_hot_lead uuid, p_person uuid,
  p_typ text, p_titel text, p_nachricht text
) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if p_person is null then
    return 0;
  end if;

  insert into public.crm_erinnerungen (schluessel, hot_lead_id, art)
  values (p_schluessel, p_hot_lead, p_art)
  on conflict (schluessel) do nothing;

  if not found then
    return 0;
  end if;

  -- Ein ausgeschiedener Mitarbeiter bekommt nichts mehr.
  insert into public.system_messages (message_id, empfaenger_id, titel, nachricht, typ, hot_lead_id, gelesen)
  select 'CRM-' || substr(md5(p_schluessel), 1, 12) || '-' || substr(u.id::text, 1, 8),
         u.id, p_titel, p_nachricht, p_typ, p_hot_lead, false
    from public.users u
   where u.id = p_person and u.status = true;

  return case when found then 1 else 0 end;
end;
$$;

-- ---------------------------------------------------------------------
-- Der taegliche Lauf
-- ---------------------------------------------------------------------
create or replace function public.crm_nachfassen_vorlegen()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_faellig integer := 0;
  v_zeile   record;
begin
  for v_zeile in
    select h.id, h.unternehmen, h.closer_id, z.schritt, z.tag, z.bezeichnung,
           (h.nachfass_beginn_am + z.tag) as faellig_am
      from public.hot_leads h
      join public.nachfass_zeitplan z
        on z.strecke = public.nachfass_strecke(h.nachfass_grund)
       and z.schritt = coalesce(h.nachfass_schritt, 0) + 1
     where h.nachfass_beginn_am is not null
       and h.closer_id is not null
       -- Wer gewonnen oder endgueltig verloren ist, wird nicht nachgefasst.
       and h.status not in ('Gewonnen', 'Verloren, endgültig')
       and (h.nachfass_beginn_am + z.tag) <= current_date
  loop
    -- crm_erinnern() haelt die Wiederholung ab: derselbe Schluessel geht nur
    -- einmal raus. Deshalb steht der Schritt im Schluessel.
    -- 'Pool Update' ist der Typ, den die Oberflaeche kennt. Ein frei
    -- erfundener Wert wuerde ohne Symbol und ohne Farbe dargestellt.
    if public.crm_erinnern_person(
         'nachfass-' || v_zeile.id::text || '-' || v_zeile.schritt::text,
         'nachfass', v_zeile.id, v_zeile.closer_id, 'Pool Update',
         'Nachfassen: ' || v_zeile.bezeichnung,
         coalesce(v_zeile.unternehmen, 'Ein Kontakt') || ' - Schritt '
           || v_zeile.schritt || ' von 5 ist seit dem '
           || to_char(v_zeile.faellig_am, 'DD.MM.') || ' faellig.'
       ) > 0 then
      v_faellig := v_faellig + 1;
    end if;
  end loop;

  return jsonb_build_object('faellige_nachfass_schritte', v_faellig);
end;
$$;

comment on function public.crm_nachfassen_vorlegen() is
  'Legt faellige Nachfass-Schritte vor. Verschickt nichts - das tut ein Mensch.';

-- Der cron-Auftrag steht bewusst NICHT hier. Er kommt mit dem Deploy:
--   select cron.schedule('crm-nachfassen', '0 7 * * *',
--                        $$select public.crm_nachfassen_vorlegen();$$);
