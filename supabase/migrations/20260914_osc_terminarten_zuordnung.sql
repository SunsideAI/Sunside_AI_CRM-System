-- =====================================================================
-- Ticket 7: Welche Calendly-Terminart gehoert zu welchem Gespraech
-- =====================================================================
-- Eingespielt am 2026-09-14.
--
-- Ausgangslage, gemessen an der Calendly-Schnittstelle am 14.09.:
--
--   Kostenloses Beratungsgespraech    30 Min  slug neues-meeting            -> phone
--   Unverbindliches Beratungsgespraech 30 Min slug ...-klon                 -> video
--
-- Das sind nicht zwei Zwecke, sondern die Video- und die Telefon-Variante
-- DESSELBEN Beratungsgespraechs. calendar.js leitet 'video' allein daraus
-- ab, dass der Slug 'klon' enthaelt.
--
-- Daraus folgt eine Falle fuer die 45-Minuten-Terminart des
-- Abschlussgespraechs, die noch angelegt wird: TerminPicker.jsx sucht die
-- passende Terminart mit
--
--   eventTypes.find(et => et.type === selectedType)
--
-- also nach 'phone' oder 'video' - nicht nach dem Zweck. Sobald eine dritte
-- Terminart existiert, trifft find() je nach Reihenfolge der Antwort die
-- falsche, ohne Fehlermeldung. Ein Beratungsgespraech koennte in den
-- Abschluss-Kalender gebucht werden.
--
-- Diese Zeile schliesst das: Die Zuordnung sagt, welche Terminart welchem
-- Zweck dient. Der Buchende waehlt weiterhin Video oder Telefon - aber nur
-- noch innerhalb des richtigen Zwecks.
--
-- Rein additiv und leer voreingestellt: Solange nichts zugeordnet ist,
-- verhaelt sich alles wie bisher.
-- =====================================================================

insert into public.einstellungen (schluessel, wert, beschreibung) values
  ('calendly_terminart_zuordnung', '{}',
   'Welche Calendly-Terminart zu welchem Gespraech gehoert, als JSON: {"<event_type-URI>":"beratung"|"abschluss"}. Video- und Telefon-Variante desselben Zwecks bekommen beide denselben Eintrag; die Unterscheidung Video/Telefon trifft der Buchende weiterhin selbst. Leer = keine Einschraenkung, alles verhaelt sich wie vor Ticket 7.')
on conflict (schluessel) do nothing;
