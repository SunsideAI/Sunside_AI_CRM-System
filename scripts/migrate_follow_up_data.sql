-- =====================================================
-- DATA MIGRATION: Initial Follow-Up Setup for ~99 Leads
-- Datum: 2026-04-28
--
-- ACHTUNG: Dieses Script NICHT automatisch ausführen!
-- Manuell nach Feature-Deployment in Supabase SQL Editor ausführen.
--
-- Voraussetzungen:
-- 1. Migration 20260428_add_follow_up_tables.sql muss bereits ausgeführt sein
-- 2. Die Lead-IDs aus dem Google Sheet müssen in die WHERE-Klausel eingefügt werden
-- =====================================================

-- Transaktion starten für atomare Ausführung
BEGIN;

-- =====================================================
-- SCHRITT 1: Status der betroffenen Hot Leads ändern
-- =====================================================
-- Die Lead-IDs müssen manuell aus dem Google Sheet übertragen werden
-- Ersetze die Platzhalter-IDs durch die echten UUIDs

UPDATE hot_leads
SET
  status = 'Wiedervorlage',
  follow_up_status = 'aktiv'
WHERE id IN (
  -- HIER DIE LEAD-IDs AUS DEM GOOGLE SHEET EINFÜGEN
  -- Beispiel:
  -- '550e8400-e29b-41d4-a716-446655440000',
  -- '550e8400-e29b-41d4-a716-446655440001',
  -- '550e8400-e29b-41d4-a716-446655440002'
  -- ...
  'PLACEHOLDER_ID'  -- Diese Zeile löschen und durch echte IDs ersetzen
);

-- Prüfen wie viele Leads aktualisiert wurden
-- SELECT COUNT(*) as updated_leads FROM hot_leads WHERE follow_up_status = 'aktiv';

-- =====================================================
-- SCHRITT 2: Standard-Actions für alle Follow-Up Leads
-- =====================================================

-- Action 1: Erste Follow-Up-Mail (bereits erledigt)
INSERT INTO follow_up_actions (hot_lead_id, typ, beschreibung, erledigt, created_at)
SELECT
  id,
  'mail_gesendet',
  'Erste Follow-Up-Mail versendet - Fallstudie Klose & Partner',
  true,
  '2026-04-13 10:00:00+02'::timestamptz
FROM hot_leads
WHERE follow_up_status = 'aktiv'
  AND NOT EXISTS (
    SELECT 1 FROM follow_up_actions fa
    WHERE fa.hot_lead_id = hot_leads.id
    AND fa.typ = 'mail_gesendet'
    AND fa.beschreibung LIKE '%Klose & Partner%'
  );

-- Action 2: Todo für zweite Mail (noch offen)
INSERT INTO follow_up_actions (hot_lead_id, typ, beschreibung, erledigt, faellig_am)
SELECT
  id,
  'todo',
  'Zweite Mail Referenzschreiben FALC oder Wüstenrot',
  false,
  '2026-04-27'::date
FROM hot_leads
WHERE follow_up_status = 'aktiv'
  AND NOT EXISTS (
    SELECT 1 FROM follow_up_actions fa
    WHERE fa.hot_lead_id = hot_leads.id
    AND fa.typ = 'todo'
    AND fa.beschreibung LIKE '%Referenzschreiben%'
  );

-- =====================================================
-- SCHRITT 3: Lead-spezifische Notizen (aus Sheet Spalte N)
-- =====================================================
-- Diese müssen manuell pro Lead eingefügt werden
-- Beispiel:

-- INSERT INTO follow_up_actions (hot_lead_id, typ, beschreibung, erledigt)
-- VALUES
--   ('lead-uuid-1', 'notiz', 'Notiz aus Sheet Spalte N für Lead 1', true),
--   ('lead-uuid-2', 'notiz', 'Notiz aus Sheet Spalte N für Lead 2', true),
--   ('lead-uuid-3', 'notiz', 'Notiz aus Sheet Spalte N für Lead 3', true);

-- =====================================================
-- SCHRITT 4: Verifizierung
-- =====================================================

-- Anzahl der migrierten Leads
SELECT
  'Follow-Up Leads' as metric,
  COUNT(*) as count
FROM hot_leads
WHERE follow_up_status = 'aktiv';

-- Anzahl der erstellten Actions
SELECT
  'Follow-Up Actions' as metric,
  COUNT(*) as count
FROM follow_up_actions;

-- Actions pro Typ
SELECT
  typ,
  COUNT(*) as count,
  SUM(CASE WHEN erledigt THEN 1 ELSE 0 END) as erledigt,
  SUM(CASE WHEN NOT erledigt THEN 1 ELSE 0 END) as offen
FROM follow_up_actions
GROUP BY typ;

-- Commit nur wenn alles korrekt aussieht
-- Wenn etwas falsch ist: ROLLBACK; ausführen statt COMMIT;
COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (bei Fehlern)
-- =====================================================
-- Wenn etwas schiefgeht, diese Befehle ausführen:
--
-- DELETE FROM follow_up_actions;
-- UPDATE hot_leads SET
--   status = 'Verloren',  -- oder vorheriger Status
--   follow_up_status = NULL,
--   follow_up_naechster_schritt = NULL,
--   follow_up_datum = NULL
-- WHERE follow_up_status = 'aktiv';
