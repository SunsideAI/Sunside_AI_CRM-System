-- Woher ein Ansprechpartner kommt, und wann zuletzt danach gesucht wurde.
--
-- Die Namen werden aus dem Impressum der Firmenwebsite geholt. Dabei
-- entstehen zwei Fragen, die ohne diese Spalten nicht beantwortbar sind:
--
-- 1. Welche Leads waren schon dran? Bei 26.800 Datensaetzen laeuft die Suche
--    ueber mehrere Durchgaenge. Ohne Vermerk nimmt sich jeder Durchgang
--    wieder dieselben Leads vor - auch die, bei denen nichts zu finden war.
-- 2. Woher stammt der Name? Ein Name aus dem Impressum ist etwas anderes als
--    einer, den ein Setter im Gespraech erfahren hat. Steht die Quelle dabei,
--    laesst sich ein Fehlgriff zurueckverfolgen - etwa wenn im Impressum die
--    Agentur stand, die die Seite gebaut hat, und nicht der Makler.

alter table leads
  add column if not exists ansprechpartner_quelle text,
  add column if not exists ansprechpartner_gesucht_am timestamptz;

comment on column leads.ansprechpartner_quelle is
  'URL, aus der Vor- und Nachname stammen. Leer = von Hand oder aus dem Import.';
comment on column leads.ansprechpartner_gesucht_am is
  'Wann zuletzt im Impressum gesucht wurde - auch wenn nichts gefunden wurde.';

-- Der Durchgang holt sich die Leads, bei denen noch nie gesucht wurde. Ohne
-- Index liest er dafuer jedes Mal die ganze Tabelle.
create index if not exists leads_ansprechpartner_offen
  on leads (ansprechpartner_gesucht_am)
  where ansprechpartner_gesucht_am is null;
