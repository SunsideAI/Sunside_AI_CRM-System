-- Eingespielt am 2026-09-11 um 19:02 Uhr.
-- Aus der Datenbank zurueckgeholt, damit Repo und Live-Stand sich decken.

-- Eine offene Bewerbung je Kontakt, Person UND Stufe.
--
-- Bisher war der Index auf (hot_lead_id, closer_id) eindeutig, ohne die Stufe.
-- Mit zwei Poolen haette das bedeutet: Wer sich auf das Beratungsgespraech
-- bewirbt, kann sich nicht mehr auf das Abschlussgespraech desselben Kontakts
-- bewerben - und bekaeme dabei eine Datenbankfehlermeldung statt einer
-- verstaendlichen Antwort. Die Stufe gehoert in den Schluessel.
drop index if exists public.idx_hot_lead_applications_unique_pending;

create unique index idx_hot_lead_applications_unique_pending
  on public.hot_lead_applications (hot_lead_id, closer_id, stufe)
  where status = 'Offen'::hot_lead_application_status_type;

create index if not exists idx_hot_lead_applications_stufe
  on public.hot_lead_applications (stufe, status);
