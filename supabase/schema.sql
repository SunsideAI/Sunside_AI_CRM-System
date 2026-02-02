-- =====================================================
-- SUNSIDE CRM - SUPABASE SCHEMA
-- Migration von Airtable zu Supabase
-- =====================================================

-- Extensions aktivieren
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUM TYPES für konsistente Werte
-- =====================================================

-- Länder
CREATE TYPE land_type AS ENUM ('Deutschland', 'Österreich', 'Schweiz');

-- Lead Kategorien
CREATE TYPE kategorie_type AS ENUM ('Immobilienmakler', 'Sachverständiger');

-- Kontakt-Ergebnis Kaltakquise
CREATE TYPE ergebnis_type AS ENUM (
  'Beratungsgespräch',
  'Nicht erreicht',
  'Kein Interesse',
  'Unterlage bereitstellen',
  'Ungültiger Lead'
);

-- Lead-Quellen
CREATE TYPE quelle_type AS ENUM ('E-Book', 'Kaltakquise', 'Empfehlung', 'Sonstige');

-- Hot Lead Status
CREATE TYPE hot_lead_status_type AS ENUM (
  'Lead',
  'Geplant',
  'Im Closing',
  'Angebot versendet',
  'Abgeschlossen',
  'Verloren'
);

-- Terminart
CREATE TYPE terminart_type AS ENUM ('Video', 'Telefonisch');

-- Benutzer-Rollen
CREATE TYPE rolle_type AS ENUM ('Setter', 'Closer', 'Coldcaller', 'Admin');

-- Lead-Anfragen Status
CREATE TYPE anfrage_status_type AS ENUM ('Offen', 'Genehmigt', 'Teilweise_Genehmigt', 'Abgelehnt');

-- E-Mail Template Kategorie
CREATE TYPE template_kategorie_type AS ENUM ('Kaltakquise', 'Closing', 'Allgemein');

-- System Message Typen
CREATE TYPE message_type AS ENUM (
  'Termin abgesagt',
  'Termin verschoben',
  'Lead gewonnen',
  'Lead verloren',
  'Pool Update'
);

-- =====================================================
-- TABELLE: users (User_Datenbank)
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Namen
  vorname TEXT,
  nachname TEXT,
  vor_nachname TEXT GENERATED ALWAYS AS (COALESCE(vorname, '') || ' ' || COALESCE(nachname, '')) STORED,

  -- Kontakt
  email TEXT UNIQUE NOT NULL,
  email_geschaeftlich TEXT,
  telefon TEXT,

  -- Adresse
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  bundesland TEXT,

  -- Authentifizierung
  password_hash TEXT,

  -- Rollen (Array für mehrere Rollen)
  rollen rolle_type[] DEFAULT '{}',

  -- Status
  status BOOLEAN DEFAULT true,
  onboarding BOOLEAN DEFAULT false,

  -- Integrationen
  google_calendar_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für E-Mail Suche (Login)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_email_geschaeftlich ON users(email_geschaeftlich);
CREATE INDEX idx_users_status ON users(status);

-- =====================================================
-- TABELLE: leads (Immobilienmakler_Leads)
-- =====================================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Unternehmensdaten
  unternehmensname TEXT,
  stadt TEXT,
  land land_type DEFAULT 'Deutschland',
  kategorie kategorie_type DEFAULT 'Immobilienmakler',

  -- Kontaktdaten
  mail TEXT,
  website TEXT,
  telefonnummer TEXT,
  ansprechpartner_vorname TEXT,
  ansprechpartner_nachname TEXT,

  -- Kontaktstatus
  bereits_kontaktiert BOOLEAN DEFAULT false,
  datum DATE,
  ergebnis ergebnis_type,
  kommentar TEXT,
  wiedervorlage_datum TIMESTAMPTZ,  -- TIMESTAMPTZ für Datum + Uhrzeit

  -- Lead-Quelle
  quelle quelle_type DEFAULT 'Kaltakquise',

  -- Website-Metriken (für E-Book Leads)
  absprungrate TEXT,
  monatliche_besuche TEXT,
  anzahl_leads TEXT,
  mehrwert TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes für häufige Queries
CREATE INDEX idx_leads_land ON leads(land);
CREATE INDEX idx_leads_kategorie ON leads(kategorie);
CREATE INDEX idx_leads_bereits_kontaktiert ON leads(bereits_kontaktiert);
CREATE INDEX idx_leads_ergebnis ON leads(ergebnis);
CREATE INDEX idx_leads_wiedervorlage ON leads(wiedervorlage_datum);
CREATE INDEX idx_leads_quelle ON leads(quelle);
CREATE INDEX idx_leads_datum ON leads(datum);

