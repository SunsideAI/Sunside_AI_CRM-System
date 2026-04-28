-- =====================================================
-- MIGRATION: Follow-Up Feature Tables
-- Datum: 2026-04-28
-- Beschreibung: Admin-only Follow-Up Tab für Hot Leads
--               mit Status "Wiedervorlage" und "Verloren"
-- =====================================================

-- 1. Enum erweitern (neue Status-Werte)
ALTER TYPE hot_lead_status_type ADD VALUE IF NOT EXISTS 'Wiedervorlage';
ALTER TYPE hot_lead_status_type ADD VALUE IF NOT EXISTS 'Termin abgesagt';

-- 2. Neue Tabelle: follow_up_actions
-- Speichert alle Aktionen (Mails, Anrufe, Todos, Notizen, Meetings) pro Hot Lead
CREATE TABLE IF NOT EXISTS follow_up_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hot_lead_id UUID NOT NULL REFERENCES hot_leads(id) ON DELETE CASCADE,
  typ TEXT NOT NULL CHECK (typ IN ('mail_gesendet', 'anruf', 'todo', 'notiz', 'closer_meeting')),
  beschreibung TEXT NOT NULL,
  erledigt BOOLEAN DEFAULT FALSE,
  faellig_am DATE,
  erstellt_von UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_follow_up_hot_lead ON follow_up_actions(hot_lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_faellig ON follow_up_actions(faellig_am) WHERE NOT erledigt;
CREATE INDEX IF NOT EXISTS idx_follow_up_typ ON follow_up_actions(typ);

-- 3. Neue Felder auf hot_leads für Follow-Up-Steuerung
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS follow_up_status TEXT
  CHECK (follow_up_status IS NULL OR follow_up_status IN ('aktiv', 'pausiert', 'abgeschlossen'));
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS follow_up_naechster_schritt TEXT;
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS follow_up_datum DATE;

-- Index für Follow-Up-Filterung
CREATE INDEX IF NOT EXISTS idx_hot_leads_follow_up_status ON hot_leads(follow_up_status)
  WHERE follow_up_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hot_leads_follow_up_datum ON hot_leads(follow_up_datum)
  WHERE follow_up_datum IS NOT NULL;

-- 4. RLS Policies (Service Role only - Authorization in Function Handler)
ALTER TABLE follow_up_actions ENABLE ROW LEVEL SECURITY;

-- Policy für Service Role (kann alles)
CREATE POLICY "Service role full access on follow_up_actions"
  ON follow_up_actions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Trigger für updated_at
CREATE OR REPLACE FUNCTION update_follow_up_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_follow_up_actions_updated_at ON follow_up_actions;
CREATE TRIGGER trigger_follow_up_actions_updated_at
  BEFORE UPDATE ON follow_up_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_up_actions_updated_at();
