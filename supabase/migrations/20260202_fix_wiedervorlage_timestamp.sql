-- =====================================================
-- MIGRATION: Fix wiedervorlage_datum Feld
-- Problem: DATE speichert keine Uhrzeit, Wiedervorlagen zeigen alle 01:00
-- Lösung: Ändere DATE zu TIMESTAMPTZ
-- =====================================================

-- 1. View droppen (hängt von der Spalte ab)
DROP VIEW IF EXISTS leads_with_users;

-- 2. Spaltentyp ändern von DATE zu TIMESTAMPTZ
ALTER TABLE leads
ALTER COLUMN wiedervorlage_datum TYPE TIMESTAMPTZ
USING wiedervorlage_datum::TIMESTAMPTZ;

-- 3. View wieder erstellen
CREATE VIEW leads_with_users AS
SELECT
  l.*,
  ARRAY_AGG(u.id) FILTER (WHERE u.id IS NOT NULL) as assigned_user_ids,
  ARRAY_AGG(u.vor_nachname) FILTER (WHERE u.vor_nachname IS NOT NULL) as assigned_user_names
FROM leads l
LEFT JOIN lead_assignments la ON l.id = la.lead_id
LEFT JOIN users u ON la.user_id = u.id
GROUP BY l.id;

-- 4. Index neu erstellen (optional, aber empfohlen für Performance)
DROP INDEX IF EXISTS idx_leads_wiedervorlage;
CREATE INDEX idx_leads_wiedervorlage ON leads(wiedervorlage_datum);

-- =====================================================
-- HINWEIS: Diese Migration in Supabase SQL Editor ausführen
-- Bestehende DATE-Werte werden zu TIMESTAMPTZ konvertiert (Mitternacht)
-- Neue Wiedervorlagen speichern dann die korrekte Uhrzeit
-- =====================================================
