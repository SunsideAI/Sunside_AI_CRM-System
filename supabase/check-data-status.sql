-- =====================================================
-- SUNSIDE CRM - DATEN-STATUS PRÜFUNG
-- =====================================================
-- Dieses Skript prüft den aktuellen Stand der Datenbank
-- Ausführen in Supabase SQL Editor oder psql
-- =====================================================

-- 1. ÜBERSICHT: Anzahl Datensätze pro Tabelle
SELECT '=== DATENSATZ-ÜBERSICHT ===' as info;

SELECT
    'users' as tabelle,
    COUNT(*) as gesamt,
    COUNT(*) FILTER (WHERE status = true) as aktiv
FROM users
UNION ALL
SELECT
    'leads',
    COUNT(*),
    COUNT(*) FILTER (WHERE bereits_kontaktiert = true)
FROM leads
UNION ALL
SELECT
    'hot_leads',
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'Abgeschlossen')
FROM hot_leads
UNION ALL
SELECT
    'lead_assignments',
    COUNT(*),
    NULL
FROM lead_assignments
UNION ALL
SELECT
    'email_templates',
    COUNT(*),
    COUNT(*) FILTER (WHERE aktiv = true)
FROM email_templates
UNION ALL
SELECT
    'lead_requests',
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'Offen')
FROM lead_requests
UNION ALL
SELECT
    'system_messages',
    COUNT(*),
    COUNT(*) FILTER (WHERE gelesen = false)
FROM system_messages
UNION ALL
SELECT
    'lead_archive',
    COUNT(*),
    NULL
FROM lead_archive;

-- 2. BENUTZER-ROLLEN Verteilung
SELECT '=== BENUTZER-ROLLEN ===' as info;

SELECT
    unnest(rollen) as rolle,
    COUNT(*) as anzahl
FROM users
WHERE status = true
GROUP BY rolle
ORDER BY anzahl DESC;

-- 3. LEAD-ERGEBNIS Verteilung
SELECT '=== LEAD-ERGEBNISSE ===' as info;

SELECT
    COALESCE(ergebnis::text, 'Kein Ergebnis') as ergebnis,
    COUNT(*) as anzahl,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as prozent
FROM leads
GROUP BY ergebnis
ORDER BY anzahl DESC;

-- 4. HOT LEAD STATUS Verteilung
SELECT '=== HOT LEAD STATUS ===' as info;

SELECT
    status,
    COUNT(*) as anzahl,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as prozent
FROM hot_leads
GROUP BY status
ORDER BY
    CASE status
        WHEN 'Lead' THEN 1
        WHEN 'Geplant' THEN 2
        WHEN 'Im Closing' THEN 3
        WHEN 'Angebot versendet' THEN 4
        WHEN 'Abgeschlossen' THEN 5
        WHEN 'Verloren' THEN 6
    END;

-- 5. LEAD-QUELLEN Verteilung
SELECT '=== LEAD-QUELLEN ===' as info;

SELECT
    COALESCE(quelle::text, 'Nicht angegeben') as quelle,
    COUNT(*) as anzahl
FROM leads
GROUP BY quelle
ORDER BY anzahl DESC;

-- 6. LEADS PRO LAND
SELECT '=== LEADS PRO LAND ===' as info;

SELECT
    land,
    COUNT(*) as gesamt,
    COUNT(*) FILTER (WHERE bereits_kontaktiert = true) as kontaktiert
FROM leads
GROUP BY land
ORDER BY gesamt DESC;

-- 7. REFERENZIELLE INTEGRITÄT
SELECT '=== INTEGRITÄTS-CHECKS ===' as info;

-- Verwaiste Lead Assignments
SELECT
    'Verwaiste Assignments (User fehlt)' as check_name,
    COUNT(*) as anzahl
FROM lead_assignments la
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = la.user_id);

SELECT
    'Verwaiste Assignments (Lead fehlt)' as check_name,
    COUNT(*) as anzahl
FROM lead_assignments la
WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.id = la.lead_id);

-- Hot Leads mit fehlenden Referenzen
SELECT
    'Hot Leads ohne Setter' as check_name,
    COUNT(*) as anzahl
FROM hot_leads
WHERE setter_id IS NULL;

SELECT
    'Hot Leads ohne Closer' as check_name,
    COUNT(*) as anzahl
FROM hot_leads
WHERE closer_id IS NULL;

-- 8. DUPLIKATE PRÜFEN
SELECT '=== DUPLIKAT-CHECKS ===' as info;

-- Doppelte E-Mails in Users
SELECT
    'Doppelte User-E-Mails' as check_name,
    COUNT(*) as anzahl
FROM (
    SELECT email, COUNT(*) as cnt
    FROM users
    WHERE email IS NOT NULL
    GROUP BY email
    HAVING COUNT(*) > 1
) dup;

-- Doppelte E-Mails in Leads
SELECT
    'Doppelte Lead-E-Mails' as check_name,
    COUNT(*) as anzahl
FROM (
    SELECT mail, COUNT(*) as cnt
    FROM leads
    WHERE mail IS NOT NULL AND mail != ''
    GROUP BY mail
    HAVING COUNT(*) > 1
) dup;

-- 9. ZEITLICHE VERTEILUNG
SELECT '=== ZEITLICHE VERTEILUNG ===' as info;

-- Leads pro Monat (letzte 6 Monate)
SELECT
    DATE_TRUNC('month', created_at)::date as monat,
    COUNT(*) as neue_leads
FROM leads
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY monat DESC;

-- Hot Leads pro Monat (letzte 6 Monate)
SELECT
    DATE_TRUNC('month', created_at)::date as monat,
    COUNT(*) as neue_hot_leads
FROM hot_leads
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY monat DESC;

-- 10. AIRTABLE-IDs CHECK (falls vorhanden)
SELECT '=== AIRTABLE-ID STATUS ===' as info;

SELECT
    'Users mit Airtable-ID' as tabelle,
    COUNT(*) FILTER (WHERE airtable_id IS NOT NULL) as mit_id,
    COUNT(*) FILTER (WHERE airtable_id IS NULL) as ohne_id
FROM users
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'airtable_id'
);

-- =====================================================
-- ENDE DER PRÜFUNG
-- =====================================================
SELECT '=== PRÜFUNG ABGESCHLOSSEN ===' as info;
