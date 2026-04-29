-- =====================================================
-- MIGRATION: Kanban Status für Follow-Up Actions
-- Datum: 2026-04-29
-- Beschreibung: Neues Feld für Kanban-Board Spalten
-- =====================================================

-- 1. Kanban-Status Feld hinzufügen
ALTER TABLE follow_up_actions
ADD COLUMN IF NOT EXISTS kanban_status TEXT
DEFAULT 'offen'
CHECK (kanban_status IN ('offen', 'in_bearbeitung', 'erledigt'));

-- 2. Index für Kanban-Filterung
CREATE INDEX IF NOT EXISTS idx_follow_up_kanban_status
ON follow_up_actions(kanban_status);

-- 3. Bestehende erledigte Actions migrieren
UPDATE follow_up_actions
SET kanban_status = 'erledigt'
WHERE erledigt = true AND kanban_status = 'offen';
