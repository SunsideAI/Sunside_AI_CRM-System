-- Migration: Add website_setup field to hot_leads table
-- This field stores a separate setup amount for website components
-- Required for Airtable parity (field: Website_Setup / fldtB8Z6Eyw3p8CWs)

ALTER TABLE public.hot_leads
ADD COLUMN IF NOT EXISTS website_setup NUMERIC(10, 2);

-- Add comment for documentation
COMMENT ON COLUMN public.hot_leads.website_setup IS 'Separater Setup-Betrag für Website-Komponente (€)';
