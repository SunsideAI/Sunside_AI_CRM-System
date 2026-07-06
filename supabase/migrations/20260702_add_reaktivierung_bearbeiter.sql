-- Reaktivierungs-Bearbeiter für Hot Leads
--
-- Hintergrund: Bei Reaktivierungs-Kampagnen (verlorene Leads neu kontaktieren)
-- wurde bisher `closer_id` doppelbelegt: als Closing-Attribution UND als
-- operative Arbeitszuweisung. Das verzerrt jede Closer-Statistik, sobald
-- Reaktivierungs-Verantwortliche nicht die eigentlichen Closer sind
-- (siehe Vorfall vom 02.07.2026 mit 269 Leads).
--
-- Trennung ab jetzt:
--   closer_id                   → wer führt/schließt den Deal (Attribution)
--   reaktivierung_bearbeiter_id → wer arbeitet den Lead für Re-Kontakt ab
--
-- Der Reaktivierungs-Bearbeiter sieht die betroffenen Leads im normalen
-- Closing-Tab (kein separater UI-Bereich), zählt aber NICHT in die
-- Closer-Statistik.

ALTER TABLE public.hot_leads
  ADD COLUMN IF NOT EXISTS reaktivierung_bearbeiter_id UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL;

-- Index für die häufigste Query: "welche Leads bearbeitet User X gerade reaktiv?"
CREATE INDEX IF NOT EXISTS hot_leads_reaktivierung_bearbeiter_id_idx
  ON public.hot_leads (reaktivierung_bearbeiter_id)
  WHERE reaktivierung_bearbeiter_id IS NOT NULL;

COMMENT ON COLUMN public.hot_leads.reaktivierung_bearbeiter_id IS
  'User, der diesen Lead für eine Re-Kontakt-/Wiedervorlage-Aktion bearbeitet. Nicht identisch mit closer_id (Attribution).';
