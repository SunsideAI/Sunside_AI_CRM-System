-- =====================================================
-- MIGRATION: Fix wiedervorlage_datum Feld
-- Problem: DATE speichert keine Uhrzeit, Wiedervorlagen zeigen alle 01:00
-- Lösung: Ändere DATE zu TIMESTAMPTZ
-- =====================================================

-- 1. Spaltentyp ändern von DATE zu TIMESTAMPTZ
ALTER TABLE leads
ALTER COLUMN wiedervorlage_datum TYPE TIMESTAMPTZ
USING wiedervorlage_datum::TIMESTAMPTZ;

-- 2. Index neu erstellen (optional, aber empfohlen für Performance)
DROP INDEX IF EXISTS idx_leads_wiedervorlage;
CREATE INDEX idx_leads_wiedervorlage ON leads(wiedervorlage_datum);

-- =====================================================
-- HINWEIS: Diese Migration in Supabase SQL Editor ausführen
-- Bestehende DATE-Werte werden zu TIMESTAMPTZ konvertiert (Mitternacht)
-- Neue Wiedervorlagen speichern dann die korrekte Uhrzeit
-- =====================================================
