# Sunside CRM - Airtable zu Supabase Migration

Diese Anleitung beschreibt die vollstaendige Migration von Airtable zu Supabase.

## Voraussetzungen

1. **Supabase Projekt** erstellen auf [supabase.com](https://supabase.com)
2. **Environment Variables** in `.env` setzen:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...
   ```

## Schritt 1: Datenbank-Schema erstellen

Fuehre das Schema im Supabase SQL Editor aus:

```bash
# Haupt-Schema
supabase/schema.sql

# Neue Felder (falls Schema bereits existiert)
supabase/migrations/20260413_add_new_hot_leads_fields.sql
```

## Schritt 2: CSVs aus Airtable exportieren

Exportiere jede Tabelle als CSV:

1. Oeffne Airtable Base
2. Fuer jede Tabelle: Grid View > ... > Download CSV
3. Speichere in `supabase/csv/`:

| Airtable Tabelle | CSV Dateiname |
|------------------|---------------|
| User_Datenbank | `User_Datenbank.csv` |
| Immobilienmakler_Leads | `Immobilienmakler_Leads.csv` |
| Immobilienmakler_Hot_Leads | `Immobilienmakler_Hot_Leads.csv` |
| Immobilienmakler_Leads_Archiv | `Immobilienmakler_Leads_Archiv.csv` |
| E-Mail_Templates | `E-Mail_Templates.csv` |
| Lead_Anfragen | `Lead_Anfragen.csv` |
| System_Messages | `System_Messages.csv` |

**Wichtig:** Die Record-IDs (recXXXXX) muessen in den CSVs enthalten sein fuer korrektes Linking!

## Schritt 3: Migration ausfuehren

```bash
# Dependencies installieren
npm install

# Dry-Run (nur pruefen, nichts importieren)
npm run migrate:csv:dry

# Migration ausfuehren
npm run migrate:csv

# Oder: Alte Daten zuerst loeschen
npm run migrate:csv:clear
```

### Optionen

```bash
# Nur bestimmte Tabelle migrieren
node supabase/migrate-from-csv.js --table=users

# Trockenlauf
node supabase/migrate-from-csv.js --dry-run

# Bestehende Daten loeschen
node supabase/migrate-from-csv.js --clear
```

## Schritt 4: Verifizieren

Fuehre das Check-Script im Supabase SQL Editor aus:

```sql
-- supabase/check-data-status.sql
```

## Schritt 5: Netlify Functions umstellen

Nach erfolgreicher Migration muessen die Netlify Functions von Airtable auf Supabase umgestellt werden.

**Betroffene Dateien:**
- `netlify/functions/hot-leads.js`
- `netlify/functions/leads.js`
- `netlify/functions/users.js`
- `netlify/functions/dashboard.js`
- `netlify/functions/analytics.js`
- (alle anderen Functions)

## Neue Hot_Leads Felder

Diese Felder wurden fuer das "Angebot konfigurieren" Feature hinzugefuegt:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `vertragsbestandteile` | TEXT | Individuelle Vertragsbestandteile |
| `paketname_individuell` | TEXT | Paketname bei "Individuell" |
| `kurzbeschreibung` | TEXT | Kurzbeschreibung fuer E-Mail |
| `leistungsbeschreibung` | TEXT | Detaillierte Leistungsbeschreibung |
| `kommentar` | TEXT | Kommentar (eigenes Feld) |
| `attachments` | JSONB | Datei-Anhaenge |
| `produkt_dienstleistung` | TEXT[] | Produkte (Array) |

## Rollback

Falls etwas schief geht:

1. **Supabase Dashboard** > Settings > Database > Backups
2. Oder: Daten erneut aus Airtable exportieren und migrieren

## Fehlerbehebung

### "CSV nicht gefunden"
- Stelle sicher, dass CSVs in `supabase/csv/` liegen
- Pruefe Dateinamen (case-sensitive)

### "Duplikat E-Mail"
- Airtable erlaubt Duplikate, Supabase nicht
- Skript ueberspringt Duplikate automatisch

### "Linked Record nicht gefunden"
- Migrationsreihenfolge ist wichtig (Users vor Leads)
- Pruefe ob alle Tabellen exportiert wurden

---

*Dokumentation erstellt am 2026-04-13*
