-- =====================================================================
-- OSC-Umbau: setter_id bedeutet ab hier "wer das Beratungsgespräch hält"
-- =====================================================================
-- NICHT VOR DEM DEPLOY EINSPIELEN.
--
-- Heute steht in setter_id, WER GEBUCHT HAT - in 488 von 545 Fällen
-- derselbe Mensch wie in opener_id. Im neuen Prozess legt der Opener den
-- Termin und ein Setter hält ihn. Rückwirkend war dieser Setter immer der
-- Closer: eine eigene Setter-Rolle gab es nie, der Closer führte beide
-- Gespräche selbst.
--
-- Warum nicht vorher: Der laufende CRM-Stand filtert die Termin-Ansicht über
-- setter_id. Würde man das vor dem Deploy umstellen, verlören alle Opener die
-- von ihnen gelegten Termine aus den Augen - der Code dieses Branches holt
-- sie zusätzlich über opener_id, der alte nicht.
-- =====================================================================

begin;

-- Alten Wert sichern. Er ist zwar in 543 von 560 Fällen auch in opener_id
-- erhalten, aber eben nicht in allen: 15 Datensätze haben einen setter_id
-- ohne opener_id.
alter table public.hot_leads add column if not exists setter_id_alt uuid;
update public.hot_leads set setter_id_alt = setter_id where setter_id_alt is null;

comment on column public.hot_leads.setter_id_alt is
  'setter_id vor dem OSC-Umbau, als das Feld noch "wer gebucht hat" bedeutete. Nur zur Nachvollziehbarkeit.';

-- Rückwirkend: der Closer hat das Beratungsgespräch gehalten.
update public.hot_leads
   set setter_id = closer_id
 where closer_id is not null;

-- Ohne Closer gab es niemanden, der das Gespräch gehalten hat. 29 Fälle,
-- davon 22 noch im Pool. Leer ist hier die ehrliche Antwort - und genau der
-- Zustand, den der 24-Stunden-Alarm aus Ticket 6 aufgreifen soll. Eine
-- Übernahme des alten Werts würde behaupten, ein Opener hätte das Gespräch
-- geführt.
update public.hot_leads
   set setter_id = null
 where closer_id is null;

-- Frueher stand hier: jeder Closer bekommt zusaetzlich die Setter-Rolle,
-- damit setter_id nicht auf jemanden zeigt, der die Setter-Ansicht nicht
-- sehen darf.
--
-- Das ist entfallen. Der Rollenzuschnitt ist inzwischen festgelegt - Setter
-- sind Mark, Marvin und Max - und eine Blanko-Vergabe haette ihn sofort
-- wieder aufgeweicht. Die rueckwirkende setter_id bleibt trotzdem richtig:
-- Der Closer HAT das Beratungsgespraech gefuehrt. Er sieht diese Kontakte
-- weiter ueber closer_id im Closing und im Kalender; die Setting-Ansicht
-- braucht er dafuer nicht, denn dort steht nur, was noch zu tun ist.
--
-- Der Zuschnitt selbst steht in 20260918_osc_rollenzuschnitt.sql und laeuft
-- direkt nach dieser Datei.

-- ---------------------------------------------------------------------
-- Coldcaller wird Opener - EINHEITLICH, ABER ERST NACH DEM DEPLOY
-- ---------------------------------------------------------------------
-- Vorher waere das ein Ausfall fuer 18 aktive Mitarbeiter. Im
-- ausgelieferten Stand steht woertlich:
--   allowedRoles:["Coldcaller","Admin"]        (Zugang zur Kaltakquise)
--   isColdcaller: () => hasRole("Coldcaller")  (Menue und Dashboard)
-- Beides prueft exakt auf den alten Wert, ohne Ausweichpfad. Wer nur noch
-- "Opener" traegt, wird beim Oeffnen der Kaltakquise aufs Dashboard
-- umgeleitet und verliert den Menuepunkt - also seine Tagesarbeit.
--
-- Nach dem Deploy ist die Umbenennung gefahrlos: shared/rollen.js laesst
-- beide Werte als Opener gelten, und users.js erkennt den Akquisepfad
-- ueber istOpener() statt ueber die Zeichenkette.
update public.users
   set rollen = array_replace(rollen, 'Coldcaller'::rolle_type, 'Opener'::rolle_type)
 where 'Coldcaller' = any(rollen::text[])
   and not ('Opener' = any(rollen::text[]));

-- Wer beide Werte traegt, verliert nur den alten.
update public.users
   set rollen = array_remove(rollen, 'Coldcaller'::rolle_type)
 where 'Coldcaller' = any(rollen::text[]);

commit;

-- Gegenprobe nach dem Einspielen:
--   select count(*) filter (where setter_id = closer_id) as setter_ist_closer,
--          count(*) filter (where setter_id is null)     as ohne_setter,
--          count(*) filter (where setter_id_alt is not null) as gesichert
--     from hot_leads;