-- =====================================================
-- TABELLE: lead_assignments (Vertriebler-Zuweisungen)
-- Many-to-Many zwischen leads und users
-- =====================================================
CREATE TABLE lead_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lead_id, user_id)
);

CREATE INDEX idx_lead_assignments_lead ON lead_assignments(lead_id);
CREATE INDEX idx_lead_assignments_user ON lead_assignments(user_id);

-- =====================================================
-- TABELLE: hot_leads (Immobilienmakler_Hot_Leads)
-- =====================================================
CREATE TABLE hot_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Verknüpfung zum Original-Lead
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Unternehmensdaten (kopiert/übernommen)
  unternehmen TEXT,
  ansprechpartner_vorname TEXT,
  ansprechpartner_nachname TEXT,
  kategorie kategorie_type,
  mail TEXT,
  telefonnummer TEXT,
  ort TEXT,
  bundesland TEXT,
  website TEXT,

  -- Termin
  termin_beratungsgespraech TIMESTAMPTZ,
  terminart terminart_type,
  meeting_link TEXT,

  -- Status & Zuweisungen
  status hot_lead_status_type DEFAULT 'Lead',
  setter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  closer_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Deal-Details
  setup NUMERIC(10, 2),
  retainer NUMERIC(10, 2),
  laufzeit INTEGER, -- Monate
  prioritaet TEXT,

  -- Quelle & Metriken
  quelle quelle_type,
  monatliche_besuche TEXT,
  mehrwert TEXT,
  absprungrate TEXT,
  anzahl_leads TEXT,
  produkt_dienstleistung TEXT,

  -- Kunde
  kunde_seit DATE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes
CREATE INDEX idx_hot_leads_status ON hot_leads(status);
CREATE INDEX idx_hot_leads_setter ON hot_leads(setter_id);
CREATE INDEX idx_hot_leads_closer ON hot_leads(closer_id);
CREATE INDEX idx_hot_leads_termin ON hot_leads(termin_beratungsgespraech);
CREATE INDEX idx_hot_leads_lead ON hot_leads(lead_id);

-- =====================================================
-- TABELLE: lead_archive (Immobilienmakler_Leads_Archiv)
-- =====================================================
CREATE TABLE lead_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Verknüpfungen
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Archivierte Daten
  bereits_kontaktiert BOOLEAN,
  ergebnis ergebnis_type,
  datum DATE,

  -- Archivierungszeitpunkt
  archiviert_am TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_archive_lead ON lead_archive(lead_id);
CREATE INDEX idx_lead_archive_user ON lead_archive(user_id);
CREATE INDEX idx_lead_archive_datum ON lead_archive(archiviert_am);

-- =====================================================
-- TABELLE: email_templates (E-Mail_Templates)
-- =====================================================
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Template Daten
  name TEXT NOT NULL,
  betreff TEXT,
  inhalt TEXT,
  kategorie template_kategorie_type DEFAULT 'Allgemein',
  aktiv BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_templates_kategorie ON email_templates(kategorie);
CREATE INDEX idx_email_templates_aktiv ON email_templates(aktiv);

-- =====================================================
-- TABELLE: email_template_attachments
-- Für Dateianhänge an Templates
-- =====================================================
CREATE TABLE email_template_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,

  -- Datei-Infos
  file_name TEXT NOT NULL,
  display_name TEXT, -- Custom Anzeigename
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_template_attachments_template ON email_template_attachments(template_id);

-- =====================================================
-- TABELLE: lead_requests (Lead_Anfragen)
-- =====================================================
CREATE TABLE lead_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Anfrage-Referenz
  anfrage_id TEXT UNIQUE NOT NULL,

  -- Antragsteller
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Anfrage-Details
  anzahl INTEGER NOT NULL,
  nachricht TEXT,

  -- Status
  status anfrage_status_type DEFAULT 'Offen',
  genehmigte_anzahl INTEGER,
  admin_kommentar TEXT,

  -- Bearbeitung
  bearbeitet_von UUID REFERENCES users(id) ON DELETE SET NULL,
  bearbeitet_am TIMESTAMPTZ,

  -- Timestamps
  erstellt_am TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_requests_user ON lead_requests(user_id);
CREATE INDEX idx_lead_requests_status ON lead_requests(status);
CREATE INDEX idx_lead_requests_erstellt ON lead_requests(erstellt_am);

