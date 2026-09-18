-- =====================================================================
-- OSC-Umbau: der festgelegte Rollenzuschnitt
-- =====================================================================
-- NICHT VOR DEM DEPLOY EINSPIELEN. Reihenfolge im Go-live-Fenster:
--   1. Huuswert auf 'Gewonnen' setzen (kleingeschriebenes 'abgeschlossen')
--   2. main veroeffentlichen
--   3. 20260913_osc_statuskette.sql
--   4. 20260913_osc_setter_rueckwirkend.sql
--   5. DIESE DATEI
--
-- Festgelegt:
--   Setter: Mark Bremermann, Marvin Schuetze, Max Lehmann
--   Closer: Niklas Schwerin, Carl-Richard Rachow, Nikolas Kryut, Paul Probodziak
--   Alle uebrigen Vertriebler: Opener
--
-- Die Setter-Rolle ist am 18.09.2026 schon vergeben worden - additiv und
-- deshalb ohne Wirkung auf den laufenden Stand, in dem es keine
-- Setting-Ansicht gibt. Hier steht, was Wirkung HAT: das Wegnehmen der
-- Closer-Rolle. Wer sie verliert, verliert damit den Zugang zu seinen
-- laufenden Deals - darum werden die vorher uebergeben.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Laufende Deals der ausscheidenden Closer uebergeben
-- ---------------------------------------------------------------------
-- Betroffen sind am 18.09.2026: Maximilian Gaik (22 im Abschluss, 2 mit
-- Angebot), Anton Brand (6 + 1) und Mark Bremermann (1). Sie werden
-- gleichmaessig auf die vier Closer verteilt - nach Vornamen sortiert,
-- damit das Ergebnis nachvollziehbar und nicht zufaellig ist.
--
-- Bewusst KEINE Rueckgabe in den Pool: Ein Deal im Abschluss oder mit
-- offenem Angebot braucht einen Menschen, nicht eine Warteschlange.

create temporary table uebergabe as
with abgebende as (
  select id from public.users
   where vor_nachname in ('Maximilian Gaik', 'Anton Brand', 'David Beier', 'Max Lehmann', 'Mark Bremermann')
),
neue_closer as (
  select id, row_number() over (order by vor_nachname) - 1 as platz, count(*) over () as anzahl
    from public.users
   where vor_nachname in ('Niklas Schwerin', 'Carl-Richard Rachow', 'Nikolas Kryut', 'Paul Probodziak')
),
laufend as (
  select h.id, h.closer_id, h.unternehmen,
         row_number() over (order by h.termin_abschlussgespraech nulls last, h.unternehmen) - 1 as reihe
    from public.hot_leads h
   where h.closer_id in (select id from abgebende)
     and h.status in ('Im Abschluss', 'Abschlussgespräch vereinbart', 'Angebot', 'Angebot versendet', 'Wird nachgefasst')
)
select l.id as hot_lead_id, l.closer_id as alter_closer, n.id as neuer_closer, l.unternehmen
  from laufend l
  join neue_closer n on n.platz = l.reihe % n.anzahl;

update public.hot_leads h
   set closer_id = u.neuer_closer,
       zuletzt_geaendert_durch = 'Rollenzuschnitt OSC'
  from uebergabe u
 where h.id = u.hot_lead_id;

-- Im Verlauf mitschreiben, sonst steht der Wechsel nirgends.
insert into public.hot_lead_ereignisse (hot_lead_id, art, akteur_id, bemerkung)
select u.hot_lead_id, 'closer_wechsel', u.neuer_closer,
       'Uebergabe beim Rollenzuschnitt: von ' ||
       coalesce((select vor_nachname from public.users where id = u.alter_closer), 'unbekannt') ||
       ' an ' || coalesce((select vor_nachname from public.users where id = u.neuer_closer), 'unbekannt')
  from uebergabe u;

-- ---------------------------------------------------------------------
-- 2. Alles, was nicht mehr im Closing liegt, vom alten Closer loesen
-- ---------------------------------------------------------------------
-- 89 Datensaetze mit 'Beratungsgespräch vereinbart', 'Nicht erschienen'
-- oder 'Termin abgesagt' trugen noch einen Closer, obwohl sie nach dem
-- Umbau beim Setter oder Opener liegen. Bleibt der Closer drin, taucht der
-- Kontakt in einem Closing auf, das es fuer diese Person nicht mehr gibt.
update public.hot_leads
   set closer_id = null
 where closer_id in (
   select id from public.users
    where vor_nachname in ('Maximilian Gaik', 'Anton Brand', 'David Beier', 'Max Lehmann', 'Mark Bremermann')
 )
   and status in ('Beratungsgespräch vereinbart', 'Nicht erschienen', 'Termin abgesagt');

-- ---------------------------------------------------------------------
-- 3. Rollen setzen
-- ---------------------------------------------------------------------
-- Setter: die drei Festgelegten (steht schon, hier nur zur Sicherheit).
update public.users
   set rollen = array_append(rollen, 'Setter')
 where vor_nachname in ('Mark Bremermann', 'Marvin Schütze', 'Max Lehmann')
   and not ('Setter' = any(rollen));

-- Closer: nur die vier Festgelegten. Allen anderen wird die Rolle
-- entzogen - auch den inaktiven Konten, damit die Liste die Wahrheit sagt.
update public.users
   set rollen = array_remove(rollen, 'Closer')
 where 'Closer' = any(rollen)
   and vor_nachname not in ('Niklas Schwerin', 'Carl-Richard Rachow', 'Nikolas Kryut', 'Paul Probodziak');

-- Wer nach dem Zuschnitt keine Vertriebsrolle mehr traegt, bleibt Opener:
-- ohne Rolle kaeme er bis aufs Dashboard und nicht weiter.
update public.users
   set rollen = array_append(rollen, 'Opener')
 where status is true
   and not ('Opener' = any(rollen))
   and not ('Setter' = any(rollen))
   and not ('Closer' = any(rollen))
   and not ('Admin' = any(rollen))
   and not ('Geschäftsführer' = any(rollen));

commit;

-- Gegenprobe nach dem Einspielen:
--
--   select vor_nachname, rollen from users
--    where 'Closer' = any(rollen) or 'Setter' = any(rollen) order by 2, 1;
--   -- erwartet: 4 Closer, 3 Setter (Mark, Marvin, Max), sonst nichts
--
--   select count(*) from hot_leads
--    where closer_id is null and status in ('Im Abschluss','Angebot','Angebot versendet','Wird nachgefasst');
--   -- erwartet: 0 - kein laufender Deal ohne Closer
--
--   select u.vor_nachname, count(*) from hot_leads h join users u on u.id=h.closer_id
--    where h.status in ('Im Abschluss','Angebot','Angebot versendet','Wird nachgefasst')
--    group by 1 order by 2 desc;
--   -- erwartet: nur die vier Closer, ungefaehr gleich verteilt
