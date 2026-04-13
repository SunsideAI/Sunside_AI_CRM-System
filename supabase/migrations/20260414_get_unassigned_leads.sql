-- Migration: get_unassigned_leads SQL Function
-- Erstellt am: 2026-04-14
-- Zweck: Skalierbare Lead-Zuweisung für Lead-Anfragen
-- Löst Bug #8: Bei großer Anzahl von lead_assignments werden trotzdem genug freie Leads gefunden

CREATE OR REPLACE FUNCTION get_unassigned_leads(requested_count INT)
RETURNS TABLE(id UUID) AS $$
  SELECT l.id
  FROM leads l
  WHERE NOT EXISTS (SELECT 1 FROM lead_assignments la WHERE la.lead_id = l.id)
    AND (l.bereits_kontaktiert IS NULL OR l.bereits_kontaktiert = false)
    AND (l.ergebnis IS NULL OR l.ergebnis != 'Ungültiger Lead')
  ORDER BY l.created_at ASC
  LIMIT requested_count;
$$ LANGUAGE sql STABLE;

-- Berechtigungen setzen
GRANT EXECUTE ON FUNCTION get_unassigned_leads TO service_role;

COMMENT ON FUNCTION get_unassigned_leads IS 'Findet freie Leads die noch keinem User zugewiesen sind. Skaliert auch bei Millionen von Assignments.';