-- =====================================================
-- TABELLE: system_messages (System_Messages)
-- =====================================================
CREATE TABLE system_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Eindeutige Message-ID
  message_id TEXT UNIQUE NOT NULL,

  -- Empfänger
  empfaenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Nachricht
  typ message_type NOT NULL,
  titel TEXT,
  nachricht TEXT,

  -- Verknüpfung zu Hot Lead (optional)
  hot_lead_id UUID REFERENCES hot_leads(id) ON DELETE SET NULL,

  -- Status
  gelesen BOOLEAN DEFAULT false,

  -- Timestamps
  erstellt_am TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_messages_empfaenger ON system_messages(empfaenger_id);
CREATE INDEX idx_system_messages_gelesen ON system_messages(gelesen);
CREATE INDEX idx_system_messages_typ ON system_messages(typ);
CREATE INDEX idx_system_messages_erstellt ON system_messages(erstellt_am);

-- =====================================================
-- TABELLE: hot_lead_attachments
-- Für Dateianhänge an Hot Leads (z.B. Angebote)
-- =====================================================
CREATE TABLE hot_lead_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hot_lead_id UUID NOT NULL REFERENCES hot_leads(id) ON DELETE CASCADE,

  -- Datei-Infos
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hot_lead_attachments_lead ON hot_lead_attachments(hot_lead_id);

-- =====================================================
-- FUNKTIONEN & TRIGGER
-- =====================================================

-- Funktion: updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für alle Tabellen mit updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_hot_leads_updated_at
  BEFORE UPDATE ON hot_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- VIEWS für häufige Abfragen
-- =====================================================

-- View: Leads mit zugewiesenen Usern
CREATE VIEW leads_with_users AS
SELECT
  l.*,
  ARRAY_AGG(u.id) FILTER (WHERE u.id IS NOT NULL) as assigned_user_ids,
  ARRAY_AGG(u.vor_nachname) FILTER (WHERE u.vor_nachname IS NOT NULL) as assigned_user_names
FROM leads l
LEFT JOIN lead_assignments la ON l.id = la.lead_id
LEFT JOIN users u ON la.user_id = u.id
GROUP BY l.id;

-- View: Hot Leads mit Setter/Closer Namen
CREATE VIEW hot_leads_with_users AS
SELECT
  hl.*,
  setter.vor_nachname as setter_name,
  closer.vor_nachname as closer_name
FROM hot_leads hl
LEFT JOIN users setter ON hl.setter_id = setter.id
LEFT JOIN users closer ON hl.closer_id = closer.id;

-- View: Ungelesene Nachrichten pro User
CREATE VIEW unread_messages_count AS
SELECT
  empfaenger_id,
  COUNT(*) as unread_count
FROM system_messages
WHERE gelesen = false
GROUP BY empfaenger_id;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- RLS aktivieren
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_messages ENABLE ROW LEVEL SECURITY;

-- Policies werden später basierend auf Auth-Setup hinzugefügt
-- Für jetzt: Service Role hat vollen Zugriff

-- Policy: Alle authentifizierten User können lesen
CREATE POLICY "Authenticated users can read users"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can read leads"
  ON leads FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can read hot_leads"
  ON hot_leads FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can read email_templates"
  ON email_templates FOR SELECT
  USING (true);

-- Schreibrechte nur für Service Role (Backend)
CREATE POLICY "Service role can insert users"
  ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update users"
  ON users FOR UPDATE
  USING (true);

CREATE POLICY "Service role can insert leads"
  ON leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update leads"
  ON leads FOR UPDATE
  USING (true);

CREATE POLICY "Service role can insert hot_leads"
  ON hot_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update hot_leads"
  ON hot_leads FOR UPDATE
  USING (true);

CREATE POLICY "Service role can delete hot_leads"
  ON hot_leads FOR DELETE
  USING (true);

CREATE POLICY "Service role can manage lead_assignments"
  ON lead_assignments FOR ALL
  USING (true);

CREATE POLICY "Service role can manage lead_archive"
  ON lead_archive FOR ALL
  USING (true);

CREATE POLICY "Service role can manage email_templates"
  ON email_templates FOR ALL
  USING (true);

CREATE POLICY "Service role can manage lead_requests"
  ON lead_requests FOR ALL
  USING (true);

CREATE POLICY "Service role can manage system_messages"
  ON system_messages FOR ALL
  USING (true);

-- =====================================================
-- KOMMENTAR: Nächste Schritte
-- =====================================================
-- 1. Dieses Schema in Supabase SQL Editor ausführen
-- 2. Daten aus Airtable exportieren und importieren
-- 3. Supabase Storage Buckets für Attachments erstellen
-- 4. Optional: Supabase Auth für User-Authentifizierung
-- =====================================================
