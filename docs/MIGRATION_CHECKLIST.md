# Sunside CRM - Migrations-Checkliste

**Datum:** 2026-04-13  
**Version:** 1.0

---

## Pre-Migration Checkliste

### 1. Backup erstellen
- [ ] Supabase Dashboard: Settings > Database > Backups
- [ ] Manueller Export der kritischen Tabellen:
  ```bash
  # Via Supabase CLI
  supabase db dump -f backup_$(date +%Y%m%d).sql
  ```

### 2. Aktuelle Daten pruefen
- [ ] Users: `SELECT COUNT(*) FROM users;`
- [ ] Leads: `SELECT COUNT(*) FROM leads;`
- [ ] Hot Leads: `SELECT COUNT(*) FROM hot_leads;`
- [ ] Assignments: `SELECT COUNT(*) FROM lead_assignments;`

### 3. Environment vorbereiten
- [ ] `.env` Datei mit allen Keys vorhanden
- [ ] SUPABASE_URL korrekt
- [ ] SUPABASE_SERVICE_KEY korrekt
- [ ] AIRTABLE_API_KEY (falls Quelle Airtable)
- [ ] AIRTABLE_BASE_ID (falls Quelle Airtable)

---

## Migration durchfuehren

### Option A: Von Airtable

```bash
# Dependencies installieren
npm install

# Migration v2 ausfuehren
node supabase/migrate-data-v2.js
```

### Option B: Von CSV/Excel

1. Daten in das erwartete Format konvertieren
2. Migrationsskript anpassen
3. Testlauf mit kleinem Datenset

### Option C: Von externer Datenbank

1. Export aus Quelldatenbank
2. Transformation in Supabase-Schema
3. Import via Migrationsskript

---

## Post-Migration Validierung

### 1. Datenzaehlung vergleichen
```sql
-- Vor/Nach Vergleich
SELECT 'users' as tabelle, COUNT(*) as anzahl FROM users
UNION ALL SELECT 'leads', COUNT(*) FROM leads
UNION ALL SELECT 'hot_leads', COUNT(*) FROM hot_leads
UNION ALL SELECT 'lead_assignments', COUNT(*) FROM lead_assignments
UNION ALL SELECT 'email_templates', COUNT(*) FROM email_templates;
```

### 2. Referenzielle Integritaet pruefen
```sql
-- Verwaiste Lead Assignments
SELECT COUNT(*) as verwaiste_assignments
FROM lead_assignments la
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = la.user_id)
   OR NOT EXISTS (SELECT 1 FROM leads l WHERE l.id = la.lead_id);

-- Hot Leads ohne Setter/Closer
SELECT COUNT(*) as ohne_zuweisung
FROM hot_leads
WHERE setter_id IS NULL AND closer_id IS NULL;
```

### 3. Frontend testen
- [ ] Login funktioniert
- [ ] Dashboard laedt KPIs
- [ ] Kaltakquise: Leads werden angezeigt
- [ ] Closing: Hot Leads werden angezeigt
- [ ] Termine: Kalender funktioniert
- [ ] E-Mail versenden funktioniert

---

## Rollback Plan

### Bei kritischen Fehlern

1. **Sofort stoppen:**
   ```sql
   -- Alle laufenden Transaktionen abbrechen (Supabase Dashboard)
   ```

2. **Backup wiederherstellen:**
   - Supabase Dashboard > Settings > Backups > Restore

3. **Oder manuell:**
   ```bash
   # Backup einspielen
   supabase db reset
   psql -h [HOST] -U postgres -d postgres < backup_YYYYMMDD.sql
   ```

---

## Migrations-Log

| Datum | Beschreibung | Status | Durchgefuehrt von |
|-------|--------------|--------|-------------------|
| 2026-01-XX | Initiale Airtable zu Supabase Migration | ✅ | - |
| 2026-02-02 | Wiedervorlage Timestamp Fix | ✅ | - |
| YYYY-MM-DD | [Naechste Migration] | ⏳ | - |

---

## Kontakte bei Problemen

- **Technischer Support:** [GitHub Issues](https://github.com/SunsideAI/Sunside_AI_CRM-System/issues)
- **Supabase Docs:** https://supabase.com/docs

---

*Checkliste vor jeder Migration durchgehen!*
