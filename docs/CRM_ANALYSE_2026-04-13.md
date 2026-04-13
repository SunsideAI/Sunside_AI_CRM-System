# Sunside CRM - Systemanalyse

**Datum:** 2026-04-13  
**Analysiert von:** Claude Code  
**Branch:** claude/analyze-repo-fKMVI

---

## 1. Zusammenfassung

Das Sunside CRM ist ein vollständiges Lead-Management und Sales-Tracking System für das Vertriebsteam von Sunside AI. Die Migration von **Airtable zu Supabase** wurde im Januar 2026 abgeschlossen.

### Aktueller Status
- **Datenbank:** Supabase (PostgreSQL) - AKTIV
- **Airtable:** Legacy-Utilities noch vorhanden, aber nicht mehr primär genutzt
- **Letzte Änderungen:** 2026-02-02 (Bugfixes)

---

## 2. Tech Stack

| Komponente | Technologie | Status |
|------------|-------------|--------|
| Frontend | React 18 + Vite + Tailwind CSS | Aktiv |
| Backend | Netlify Functions (Serverless) | Aktiv |
| Datenbank | Supabase (PostgreSQL) | Aktiv |
| E-Mail | Resend API | Aktiv |
| Kalender | Calendly API | Aktiv |
| Datei-Upload | Cloudinary | Aktiv |
| Auth | bcrypt (Passwort-Hashing) | Aktiv |
| Legacy | Airtable | Deaktiviert |

---

## 3. Datenbank-Schema (Supabase)

### Haupttabellen

| Tabelle | Beschreibung | Datensätze (geschätzt) |
|---------|--------------|------------------------|
| `users` | Mitarbeiter/Benutzer | 10-50 |
| `leads` | Kaltakquise-Leads | 1000+ |
| `lead_assignments` | Lead ↔ User Zuweisungen | 1000+ |
| `hot_leads` | Qualifizierte Leads mit Terminen | 50-200 |
| `lead_archive` | Archivierte Lead-Daten | Variabel |
| `email_templates` | E-Mail Vorlagen | 10-30 |
| `lead_requests` | Lead-Anfragen | Variabel |
| `system_messages` | In-App Benachrichtigungen | Variabel |

### ENUM Types

```sql
-- Länder
land_type: Deutschland, Österreich, Schweiz

-- Lead Kategorien
kategorie_type: Immobilienmakler, Sachverständiger

-- Kontakt-Ergebnis
ergebnis_type: Beratungsgespräch, Nicht erreicht, Kein Interesse, 
               Unterlage bereitstellen, Ungültiger Lead

-- Lead-Quellen
quelle_type: E-Book, Kaltakquise, Empfehlung, Sonstige

-- Hot Lead Status
hot_lead_status_type: Lead, Geplant, Im Closing, Angebot versendet, 
                      Abgeschlossen, Verloren

-- Benutzer-Rollen
rolle_type: Setter, Closer, Coldcaller, Admin
```

### Views (für optimierte Abfragen)

- `leads_with_users` - Leads mit zugewiesenen Benutzern
- `hot_leads_with_users` - Hot Leads mit Setter/Closer Namen
- `unread_messages_count` - Ungelesene Nachrichten pro User

---

## 4. Migrationsstatus

### Abgeschlossene Migrationen

| Datum | Migration | Status |
|-------|-----------|--------|
| 2026-01 | Airtable → Supabase (Hauptmigration) | ✅ Abgeschlossen |
| 2026-01 | E-Book Pool Integration | ✅ Abgeschlossen |
| 2026-01 | Lead-Anfragen System | ✅ Abgeschlossen |
| 2026-01 | Calendly Webhook Integration | ✅ Abgeschlossen |
| 2026-02-02 | Wiedervorlage Timestamp Fix | ✅ Abgeschlossen |

### Migrationsskripte

1. **`supabase/migrate-data.js`** (v1)
   - Erste Version der Migration
   - Basis-Funktionalität
   - Problem: Index-basierte ID-Zuordnung

2. **`supabase/migrate-data-v2.js`** (v2)
   - Verbesserte Version
   - Speichert Airtable-IDs für spätere Referenz
   - Bessere Fehlerbehandlung
   - Detailliertes Logging
   - Einzelner Record-Insert mit Retry-Logik

### SQL Migrations

```
supabase/migrations/
├── 20260202_fix_wiedervorlage_times.sql
└── 20260202_fix_wiedervorlage_timestamp.sql
```

---

## 5. API Endpoints (Netlify Functions)

### Authentifizierung
- `POST /auth` - Login
- `POST /forgot-password` - Passwort-Reset
- `POST /change-password` - Passwort ändern
- `POST /set-password` - Admin: Passwort setzen

