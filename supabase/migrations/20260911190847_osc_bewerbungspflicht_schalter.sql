-- Eingespielt am 2026-09-11 um 19:08 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Ob auf einer Stufe eine Bewerbung noetig ist, oder ob direkt uebernommen
-- werden darf. Zwei Schalter, weil die Stufen unterschiedlich knapp besetzt
-- sind: Beim Setting kann Tempo wichtiger sein als Auswahl, beim Closing
-- umgekehrt.
--
-- Voreinstellung 'an' auf beiden Stufen - das ist das heutige Verhalten beim
-- Closing. Ein neuer Schalter darf nichts still aendern.
insert into public.einstellungen (schluessel, wert, beschreibung) values
  ('bewerbung_pflicht_setter', 'an',
   'Muessen sich Setter auf ein Beratungsgespraech bewerben (an), oder duerfen sie es direkt uebernehmen (aus)? Bei "aus" wird die Uebernahme trotzdem als genehmigte Bewerbung protokolliert, damit nachvollziehbar bleibt, wer wann uebernommen hat.'),
  ('bewerbung_pflicht_closer', 'an',
   'Muessen sich Closer auf ein Abschlussgespraech bewerben (an), oder duerfen sie es direkt uebernehmen (aus)? Voreinstellung "an" entspricht dem Verhalten vor dem OSC-Umbau.')
on conflict (schluessel) do nothing;

select schluessel, wert from public.einstellungen where schluessel like 'bewerbung_%';
