-- Statuswechsel: Altwerte uebersetzen, Kette lockern, Endzustaende schuetzen.
--
-- Zwei Fehler lagen uebereinander.
--
-- 1. status_uebergang_erlaubt() verglich die Statuswerte woertlich und kannte
--    die alten nicht. 'Lead', 'Im Closing', 'Termin verschoben' und 'Verloren'
--    fielen durch bis `else false` - bei 391 Kontakten war damit JEDER
--    Statuswechsel gesperrt, in jede Richtung, fuer jeden. Belegt am
--    08.10.2026:
--      status_uebergang_erlaubt('Lead', 'Beratungsgespraech gefuehrt') -> false
--      status_uebergang_erlaubt('Im Closing', 'Angebot versendet')     -> false
--    Deshalb sind die Altkontakte nie mitgewandert: Es ging nicht.
--
-- 2. Die Kette selbst verhinderte vor allem die Korrektur. Ein Kontakt mit
--    laufendem Angebot liess sich nicht auf "Angebot versendet" setzen, weil
--    der Weg ueber drei Zwischenschritte fuehrte, die nie dokumentiert wurden.
--
-- Was bleibt gesperrt: "Abgeschlossen" und "Gewonnen". An "Abgeschlossen"
-- haengt die Abrechnungs-Bridge (notify_bridge_lead_closed feuert auf genau
-- diesen Wert); ein Wechsel dort wirkt ausserhalb des CRM.
--
-- Verloren ist dagegen kein Grab: Ein verlorener Kontakt kann zurueckkommen.
--
-- Gefuehrt wird weiter ueber die Oberflaeche - STATUS_JE_STUFE bietet je Stufe
-- nur die passenden Status an. Die Datenbank haelt ab hier nur noch fest, was
-- wirklich nicht passieren darf. Gleichlautend zu uebergangErlaubt() in
-- shared/status.js.

begin;

-- Dieselbe Tabelle wie ALTBESTAND in shared/status.js.
create or replace function public.status_normalisieren(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'Lead'              then 'Beratungsgespräch vereinbart'
    when 'Geplant'           then 'Beratungsgespräch vereinbart'
    when 'Termin verschoben' then 'Beratungsgespräch vereinbart'
    when 'Im Closing'        then 'Im Abschluss'
    when 'Abgeschlossen'     then 'Abgeschlossen'   -- bleibt: die Bridge haengt daran
    when 'Verloren'          then 'Verloren, endgültig'
    when 'Wiedervorlage'     then 'Verloren, wiedervorlagefähig'
    else p_status
  end;
$$;

comment on function public.status_normalisieren(text) is
  'Alter Statuswert auf den heutigen. Gegenstueck zu ALTBESTAND in shared/status.js.';

create or replace function public.status_uebergang_erlaubt(p_von text, p_nach text)
returns boolean
language sql
immutable
as $$
  with w as (
    select public.status_normalisieren(p_von) as von,
           public.status_normalisieren(p_nach) as nach
  )
  select case
    when p_von is null or von = nach then true
    -- Endzustaende: Was abgerechnet ist, bleibt liegen.
    when von in ('Abgeschlossen', 'Gewonnen') then false
    else true
  end
  from w;
$$;

comment on function public.status_uebergang_erlaubt(text, text) is
  'Jeder Wechsel ausser aus den Endzustaenden Abgeschlossen und Gewonnen. Die Reihenfolge der Stufen steuert die Oberflaeche (STATUS_JE_STUFE), nicht die Datenbank.';

commit;
