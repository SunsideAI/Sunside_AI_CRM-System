-- =====================================================
-- SUNSIDE CRM - Add airtable_id columns for migration reference
-- Run this BEFORE running migrate-data-v2.js
-- =====================================================

-- Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS airtable_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_airtable_id ON users(airtable_id);

-- Leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS airtable_id TEXT;
CREATE INDEX IF NOT EXISTS idx_leads_airtable_id ON leads(airtable_id);

-- Hot Leads
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS airtable_id TEXT;
ALTER TABLE hot_leads ADD COLUMN IF NOT EXISTS kommentar TEXT;
CREATE INDEX IF NOT EXISTS idx_hot_leads_airtable_id ON hot_leads(airtable_id);

-- Lead Archive
ALTER TABLE lead_archive ADD COLUMN IF NOT EXISTS airtable_id TEXT;
CREATE INDEX IF NOT EXISTS idx_lead_archive_airtable_id ON lead_archive(airtable_id);

-- Verify: vor_nachname as stored column
-- Note: In schema.sql vor_nachname is generated. For migration we need it writable.
-- If migration fails on vor_nachname, run this:
-- ALTER TABLE users DROP COLUMN vor_nachname;
-- ALTER TABLE users ADD COLUMN vor_nachname TEXT;

-- Confirm columns added
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'airtable_id'
ORDER BY table_name;
