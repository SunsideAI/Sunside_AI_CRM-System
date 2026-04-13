-- =====================================================
-- MIGRATION: Neue Hot_Leads Felder + Schema-Erweiterungen
-- Datum: 2026-04-13
-- =====================================================

-- =====================================================
-- 1. ENUM TYPES erweitern
-- =====================================================

-- Hot Lead Status erweitern (neue Status-Optionen)
ALTER TYPE hot_lead_status_type ADD VALUE IF NOT EXISTS 'Angebot';
ALTER TYPE hot_lead_status_type ADD VALUE IF NOT EXISTS 'Termin abgesagt';
ALTER TYPE hot_lead_status_type ADD VALUE IF NOT EXISTS 'Termin verschoben';

-- Quelle Type erweitern
ALTER TYPE quelle_type ADD VALUE IF NOT EXISTS 'Cold Calling';

-- Ergebnis Type erweitern
ALTER TYPE ergebnis_type ADD VALUE IF NOT EXISTS 'Wiedervorlage';

-- =====================================================
-- 2. AIRTABLE-ID Spalten hinzufuegen (fuer Migration)
-- =====================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS airtable_id TEXT UNIQUE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS airtable_id TEXT UNIQUE;
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS airtable_id TEXT UNIQUE;
ALTER TABLE lead_archive ADD COLUMN IF NOT EXISTS airtable_id TEXT UNIQUE;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS airtable_id TEXT UNIQUE;
ALTER TABLE lead_requests ADD COLUMN IF NOT EXISTS airtable_id TEXT UNIQUE;
ALTER TABLE system_messages ADD COLUMN IF NOT EXISTS airtable_id TEXT UNIQUE;

-- Indizes fuer Airtable-IDs
CREATE INDEX IF NOT EXISTS idx_users_airtable_id ON users(airtable_id);
CREATE INDEX IF NOT EXISTS idx_leads_airtable_id ON leads(airtable_id);
CREATE INDEX IF NOT EXISTS idx_hot_leads_airtable_id ON hot_leads(airtable_id);

-- =====================================================
-- 3. NEUE HOT_LEADS FELDER (Angebot konfigurieren)
-- =====================================================

-- Vertragsbestandteile (fuer alle Produkte)
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS vertragsbestandteile TEXT;

-- Paketname bei "Individuell"
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS paketname_individuell TEXT;

-- Kurzbeschreibung fuer E-Mail
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS kurzbeschreibung TEXT;

-- Leistungsbeschreibung (Langtext)
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS leistungsbeschreibung TEXT;

-- Kommentar als eigenes Feld (nicht mehr Lookup)
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS kommentar TEXT;

-- Attachments als JSONB Array
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- =====================================================
-- 4. PRODUKT_DIENSTLEISTUNG zu Array aendern
-- =====================================================

-- Falls noch TEXT, zu TEXT[] konvertieren
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hot_leads'
    AND column_name = 'produkt_dienstleistung'
    AND data_type = 'text'
  ) THEN
    -- Temporaere Spalte erstellen
    ALTER TABLE hot_leads ADD COLUMN produkt_dienstleistung_new TEXT[];

    -- Daten migrieren (einzelner Wert zu Array)
    UPDATE hot_leads
    SET produkt_dienstleistung_new = CASE
      WHEN produkt_dienstleistung IS NULL OR produkt_dienstleistung = '' THEN NULL
      ELSE ARRAY[produkt_dienstleistung]
    END;

    -- Alte Spalte loeschen und neue umbenennen
    ALTER TABLE hot_leads DROP COLUMN produkt_dienstleistung;
    ALTER TABLE hot_leads RENAME COLUMN produkt_dienstleistung_new TO produkt_dienstleistung;
  END IF;
END $$;

-- =====================================================
-- 5. USER PREFERENCES (fuer Carl Klammer Toggle etc.)
-- =====================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- =====================================================
-- 6. VIEWS aktualisieren (mit neuen Feldern)
-- =====================================================

-- Hot Leads View neu erstellen
DROP VIEW IF EXISTS hot_leads_with_users;

CREATE VIEW hot_leads_with_users AS
SELECT
  hl.*,
  setter.vor_nachname as setter_name,
  closer.vor_nachname as closer_name
FROM hot_leads hl
LEFT JOIN users setter ON hl.setter_id = setter.id
LEFT JOIN users closer ON hl.closer_id = closer.id;

-- =====================================================
-- MIGRATION ABGESCHLOSSEN
-- =====================================================