### Leads
- `GET/PATCH /leads` - Lead CRUD
- `GET/POST/PATCH /ebook-leads` - E-Book Leads
- `GET/POST /lead-requests` - Lead-Anfragen

### Hot Leads
- `GET/POST/PATCH /hot-leads` - Hot Lead CRUD
- `POST /archive-leads` - Archivierung

### Termine & E-Mail
- `GET/POST /calendar` - Calendly Integration
- `POST /calendly-webhook` - Webhooks
- `POST /send-email` - E-Mail Versand
- `GET/POST/PATCH/DELETE /email-templates` - Templates

### Admin & Analytics
- `GET /users` - User-Liste
- `GET /dashboard` - KPIs
- `GET /analytics` - Statistiken

---

## 6. Airtable Legacy-Code

### Noch vorhandene Airtable-Dateien

| Datei | Verwendung | Aktion empfohlen |
|-------|------------|------------------|
| `netlify/functions/utils/airtable.js` | Rate-Limit-Handler | Kann entfernt werden |
| `supabase/migrate-data.js` | Migration v1 | Archivieren |
| `supabase/migrate-data-v2.js` | Migration v2 | Archivieren |

### Environment Variables (Airtable)

```env
AIRTABLE_API_KEY=pat_xxxxxxxxx  # Nicht mehr benötigt
AIRTABLE_BASE_ID=appxxxxxxxxx  # Nicht mehr benötigt
```

---

## 7. Empfehlungen für neue Migration

### Vor der Migration prüfen

1. **Datenintegrität in Supabase:**
   ```sql
   -- Anzahl der Datensätze prüfen
   SELECT 'users' as table, COUNT(*) as count FROM users
   UNION ALL
   SELECT 'leads', COUNT(*) FROM leads
   UNION ALL
   SELECT 'hot_leads', COUNT(*) FROM hot_leads
   UNION ALL
   SELECT 'lead_assignments', COUNT(*) FROM lead_assignments;
   ```

2. **Verwaiste Referenzen prüfen:**
   ```sql
   -- Leads ohne gültige User-Zuweisungen
   SELECT la.lead_id 
   FROM lead_assignments la
   LEFT JOIN users u ON la.user_id = u.id
   WHERE u.id IS NULL;
   
   -- Hot Leads ohne gültigen Original-Lead
   SELECT id, unternehmen 
   FROM hot_leads 
   WHERE lead_id IS NOT NULL 
   AND lead_id NOT IN (SELECT id FROM leads);
   ```

3. **Duplikate prüfen:**
   ```sql
   -- Doppelte E-Mails in Leads
   SELECT mail, COUNT(*) 
   FROM leads 
   WHERE mail IS NOT NULL 
   GROUP BY mail 
   HAVING COUNT(*) > 1;
   ```

### Migrations-Checkliste

- [ ] Backup der aktuellen Supabase-Datenbank erstellen
- [ ] Airtable-Daten exportieren (falls Quelle)
- [ ] Neue Daten validieren (Format, Typen)
- [ ] Testmigration in Staging-Umgebung
- [ ] ID-Mappings dokumentieren
- [ ] Frontend-Tests durchführen
- [ ] Rollback-Plan bereithalten

### Migrations-Befehl

```bash
# Migration v2 ausführen
node supabase/migrate-data-v2.js

# Nach Migration verifizieren
# (Die Verifizierung ist im Skript integriert)
```

---

## 8. Bekannte Probleme und Fixes

### Behoben (2026-02-02)
- "Meine Leads" Filter für Admins
- Array-String Darstellung in Closing-Seite
- Numerische Felder (Besucher, Mehrwert) korrekt anzeigen
- Wiedervorlage-Zeitstempel korrigiert

### Noch offen
- E-Mail Template Attachments müssen manuell zu Supabase Storage migriert werden
- Airtable Legacy-Code sollte entfernt werden

---

## 9. Nächste Schritte

1. **Datenanalyse durchführen:**
   - Aktuelle Datenmenge in Supabase prüfen
   - Datenqualität evaluieren

2. **Neue Datenquelle vorbereiten:**
   - Datenformat definieren
   - Mapping zu Supabase-Schema erstellen

3. **Migrationsskript anpassen:**
   - `migrate-data-v2.js` als Basis verwenden
   - An neue Datenquelle anpassen

4. **Migration ausführen:**
   - Backup erstellen
   - Migration in Staging testen
   - Production-Migration durchführen

5. **Cleanup:**
   - Airtable Legacy-Code entfernen
   - Dokumentation aktualisieren

---

## 10. Kontakt & Support

**Repository:** SunsideAI/Sunside_AI_CRM-System  
**Tech Stack Docs:** [README.md](../README.md)  
**Schema:** [supabase/schema.sql](../supabase/schema.sql)

---

*Diese Analyse wurde automatisch erstellt und sollte vor kritischen Änderungen manuell verifiziert werden.*
