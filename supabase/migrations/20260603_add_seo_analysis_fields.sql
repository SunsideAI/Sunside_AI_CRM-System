-- Add SEO Analysis fields to hot_leads table
-- These fields track the status of external SEO analysis tool integration

ALTER TABLE hot_leads
ADD COLUMN IF NOT EXISTS seo_analysis_status TEXT,
ADD COLUMN IF NOT EXISTS seo_analysis_generated_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN hot_leads.seo_analysis_status IS 'Status of SEO analysis: null, Wird erstellt, Fertig, Fehler';
COMMENT ON COLUMN hot_leads.seo_analysis_generated_at IS 'Timestamp when SEO analysis PDF was generated';
