-- Eingespielt am 2026-09-11 um 19:45 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Stuendlich waehrend der Arbeitszeit, nicht taeglich: Die Frist "unbesetzt
-- nach zwei Stunden" liesse sich mit einem Tageslauf nicht einhalten. Die
-- uebrigen Regeln vertragen die haeufigere Pruefung, weil der Merkzettel
-- Wiederholungen verhindert.
--
-- Minute 5, damit der Lauf nicht mit den Operations-Auftraegen kollidiert.
select cron.schedule('crm-fristen', '5 6-20 * * *', $$select public.crm_fristen_pruefen()$$);
