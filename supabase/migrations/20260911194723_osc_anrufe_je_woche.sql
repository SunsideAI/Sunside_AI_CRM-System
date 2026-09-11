-- Eingespielt am 2026-09-11 um 19:47 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Die erste Zahl des Wochen-Benchmarks (600 Anwahlen je Opener).
-- Frueher gab es sie gar nicht - niemand hat Striche gemacht, und eine
-- Schaetzung waere keine Kennzahl gewesen.
create or replace view public.v_anrufe_je_woche as
select
  date_trunc('week', a.erfasst_am at time zone 'Europe/Berlin')::date as woche,
  a.anrufer_id,
  u.vor_nachname as anrufer,
  count(*) as anwahlen,
  count(*) filter (where a.ergebnis is not null and a.ergebnis <> '') as mit_ergebnis,
  count(distinct a.lead_id) as verschiedene_leads
from public.anrufversuche a
left join public.users u on u.id = a.anrufer_id
group by 1, 2, 3;

comment on view public.v_anrufe_je_woche is
  'Anwahlen je Opener und Woche. Grundlage des Wochen-Benchmarks. Wird aus anrufversuche gespeist, das die Lead-Function automatisch fuellt.';
