-- Migration: Hot-Lead-Bewerbungen System
-- Ermöglicht Closern, sich auf Hot Leads zu bewerben (Admin-Genehmigung erforderlich)

-- Status-Enum für Bewerbungen
CREATE TYPE hot_lead_application_status_type AS ENUM ('Offen', 'Genehmigt', 'Abgelehnt');

-- Tabelle für Hot-Lead-Bewerbungen
CREATE TABLE hot_lead_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Eindeutige Bewerbungs-ID (Format: HLB-YYYYMMDD-HHMMSS)
  bewerbung_id TEXT UNIQUE NOT NULL,

  -- Referenzen
  hot_lead_id UUID NOT NULL REFERENCES hot_leads(id) ON DELETE CASCADE,
  closer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Bewerbungs-Details
  kommentar TEXT,

  -- Status und Admin-Bearbeitung
  status hot_lead_application_status_type DEFAULT 'Offen',
  admin_kommentar TEXT,
  bearbeitet_von UUID REFERENCES users(id) ON DELETE SET NULL,
  bearbeitet_am TIMESTAMPTZ,

  -- Timestamps
  erstellt_am TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes für Performance
CREATE INDEX idx_hot_lead_applications_hot_lead ON hot_lead_applications(hot_lead_id);
CREATE INDEX idx_hot_lead_applications_closer ON hot_lead_applications(closer_id);
CREATE INDEX idx_hot_lead_applications_status ON hot_lead_applications(status);
CREATE INDEX idx_hot_lead_applications_erstellt ON hot_lead_applications(erstellt_am DESC);

-- Unique Constraint: Ein Closer kann nur eine offene Bewerbung pro Lead haben
CREATE UNIQUE INDEX idx_hot_lead_applications_unique_pending
ON hot_lead_applications(hot_lead_id, closer_id)
WHERE status = 'Offen';

-- Kommentar
COMMENT ON TABLE hot_lead_applications IS 'Bewerbungen von Closern auf Hot Leads aus dem Pool. Admin-Genehmigung erforderlich.';
